import { NextResponse } from 'next/server';
import sql from 'mssql';
import jwt from 'jsonwebtoken';

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true, // Use this if you're on Azure
    trustServerCertificate: true // Change to true for local dev / self-signed certs
  }
};

export async function POST(req: Request) {
  try {
    const { UserId, password, UserType } = await req.json();

    if (!UserId || !password || !UserType) {
      return NextResponse.json({ error: 'Missing credentials or role' }, { status: 400 });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    await sql.connect(dbConfig);

    const result = await sql.query`
      SELECT UserId, DeptId, UserType, Deptmailid
      FROM dbo.adminlogin
      WHERE UserId = ${UserId} AND password = ${password} AND UserType = ${UserType}
    `;

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials or role mismatch' }, { status: 401 });
    }

    const admin = result.recordset[0];

    const payload = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: admin.UserType,
      data: admin
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });

    return NextResponse.json({ message: 'Login successful', token, admin });

  } catch (err: any) {
    console.error('Admin login error:', err);
    return NextResponse.json({ error: `Internal server error: ${err.message}` }, { status: 500 });
  }
}
