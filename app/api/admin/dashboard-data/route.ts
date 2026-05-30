import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import { verifyAdminToken } from '@/lib/verify-admin-token'

export async function GET(req: Request) {
    try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
        }

        const auth = verifyAdminToken(req.headers.get('authorization'))
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { searchParams } = new URL(req.url)
        const department = searchParams.get('department')?.trim() || ''

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        let profilesQuery = supabaseAdmin
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true })

        if (department) {
            const cleanFilter = department.replace(/,$/, '').trim()
            profilesQuery = profilesQuery.ilike('department_name', `%${cleanFilter}%`)
        }

        const { data: profiles, error: profilesError } = await profilesQuery
        if (profilesError) {
            console.error('Error fetching profiles:', profilesError)
            return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
        }

        const [
            lecturePlans,
            tests,
            assignments,
            extraClasses,
            theory,
            practical,
            workload,
            inspections,
        ] = await Promise.all([
            fetchAllRows(supabaseAdmin, 'lecture_plans', { column: 'proposed_date', ascending: true }),
            fetchAllRows(supabaseAdmin, 'tests', { column: 'proposed_test_date', ascending: true }),
            fetchAllRows(supabaseAdmin, 'assignments', { column: 'proposed_date', ascending: true }),
            fetchAllRows(supabaseAdmin, 'extra_classes', { column: 'date', ascending: true }),
            fetchAllRows(supabaseAdmin, 'assessment_theory'),
            fetchAllRows(supabaseAdmin, 'assessment_practical'),
            fetchAllRows(supabaseAdmin, 'workload'),
            fetchAllRows(supabaseAdmin, 'inspections', { column: 'date', ascending: false }),
        ])

        return NextResponse.json({
            profiles: profiles || [],
            lecturePlans,
            tests,
            assignments,
            extraClasses,
            theory,
            practical,
            workload,
            inspections,
        })
    } catch (err: unknown) {
        console.error('Dashboard data error:', err)
        const message = err instanceof Error ? err.message : 'Internal server error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
