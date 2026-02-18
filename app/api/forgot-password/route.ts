import { NextResponse } from 'next/server';
import sql from 'mssql';

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

const getApiBase = () => (process.env.API_BASE_URL || '').replace(/\/$/, '');

export async function POST(req: Request) {
  try {
    const { email, userType } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email or User ID is required' }, { status: 400 });
    }

    // 1. External API (Primary Source for Real Data)
    // The user provided a specific endpoint to retrieve credentials.
    // We try this first to avoid Mock Data if real data is accessible via API.
    if (userType !== 'Supervisor') {
      try {
        console.log('Attempting to fetch credentials from external API...');
        const apiResponse = await fetch(`${getApiBase()}/api/forgot-username-password/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ UserID: email }) // email input is effectively the UserID
        });

        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          console.log('External API Response:', apiData);

          if (apiData.userID && apiData.password) {
            return NextResponse.json({
              success: true,
              userId: apiData.userID,
              password: apiData.password,
              email: apiData.email, // The API returns the registered email
              name: apiData.userID, // API doesn't seem to return name, using ID as fallback
              userType: userType
            });
          }
        } else {
          console.log('External API returned non-OK status:', apiResponse.status);
        }
      } catch (error) {
        console.error('Failed to call external forgot-password API:', error);
      }
    }

    // --- MOCK MODE FOR DEVELOPMENT ---
    // If DB credentials are not set (and API failed or wasn't tried), return mock data
    if (!process.env.DB_SERVER && !process.env.DB_USER) {
      console.log('MOCK MODE: DB credentials missing. Using mock user data.');

      // Mock data matching the requested email/ID
      // --- GENERIC MOCK HANDLER ---
      // Allow any input in Mock Mode to facilitate easier testing
      const isEmail = email.includes('@');
      const targetEmail = isEmail ? email : 'scsvmvcctv@gmail.com';
      const mockName = isEmail ? email.split('@')[0] : email;

      // Determine user type and id based on input (simulated)
      const mockUserId = isEmail ? '10001' : email;

      return NextResponse.json({
        success: true,
        userId: mockUserId,
        password: 'mock-password-123',
        email: targetEmail,
        name: `Mock ${mockName} (${userType})`,
        userType: userType
      });
      // -----------------------------

      return NextResponse.json({ error: 'User not found (Mock Mode: try "12345" or "admin")' }, { status: 404 });
    }
    // ----------------------------------

    if (userType === 'Supervisor') {
      // Query admin login table
      await sql.connect(dbConfig);

      const result = await sql.query`
        SELECT UserId, password, Deptmailid, UserType, DeptId
        FROM dbo.adminlogin
        WHERE UserId = ${email} AND UserType = 'Supervisor'
      `;

      if (result.recordset.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const admin = result.recordset[0];
      return NextResponse.json({
        success: true,
        userId: admin.UserId,
        password: admin.password,
        email: admin.Deptmailid || `${admin.UserId}@kanchiuniv.ac.in`,
        userType: 'Supervisor'
      });
    } else {
      // For Staff, try to query external API or database
      // First, try to get from external API
      try {
        const apiUrl = `${getApiBase()}/api/auth`;
        // We can't authenticate without password, so we'll need to query the database directly
        // Let's try to find the user in the database

        await sql.connect(dbConfig);

        // Try to find user in staff table
        // NOTE: You may need to adjust the table name (dbo.StaffLogin) based on your actual database schema
        // Common alternatives: dbo.Staff, dbo.Users, dbo.UserLogin, dbo.EmployeeLogin
        const staffResult = await sql.query`
          SELECT UserID, Password, emailid, Name
          FROM dbo.StaffLogin
          WHERE UserID = ${email} OR emailid = ${email}
        `;

        if (staffResult.recordset.length > 0) {
          const staff = staffResult.recordset[0];
          return NextResponse.json({
            success: true,
            userId: staff.UserID,
            password: staff.Password,
            email: staff.emailid || `${staff.UserID}@kanchiuniv.ac.in`,
            name: staff.Name,
            userType: 'Staff'
          });
        }

        // If not found in database, return error
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      } catch (apiError: any) {
        console.error('Error fetching staff credentials:', apiError);
        return NextResponse.json({ error: 'Unable to retrieve credentials. Please contact administrator.' }, { status: 500 });
      }
    }
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: `Internal server error: ${err.message}` }, { status: 500 });
  }
}
