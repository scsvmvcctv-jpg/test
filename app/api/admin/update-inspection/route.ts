import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
    try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('Supabase URL or Service Role Key is missing');
            return NextResponse.json({ error: 'Internal configuration error: Missing Supabase credentials' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not defined');
            return NextResponse.json({ error: 'Internal configuration error' }, { status: 500 });
        }

        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (err: any) {
            console.error('JWT Verification Error:', err.message);
            console.error('Token:', token.substring(0, 10) + '...');
            return NextResponse.json({ error: `Invalid or expired token: ${err.message}` }, { status: 401 });
        }

        const { id, status, admin_comments } = await req.json();

        if (!id || !status) {
            return NextResponse.json({ error: 'Missing inspection ID or status' }, { status: 400 });
        }

        const updateData: any = { status };
        if (admin_comments !== undefined) {
            updateData.admin_comments = admin_comments;
        }

        const { error } = await supabaseAdmin
            .from('inspections')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Supabase update error:', error);
            return NextResponse.json({ error: 'Failed to update inspection' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Inspection updated successfully' });

    } catch (err: any) {
        console.error('Update inspection error:', err);
        return NextResponse.json({ error: `Internal server error: ${err.message}` }, { status: 500 });
    }
}
