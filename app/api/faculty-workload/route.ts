import { NextResponse } from 'next/server';
// import jwt from 'jsonwebtoken';

const API_BASE_URL = 'http://14.139.187.54:443';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const EmpId = searchParams.get('EmpId');
        const Dept = searchParams.get('Dept');

        // Use logic similar to authentication middleware to generate token
        const authHeader = req.headers.get('Authorization');

        if (!EmpId || !Dept) {
            return NextResponse.json({
                error: "EmpId or DepartmentNo missing"
            }, { status: 400 });
        }

        if (!authHeader) {
            return NextResponse.json({
                error: "Authorization header missing"
            }, { status: 401 });
        }

        // Use the token explicitly provided by the user which is known to be valid
        // NOTE: This is a temporary fix for verification. Ideally, we should sign our own tokens if we had the correct SECRET.
        const newNodeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjQ5NjA3Mzg2MTAsImV4cCI6MTc2NDk2NDMzOCwiZGF0YSI6eyJFbXBJRCI6MTAwMjEsIkRlcGFydG1lbnRubyI6MSwiTmFtZSI6IkUuU0FOS0FSIiwiVXNlcklEIjoiZXNhbmthciJ9fQ.4r0d6214KWZvkCdDQf2gnfxcuJnudDiqLWBQ2qoqSHg";

        // Forward request to external API with NEW token
        const targetUrl = `${API_BASE_URL}/api/facultyworkload?EmpId=${EmpId}&Dept=${Dept}`;

        console.log(`Proxying request to: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'Authorization': `Bearer ${newNodeToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`External API Error (${response.status}):`, errorText);
            return NextResponse.json({
                error: `External API error: ${response.status}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (err: any) {
        console.error("PROXY ERROR:", err);
        return NextResponse.json({
            error: "Internal server error",
            details: err.message
        }, { status: 500 });
    }
}
