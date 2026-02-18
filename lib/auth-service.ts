import sql from 'mssql';
import nodemailer from 'nodemailer';
import { getCurrentYearInAppTz } from '@/lib/datetime';

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

export async function findUserCredentials(email: string, userType: string) {
    if (!email) {
        throw new Error('Email or User ID is required');
    }

    // 1. External API (Primary Source for Real Data)
    if (userType !== 'Supervisor') {
        try {
            console.log('Attempting to fetch credentials from external API...');
            const apiBase = (process.env.API_BASE_URL || '').replace(/\/$/, '');
            const apiResponse = await fetch(`${apiBase}/api/forgot-username-password/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ UserID: email })
            });

            if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                console.log('External API Response:', apiData);

                if (apiData.userID && apiData.password) {
                    return {
                        success: true,
                        userId: apiData.userID,
                        password: apiData.password,
                        email: apiData.email,
                        name: apiData.userID,
                        userType: userType
                    };
                }
            } else {
                console.log('External API returned non-OK status:', apiResponse.status);
            }
        } catch (error) {
            console.error('Failed to call external forgot-password API:', error);
        }
    }

    // --- MOCK MODE FOR DEVELOPMENT ---
    if (!process.env.DB_SERVER && !process.env.DB_USER) {
        console.log('MOCK MODE: DB credentials missing. Using mock user data.');
        const isEmail = email.includes('@');
        const targetEmail = isEmail ? email : 'scsvmvcctv@gmail.com';
        const mockName = isEmail ? email.split('@')[0] : email;
        const mockUserId = isEmail ? '10001' : email;

        return {
            success: true,
            userId: mockUserId,
            password: 'mock-password-123',
            email: targetEmail,
            name: `Mock ${mockName} (${userType})`,
            userType: userType
        };
    }

    if (userType === 'Supervisor') {
        await sql.connect(dbConfig);
        const result = await sql.query`
        SELECT UserId, password, Deptmailid, UserType, DeptId
        FROM dbo.adminlogin
        WHERE UserId = ${email} AND UserType = 'Supervisor'
      `;

        if (result.recordset.length === 0) {
            return null;
        }

        const admin = result.recordset[0];
        return {
            success: true,
            userId: admin.UserId,
            password: admin.password,
            email: admin.Deptmailid || `${admin.UserId}@kanchiuniv.ac.in`,
            userType: 'Supervisor'
        };
    } else {
        try {
            await sql.connect(dbConfig);
            const staffResult = await sql.query`
          SELECT UserID, Password, emailid, Name
          FROM dbo.StaffLogin
          WHERE UserID = ${email} OR emailid = ${email}
        `;

            if (staffResult.recordset.length > 0) {
                const staff = staffResult.recordset[0];
                return {
                    success: true,
                    userId: staff.UserID,
                    password: staff.Password,
                    email: staff.emailid || `${staff.UserID}@kanchiuniv.ac.in`,
                    name: staff.Name,
                    userType: 'Staff'
                };
            }
            return null;
        } catch (apiError: any) {
            console.error('Error fetching staff credentials:', apiError);
            throw new Error('Unable to retrieve credentials. Please contact administrator.');
        }
    }
}

export async function sendCredentialsEmail({ to, userId, password, name, userType }: { to: string, userId: string, password: string, name?: string, userType?: string }) {
    if (!to || !userId || !password) {
        throw new Error('Missing required fields');
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn('MOCK MODE: SMTP credentials not configured. Logging email to console.');
        // ... (logging logic optimized for server logs)
        console.log(`[MOCK EMAIL] To: ${to}, UserID: ${userId}, Pwd: ${password}`);
        return {
            success: true,
            message: 'Email logged to console (Mock Mode)',
            messageId: 'mock-email-id-123'
        };
    }

    const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: to,
        subject: 'SCSVMV Log Book - Your Login Credentials',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 20px; background: #f9f9f9; }
            .credentials { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
            .credential-item { margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 5px; }
            .label { font-weight: bold; color: #667eea; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SCSVMV Log Book</h1>
              <p>Faculty & Staff Portal</p>
            </div>
            <div class="content">
              <h2>Your Login Credentials</h2>
              <p>Dear ${name || 'User'},</p>
              <p>You have requested your login credentials for the SCSVMV Log Book system.</p>
              
              <div class="credentials">
                <h3>Your Login Information:</h3>
                <div class="credential-item"><span class="label">User Type:</span> ${userType || 'Staff'}</div>
                <div class="credential-item"><span class="label">User ID:</span> ${userId}</div>
                <div class="credential-item"><span class="label">Password:</span> ${password}</div>
              </div>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong> Please keep your credentials secure.
              </div>

              <p>You can now log in to the system using these credentials.</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${getCurrentYearInAppTz()} SCSVMV Log Book System.</p>
            </div>
          </div>
        </body>
        </html>
      `,
        text: `Your Login Credentials for SCSVMV Log Book.\n\nUser ID: ${userId}\nPassword: ${password}\n\nPlease keep this secure.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);

    return {
        success: true,
        message: 'Email sent successfully',
        messageId: info.messageId
    };
}
