import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL || '';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const EmpId = searchParams.get('EmpId');
        const Dept = searchParams.get('Dept');

        // Get the token we stored in cookies during login
        const cookieStore = await cookies();
        const externalToken = cookieStore.get('external_token');
        console.log(`API PROXY: Checking for 'external_token' cookie... Found? ${externalToken ? 'YES' : 'NO'}`);

        if (!EmpId || !Dept) {
            return NextResponse.json({
                error: "EmpId or DepartmentNo missing"
            }, { status: 400 });
        }

        if (!externalToken || !externalToken.value) {
            // Fallback: If cookie is missing, we might have been passed a token in Auth header?
            // But we decided to trust the external auth.
            // Let's try to see if the user has a valid Supabase session, maybe we can re-login silently? 
            // No, password is not stored.
            return NextResponse.json({
                error: "External session expired. Please log out and log in again."
            }, { status: 401 });
        }

        // 4. Proxy Request (send both Dept and DepartmentNo for backend compatibility)
        const targetUrl = `${API_BASE_URL}/api/facultyworkload?EmpId=${EmpId}&Dept=${Dept}&DepartmentNo=${Dept}`;

        console.log(`Proxying request to: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'Authorization': `Bearer ${externalToken.value}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`External API Error (${response.status}):`, errorText);

            if (response.status === 401 || response.status === 403) {
                return NextResponse.json({
                    error: "External session expired. Please log out and log in again."
                }, { status: 401 });
            }

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
