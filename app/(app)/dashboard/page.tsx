import { createClient } from '@/lib/supabase/server'
import {
    DEFAULT_ACADEMIC_YEAR,
    DEFAULT_SEMESTER_TYPE,
    filterSubjectRowsByPeriod,
    filterWorkloadByPeriod,
    type WorkloadSubjectRow,
} from '@/lib/academic-years'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Calendar, ClipboardList, GraduationCap, Users, Clock, Pencil } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { headers } from 'next/headers'

async function fetchFacultyWorkloadRows(
    empId: string,
    deptNo: string
): Promise<WorkloadSubjectRow[]> {
    try {
        const headersList = await headers()
        const host = headersList.get('host') || 'localhost:3000'
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
        const baseUrl = `${protocol}://${host}`

        const workloadResponse = await fetch(
            `${baseUrl}/api/faculty-workload?EmpId=${empId}&Dept=${deptNo}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    cookie: headersList.get('cookie') || '',
                },
                cache: 'no-store',
            }
        )

        if (!workloadResponse.ok) return []

        const workloadData = await workloadResponse.json()
        const rows = Array.isArray(workloadData?.data)
            ? workloadData.data
            : Array.isArray(workloadData)
                ? workloadData
                : []

        return rows as WorkloadSubjectRow[]
    } catch (error) {
        console.error('Error fetching workload:', error)
        return []
    }
}

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return <div>Please log in to view the dashboard.</div>
    }

    const academicYear = DEFAULT_ACADEMIC_YEAR
    const semesterType = DEFAULT_SEMESTER_TYPE
    const periodLabel = `${academicYear}, ${semesterType} semester`

    const { data: profile } = await supabase
        .from('profiles')
        .select('emp_id, department_no')
        .eq('id', user.id)
        .single()

    const facultyWorkload = profile?.emp_id && profile?.department_no
        ? await fetchFacultyWorkloadRows(profile.emp_id, profile.department_no)
        : []

    const periodWorkload = filterWorkloadByPeriod(facultyWorkload, academicYear, semesterType)

    const totalWorkloadPeriods = periodWorkload.reduce(
        (acc, curr) => acc + (Number((curr as { NoofPeriods?: number }).NoofPeriods) || 0),
        0
    )

    const [
        { data: lecturePlans },
        { data: tests },
        { data: assignments },
        { data: extraClasses },
        { data: theoryAssessments },
        { data: practicalAssessments },
    ] = await Promise.all([
        supabase
            .from('lecture_plans')
            .select('subject, actual_completion_date, academic_year, semester_type')
            .eq('staff_id', user.id)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType),
        supabase
            .from('tests')
            .select('subject, academic_year, semester_type')
            .eq('staff_id', user.id)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType),
        supabase
            .from('assignments')
            .select('subject, academic_year, semester_type')
            .eq('staff_id', user.id)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType),
        supabase
            .from('extra_classes')
            .select('subject, academic_year, semester_type')
            .eq('staff_id', user.id)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType),
        supabase.from('assessment_theory').select('subject').eq('staff_id', user.id),
        supabase.from('assessment_practical').select('subject').eq('staff_id', user.id),
    ])

    const filteredLecturePlans = filterSubjectRowsByPeriod(
        lecturePlans,
        periodWorkload,
        academicYear,
        semesterType
    )
    const lecturePlanCount = filteredLecturePlans.length
    const completedTopicsCount = filteredLecturePlans.filter((row) => row.actual_completion_date).length

    const testsCount = filterSubjectRowsByPeriod(tests, periodWorkload, academicYear, semesterType).length
    const assignmentsCount = filterSubjectRowsByPeriod(assignments, periodWorkload, academicYear, semesterType).length
    const extraClassesCount = filterSubjectRowsByPeriod(extraClasses, periodWorkload, academicYear, semesterType).length
    const theoryCount = filterSubjectRowsByPeriod(theoryAssessments, periodWorkload, academicYear, semesterType).length
    const practicalCount = filterSubjectRowsByPeriod(
        practicalAssessments,
        periodWorkload,
        academicYear,
        semesterType
    ).length

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 -m-6">
            <div className="space-y-8 max-w-7xl mx-auto">
                <div className="flex flex-col space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 text-lg">Overview of your academic activities and progress.</p>
                    <p className="text-sm font-medium text-slate-600">
                        Showing data for Academic Year <span className="font-semibold">{academicYear}</span>,{' '}
                        <span className="font-semibold">{semesterType}</span> semester
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer">
                        <Link href="/lecture-plan" className="block">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-blue-100">
                                    Lecture Plans
                                </CardTitle>
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <BookOpen className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="text-5xl font-extrabold tracking-tight mt-2">{lecturePlanCount}</div>
                                <p className="text-sm font-medium text-blue-100 mt-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-300 rounded-full animate-pulse" />
                                    {completedTopicsCount} topics completed · {periodLabel}
                                </p>
                                <div className="mt-4">
                                    <Button variant="secondary" size="sm" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                                        <Pencil className="w-4 h-4 mr-2" />
                                        View & Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Link>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer">
                        <Link href="/tests" className="block">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-purple-100">
                                    Tests Scheduled
                                </CardTitle>
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <Calendar className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="text-5xl font-extrabold tracking-tight mt-2">{testsCount}</div>
                                <p className="text-sm font-medium text-purple-100 mt-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-purple-300 rounded-full animate-pulse" />
                                    {periodLabel}
                                </p>
                                <div className="mt-4">
                                    <Button variant="secondary" size="sm" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                                        <Pencil className="w-4 h-4 mr-2" />
                                        View & Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Link>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer">
                        <Link href="/assignments" className="block">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-orange-100">
                                    Assignments
                                </CardTitle>
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <ClipboardList className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="text-5xl font-extrabold tracking-tight mt-2">{assignmentsCount}</div>
                                <p className="text-sm font-medium text-orange-100 mt-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-orange-300 rounded-full animate-pulse" />
                                    {periodLabel}
                                </p>
                                <div className="mt-4">
                                    <Button variant="secondary" size="sm" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                                        <Pencil className="w-4 h-4 mr-2" />
                                        View & Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Link>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer">
                        <Link href="/extra-classes" className="block">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-emerald-100">
                                    Extra Classes
                                </CardTitle>
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <Clock className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="text-5xl font-extrabold tracking-tight mt-2">{extraClassesCount}</div>
                                <p className="text-sm font-medium text-emerald-100 mt-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
                                    {periodLabel}
                                </p>
                                <div className="mt-4">
                                    <Button variant="secondary" size="sm" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                                        <Pencil className="w-4 h-4 mr-2" />
                                        View & Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Link>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer">
                        <Link href="/assessment/theory" className="block">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-indigo-100">
                                    Assessments
                                </CardTitle>
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <GraduationCap className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="text-5xl font-extrabold tracking-tight mt-2">{theoryCount + practicalCount}</div>
                                <p className="text-sm font-medium text-indigo-100 mt-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-indigo-300 rounded-full animate-pulse" />
                                    Theory: {theoryCount} | Practical: {practicalCount} · {periodLabel}
                                </p>
                                <div className="mt-4">
                                    <Button variant="secondary" size="sm" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                                        <Pencil className="w-4 h-4 mr-2" />
                                        View & Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Link>
                    </Card>

                    <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer">
                        <Link href="/workload" className="block">
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-cyan-100">
                                    Workload
                                </CardTitle>
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <Users className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="text-5xl font-extrabold tracking-tight mt-2">{totalWorkloadPeriods}</div>
                                <p className="text-sm font-medium text-cyan-100 mt-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-cyan-300 rounded-full animate-pulse" />
                                    Total periods · {periodLabel}
                                </p>
                                <div className="mt-4">
                                    <Button variant="secondary" size="sm" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
                                        <Pencil className="w-4 h-4 mr-2" />
                                        View & Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Link>
                    </Card>
                </div>
            </div>
        </div>
    )
}
