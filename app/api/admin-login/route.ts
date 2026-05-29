import { NextResponse } from 'next/server';
import sql from 'mssql';
import { signAdminToken } from '@/lib/admin-token';

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

    const userTypeStr = (UserType as string || '').trim();
    const isOfficer = /^Officers?$/i.test(userTypeStr);

    // Supervisor / HOD: proxy to external auth, then re-sign token for local APIs
    if (/^Supervisor$/i.test(userTypeStr) || /^HOD$/i.test(userTypeStr)) {
      const base = (process.env.API_BASE_URL || '').replace(/\/$/, '');
      if (!base) {
        return NextResponse.json(
          { error: 'Admin login requires API_BASE_URL in .env' },
          { status: 503 }
        );
      }
      const apiUrl = `${base}/api/admin-login`;
      const body = {
        UserId: typeof UserId === 'string' ? UserId.trim() : UserId,
        password,
        UserType: (UserType as string).trim(),
      };
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: (data as { error?: string }).error || `External API error (${res.status})` },
          { status: res.status >= 400 ? res.status : 502 }
        );
      }
      const admin = (data as { admin?: Record<string, unknown> }).admin;
      const localToken = admin ? signAdminToken(admin) : null;
      if (!localToken) {
        return NextResponse.json(
          { error: 'JWT_SECRET is not configured. Add JWT_SECRET to .env and restart the server.' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ...(data as object),
        token: localToken,
      });
    }

    if (isOfficer) {
      const base = (process.env.API_BASE_URL || '').replace(/\/$/, '');
      if (!base) {
        return NextResponse.json(
          { error: 'Officers login requires API_BASE_URL in .env' },
          { status: 503 }
        );
      }
      const apiUrl = `${base}/api/admin-login`;
      const body = {
        UserId: typeof UserId === 'string' ? UserId.trim() : UserId,
        password,
        UserType: 'Officers'
      };
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: (data as { error?: string }).error || `External API error (${res.status})` },
          { status: res.status >= 400 ? res.status : 502 }
        );
      }
      const admin = (data as { admin?: Record<string, unknown> }).admin
      const localToken = admin ? signAdminToken(admin) : null
      if (!localToken) {
        return NextResponse.json(
          { error: 'JWT_SECRET is not configured. Add JWT_SECRET to .env and restart the server.' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ...(data as object),
        token: localToken,
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return NextResponse.json(
        { error: 'JWT_SECRET is not configured. Add JWT_SECRET to .env and restart the server.' },
        { status: 500 }
      );
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
    const token = signAdminToken(admin as Record<string, unknown>);
    if (!token) {
      return NextResponse.json(
        { error: 'JWT_SECRET is not configured. Add JWT_SECRET to .env and restart the server.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Login successful', token, admin });

  } catch (err: any) {
    console.error('Admin login error:', err);
    return NextResponse.json({ error: `Internal server error: ${err.message}` }, { status: 500 });
  }
}
