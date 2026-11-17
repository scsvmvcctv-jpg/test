import { NextResponse } from 'next/server';
import sql from 'mssql';
import jwt from 'jsonwebtoken';

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS || process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'scsvmv_leave',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const UserID = body.UserID || body.email;
    const Password = body.Password || body.password;

    if (!UserID || !Password) {
      return NextResponse.json({ error: 'Missing UserID or Password' }, { status: 400 });
    }

    // 1. If an external API_BASE_URL is set (and points outside localhost), attempt to proxy
    const envApiBase = (process.env.API_BASE_URL || '').trim().replace(/\/$/, '');
    if (envApiBase && !envApiBase.includes('localhost') && !envApiBase.includes('127.0.0.1')) {
      try {
        console.log(`Proxying auth request to external API_BASE_URL: ${envApiBase}/api/auth`);
        const res = await fetch(`${envApiBase}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ UserID, Password }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          return NextResponse.json(data);
        } else if (res.status !== 404 && res.status !== 405) {
          return NextResponse.json(
            { error: (data as any).error || `External auth error (${res.status})` },
            { status: res.status }
          );
        }
      } catch (externalErr: any) {
        console.error('External API call failed, falling back to local DB auth:', externalErr.message);
      }
    }

    // 2. Direct MSSQL Database Authentication if DB credentials exist
    if (process.env.DB_SERVER && (process.env.DB_USER || process.env.DB_PASS)) {
      try {
        await sql.connect(dbConfig);
        const result = await sql.query`
          SELECT 
            e.EmpID, e.UserID, e.Name, e.FatherName, e.Gender, e.dob, e.doj,
            e.MobileNo, e.emailid, e.Status,
            e.Departmentno, d.DepartmentName, d.Deptaliasname,
            e.DesignationNo, des.Designation AS DesignationName
          FROM dbo.EmployeeDetails e
          LEFT JOIN dbo.Departments d ON e.Departmentno = d.Departmentno
          LEFT JOIN dbo.Designation des ON e.DesignationNo = des.DesignationNo
          WHERE e.UserID = ${UserID} AND e.Password = ${Password}
        `;

        if (result.recordset.length === 0) {
          return NextResponse.json({ error: 'Invalid UserID or Password' }, { status: 401 });
        }

        const user = result.recordset[0];
        const secret = process.env.JWT_SECRET || 'scsvmv-logbook-jwt-secret-change-in-production-min32chars';
        const payload = {
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          data: {
            EmpID: user.EmpID,
            Departmentno: user.Departmentno,
            Name: user.Name,
            UserID: user.UserID
          }
        };

        const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
        return NextResponse.json({ message: 'Login successful', token, user });
      } catch (dbErr: any) {
        console.error('Database connection error during auth:', dbErr.message);
        return NextResponse.json(
          { error: `Database authentication failed: ${dbErr.message}` },
          { status: 500 }
        );
      }
    }

    // 3. Fallback for testing / standalone mode if no external DB or API is available
    const mockUser = {
      EmpID: 10001,
      UserID: UserID,
      Name: UserID.toUpperCase(),
      Departmentno: 1,
      DepartmentName: 'Computer Science and Engg.',
      DesignationName: 'Assistant Professor'
    };
    const secret = process.env.JWT_SECRET || 'scsvmv-logbook-jwt-secret-change-in-production-min32chars';
    const payload = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      data: { EmpID: mockUser.EmpID, Departmentno: mockUser.Departmentno, Name: mockUser.Name, UserID: mockUser.UserID }
    };
    const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

    return NextResponse.json({
      message: 'Login successful (Standalone Mode)',
      token,
      user: mockUser
    });

  } catch (err: any) {
    console.error('Auth API route error:', err);
    return NextResponse.json({ error: `Internal server error: ${err.message}` }, { status: 500 });
  }
}
