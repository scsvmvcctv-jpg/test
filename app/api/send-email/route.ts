import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getCurrentYearInAppTz } from '@/lib/datetime';

export async function POST(req: Request) {
  try {
    const { to, userId, password, name, userType } = await req.json();

    if (!to || !userId || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Configure email transporter
    // You can use Gmail, SMTP, or other email services
    // For production, use environment variables for credentials
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // If no SMTP credentials, use a test account (for development only)
    // If no SMTP credentials, check if we are in development/mock mode
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('MOCK MODE: SMTP credentials not configured. Logging email to console.');

      console.log('---------------------------------------------------');
      console.log(`MOCK EMAIL TO: ${to}`);
      console.log(`SUBJECT: SCSVMV Log Book - Your Login Credentials`);
      console.log(`CONTENT:`);
      console.log(`Dear ${name || 'User'},`);
      console.log(`Your Login Information:`);
      console.log(`User Type: ${userType || 'Staff'}`);
      console.log(`User ID: ${userId}`);
      console.log(`Password: ${password}`);
      console.log('---------------------------------------------------');

      return NextResponse.json({
        success: true,
        message: 'Email logged to console (Mock Mode)',
        messageId: 'mock-email-id-123'
      });
    }

    // Email content
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to,
      subject: 'SCSVMV Log Book - Your Login Credentials',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 10px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              padding: 20px;
              background: #f9f9f9;
            }
            .credentials {
              background: white;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
              border-left: 4px solid #667eea;
            }
            .credential-item {
              margin: 10px 0;
              padding: 10px;
              background: #f0f0f0;
              border-radius: 5px;
            }
            .label {
              font-weight: bold;
              color: #667eea;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 12px;
            }
            .warning {
              background: #fff3cd;
              border: 1px solid #ffc107;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
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
                <div class="credential-item">
                  <span class="label">User Type:</span> ${userType || 'Staff'}
                </div>
                <div class="credential-item">
                  <span class="label">User ID:</span> ${userId}
                </div>
                <div class="credential-item">
                  <span class="label">Password:</span> ${password}
                </div>
              </div>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong> Please keep your credentials secure and do not share them with anyone. 
                For security reasons, we recommend changing your password after logging in.
              </div>

              <p>You can now log in to the system using these credentials at: 
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login">Login Page</a>
              </p>

              <p>If you did not request this information, please contact the administrator immediately.</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${getCurrentYearInAppTz()} SCSVMV Log Book System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        SCSVMV Log Book - Your Login Credentials
        
        Dear ${name || 'User'},
        
        You have requested your login credentials for the SCSVMV Log Book system.
        
        Your Login Information:
        User Type: ${userType || 'Staff'}
        User ID: ${userId}
        Password: ${password}
        
        ⚠️ Security Notice: Please keep your credentials secure and do not share them with anyone.
        
        You can now log in to the system using these credentials.
        
        If you did not request this information, please contact the administrator immediately.
        
        This is an automated email. Please do not reply to this message.
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent:', info.messageId);

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });

  } catch (err: any) {
    console.error('Email sending error:', err);
    return NextResponse.json({
      error: `Failed to send email: ${err.message}`
    }, { status: 500 });
  }
}
