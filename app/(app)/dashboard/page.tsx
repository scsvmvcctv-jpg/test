import { createClient } from '@/lib/supabase/server'
import {
    DEFAULT_ACADEMIC_YEAR,
    DEFAULT_SEMESTER_TYPE,
    filterSubjectRowsByPeriod,
    filterWorkloadByPeriod,
    matchesWorkloadSubject,
    type WorkloadSubjectRow,
} from '@/lib/academic-years'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    BookOpen,
    Calendar,
    ClipboardList,
    GraduationCap,
    Users,
    Clock,
    Pencil,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    FileText,
    ShieldCheck,
    Layers,
    TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import {
    getLogbookLockStatus,
    isLogbookLockedForPeriod,
} from '@/lib/inspection-lock'
import { getStaffInspectionStatusDisplay } from '@/lib/inspection-status'

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

type SubjectSummary = {
    code: string
    name: string
    displayName: string
    sections: string[]
    periods: number
    lectureTotal: number
    lectureCompleted: number
    tests: number
    assignments: number
    extraClasses: number
}

function countForSubject<T extends { subject?: string | null }>(
    items: T[] | null | undefined,
    subjectName: string,
    subjectCode: string
): number {
    return (items || []).filter((item) => {
        const value = (item.subject || '').trim().toLowerCase()
        return value === subjectName.toLowerCase() || value === subjectCode.toLowerCase()
    }).length
}

function ProgressBar({ value, colorClass }: { value: number; colorClass: string }) {
    const clamped = Math.max(0, Math.min(100, value))
    return (
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all ${colorClass}`}
                style={{ width: `${clamped}%` }}
            />
        </div>
    )
}

function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    href,
    gradient,
    accent,
}: {
    title: string
    value: string | number
    subtitle: string
    icon: React.ComponentType<{ className?: string }>
    href: string
    gradient: string
    accent: string
}) {
    return (
        <Card className={`${gradient} text-white border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden group`}>
            <Link href={href} className="block">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                    <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>
                        {title}
                    </CardTitle>
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <Icon className="h-4 w-4 text-white" />
                    </div>
                </CardHeader>
                <CardContent className="relative z-10 pb-4">
                    <div className="text-4xl font-extrabold tracking-tight">{value}</div>
                    <p className={`text-xs font-medium mt-2 ${accent}`}>{subtitle}</p>
                    <div className="mt-3 flex items-center text-xs font-medium text-white/90">
                        Open section <ArrowRight className="ml-1 h-3 w-3" />
                    </div>
                </CardContent>
            </Link>
        </Card>
    )
}

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return <div>Please log in to view the dashboard.</div>
    }

    const academicYear = DEFAULT_ACADEMIC_YEAR
    const semesterType = DEFAULT_SEMESTER_TYPE
    const periodLabel = `${academicYear} · ${semesterType} Semester`

    const { data: profile } = await supabase
        .from('profiles')
        .select('emp_id, department_no, full_name, department_name, designation_name, email')
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
        { data: inspections },
    ] = await Promise.all([
        supabase
            .from('lecture_plans')
            .select('subject, actual_completion_date, academic_year, semester_type, topic, proposed_date')
            .eq('staff_id', user.id)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType),
        supabase
            .from('tests')
            .select('subject, academic_year, semester_type, proposed_test_date, actual_date')
            .eq('staff_id', user.id)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType),
        supabase
            .from('assignments')
            .select('subject, academic_year, semester_type, proposed_date, actual_date')
            .eq('staff_id', user.id)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType),
        supabase
            .from('extra_classes')
            .select('subject, academic_year, semester_type, date, topic')
            .eq('staff_id', user.id)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType),
        supabase.from('assessment_theory').select('subject, student_id').eq('staff_id', user.id),
        supabase.from('assessment_practical').select('subject, student_id').eq('staff_id', user.id),
        supabase
            .from('inspections')
            .select('status, academic_year, semester_type, date, remarks')
            .eq('staff_id', user.id)
            .order('date', { ascending: false }),
    ])

    const filteredLecturePlans = filterSubjectRowsByPeriod(
        lecturePlans,
        periodWorkload,
        academicYear,
        semesterType
    )
    const filteredTests = filterSubjectRowsByPeriod(tests, periodWorkload, academicYear, semesterType)
    const filteredAssignments = filterSubjectRowsByPeriod(assignments, periodWorkload, academicYear, semesterType)
    const filteredExtraClasses = filterSubjectRowsByPeriod(extraClasses, periodWorkload, academicYear, semesterType)
    const filteredTheory = filterSubjectRowsByPeriod(theoryAssessments, periodWorkload, academicYear, semesterType)
    const filteredPractical = filterSubjectRowsByPeriod(practicalAssessments, periodWorkload, academicYear, semesterType)

    const lecturePlanCount = filteredLecturePlans.length
    const completedTopicsCount = filteredLecturePlans.filter((row) => row.actual_completion_date).length
    const pendingTopicsCount = lecturePlanCount - completedTopicsCount
    const lectureProgress = lecturePlanCount > 0 ? Math.round((completedTopicsCount / lecturePlanCount) * 100) : 0

    const testsCount = filteredTests.length
    const assignmentsCount = filteredAssignments.length
    const extraClassesCount = filteredExtraClasses.length
    const theoryCount = filteredTheory.length
    const practicalCount = filteredPractical.length
    const assessmentCount = theoryCount + practicalCount

    const totalLogbookEntries =
        lecturePlanCount + testsCount + assignmentsCount + extraClassesCount + assessmentCount

    const periodInspections = (inspections || []).filter(
        (row) =>
            row.academic_year === academicYear &&
            row.semester_type === semesterType
    )
    const latestInspection = periodInspections[0]
    const lockStatus = getLogbookLockStatus(periodInspections, academicYear, semesterType)
    const isLocked = isLogbookLockedForPeriod(periodInspections, academicYear, semesterType)
    const inspectionDisplay = getStaffInspectionStatusDisplay(latestInspection?.status)

    const subjectMap = new Map<string, SubjectSummary>()
    periodWorkload.forEach((item) => {
        const code = (item.SubjectCode || '').trim()
        const name = (item.Subject_Name || '').trim()
        if (!code || !name) return

        const key = `${code}|${name}`
        const section = String((item as { Section?: string }).Section || '').trim()
        const periods = Number((item as { NoofPeriods?: number }).NoofPeriods) || 0

        if (!subjectMap.has(key)) {
            subjectMap.set(key, {
                code,
                name,
                displayName: `${code} - ${name}`,
                sections: section ? [section] : [],
                periods: 0,
                lectureTotal: 0,
                lectureCompleted: 0,
                tests: 0,
                assignments: 0,
                extraClasses: 0,
            })
        }

        const entry = subjectMap.get(key)!
        entry.periods += periods
        if (section && !entry.sections.includes(section)) {
            entry.sections.push(section)
        }
    })

    subjectMap.forEach((entry) => {
        entry.lectureTotal = countForSubject(filteredLecturePlans, entry.name, entry.code)
        entry.lectureCompleted = filteredLecturePlans.filter(
            (row) =>
                row.actual_completion_date &&
                matchesWorkloadSubject(row.subject, [{ SubjectCode: entry.code, Subject_Name: entry.name }])
        ).length
        entry.tests = countForSubject(filteredTests, entry.name, entry.code)
        entry.assignments = countForSubject(filteredAssignments, entry.name, entry.code)
        entry.extraClasses = countForSubject(filteredExtraClasses, entry.name, entry.code)
    })

    const subjectSummaries = Array.from(subjectMap.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
    )

    const pendingLectureTopics = filteredLecturePlans
        .filter((row) => !row.actual_completion_date)
        .slice(0, 5)

    const upcomingTests = filteredTests
        .filter((row) => !row.actual_date)
        .slice(0, 5)

    const quickActions = [
        { label: 'Lecture Plan', href: '/lecture-plan', icon: BookOpen, count: lecturePlanCount },
        { label: 'Tests', href: '/tests', icon: Calendar, count: testsCount },
        { label: 'Assignments', href: '/assignments', icon: ClipboardList, count: assignmentsCount },
        { label: 'Extra Classes', href: '/extra-classes', icon: Clock, count: extraClassesCount },
        { label: 'Theory Assessment', href: '/assessment/theory', icon: GraduationCap, count: theoryCount },
        { label: 'Practical Assessment', href: '/assessment/practical', icon: FileText, count: practicalCount },
        { label: 'Workload', href: '/workload', icon: Users, count: totalWorkloadPeriods },
        { label: 'Inspections', href: '/inspections', icon: ShieldCheck, count: periodInspections.length },
    ]

    const moduleProgress = [
        { label: 'Lecture Plans', done: completedTopicsCount, total: lecturePlanCount, color: 'bg-blue-500', href: '/lecture-plan' },
        { label: 'Tests', done: filteredTests.filter((t) => t.actual_date).length, total: testsCount, color: 'bg-purple-500', href: '/tests' },
        { label: 'Assignments', done: filteredAssignments.filter((a) => a.actual_date).length, total: assignmentsCount, color: 'bg-orange-500', href: '/assignments' },
        { label: 'Extra Classes', done: extraClassesCount, total: extraClassesCount, color: 'bg-emerald-500', href: '/extra-classes' },
        { label: 'Assessments', done: assessmentCount, total: assessmentCount, color: 'bg-indigo-500', href: '/assessment/theory' },
    ]

    const facultyName = profile?.full_name || user.email?.split('@')[0] || 'Faculty'
    const department = profile?.department_name || profile?.department_no || '—'
    const designation = profile?.designation_name || 'Faculty Member'
    const empId = profile?.emp_id || '—'

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/80 to-indigo-50 p-6 -m-6">
            <div className="space-y-6 max-w-7xl mx-auto">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white shadow-xl">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
                    <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20">
                                    {periodLabel}
                                </Badge>
                                <Badge className={`border-0 ${inspectionDisplay.className}`}>
                                    Inspection: {inspectionDisplay.label}
                                </Badge>
                                {isLocked && (
                                    <Badge className="bg-amber-500/90 text-white border-0">
                                        Logbook Locked
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                                Welcome, {facultyName}
                            </h1>
                            <p className="text-blue-100 text-sm md:text-base max-w-2xl">
                                {designation} · {department} · Emp ID: {empId}
                            </p>
                            <p className="text-blue-200/80 text-sm">
                                Your complete logbook snapshot for the current academic period — subjects, progress, and pending work in one place.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 min-w-[280px]">
                            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-4 text-center">
                                <div className="text-3xl font-bold">{subjectSummaries.length}</div>
                                <div className="text-xs text-blue-100 mt-1 uppercase tracking-wide">Subjects</div>
                            </div>
                            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-4 text-center">
                                <div className="text-3xl font-bold">{lectureProgress}%</div>
                                <div className="text-xs text-blue-100 mt-1 uppercase tracking-wide">Lecture Done</div>
                            </div>
                            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-4 text-center">
                                <div className="text-3xl font-bold">{totalLogbookEntries}</div>
                                <div className="text-xs text-blue-100 mt-1 uppercase tracking-wide">Total Entries</div>
                            </div>
                            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-4 text-center">
                                <div className="text-3xl font-bold">{totalWorkloadPeriods}</div>
                                <div className="text-xs text-blue-100 mt-1 uppercase tracking-wide">Periods/Week</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lock alert */}
                {isLocked && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="pt-4 pb-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-900">Logbook locked for {periodLabel}</p>
                                <p className="text-sm text-amber-800 mt-1">
                                    Status: {lockStatus}. Editing is disabled until inspection is returned with a query.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Progress overview + quick actions */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2 shadow-md border-0">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <TrendingUp className="h-5 w-5 text-indigo-600" />
                                Logbook Progress
                            </CardTitle>
                            <CardDescription>Completion status across all modules for {periodLabel}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {moduleProgress.map((module) => {
                                const pct = module.total > 0 ? Math.round((module.done / module.total) * 100) : 0
                                return (
                                    <Link key={module.label} href={module.href} className="block group">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">
                                                {module.label}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {module.done}/{module.total} {module.total > 0 ? `(${pct}%)` : ''}
                                            </span>
                                        </div>
                                        <ProgressBar value={pct} colorClass={module.color} />
                                    </Link>
                                )
                            })}
                        </CardContent>
                    </Card>

                    <Card className="shadow-md border-0">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Layers className="h-5 w-5 text-indigo-600" />
                                Quick Actions
                            </CardTitle>
                            <CardDescription>Jump to any logbook section</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2">
                            {quickActions.map((action) => (
                                <Link
                                    key={action.href}
                                    href={action.href}
                                    className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-center hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                                >
                                    <action.icon className="h-5 w-5 text-indigo-600" />
                                    <span className="text-xs font-medium text-slate-700 leading-tight">{action.label}</span>
                                    <span className="text-lg font-bold text-slate-900">{action.count}</span>
                                </Link>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Subject breakdown + pending work */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2 shadow-md border-0">
                        <CardHeader>
                            <CardTitle className="text-lg">My Subjects — {periodLabel}</CardTitle>
                            <CardDescription>
                                Subject-wise logbook activity from your workload
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {subjectSummaries.length === 0 ? (
                                <p className="text-sm text-slate-500 py-6 text-center">
                                    No subjects found for this academic period. Check your workload allocation.
                                </p>
                            ) : (
                                <div className="overflow-x-auto -mx-2">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-slate-500">
                                                <th className="pb-3 px-2 font-medium">Subject</th>
                                                <th className="pb-3 px-2 font-medium text-center">Sec</th>
                                                <th className="pb-3 px-2 font-medium text-center">Lecture</th>
                                                <th className="pb-3 px-2 font-medium text-center">Tests</th>
                                                <th className="pb-3 px-2 font-medium text-center">Assign</th>
                                                <th className="pb-3 px-2 font-medium text-center">Extra</th>
                                                <th className="pb-3 px-2 font-medium text-center">Periods</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subjectSummaries.map((subject) => (
                                                <tr key={subject.displayName} className="border-b border-slate-50 hover:bg-slate-50/80">
                                                    <td className="py-3 px-2">
                                                        <div className="font-medium text-slate-800">{subject.code}</div>
                                                        <div className="text-xs text-slate-500 truncate max-w-[180px]">{subject.name}</div>
                                                    </td>
                                                    <td className="py-3 px-2 text-center text-slate-600">
                                                        {subject.sections.length > 0 ? subject.sections.join(', ') : '—'}
                                                    </td>
                                                    <td className="py-3 px-2 text-center">
                                                        <span className={subject.lectureCompleted === subject.lectureTotal && subject.lectureTotal > 0 ? 'text-green-600 font-semibold' : 'text-slate-700'}>
                                                            {subject.lectureCompleted}/{subject.lectureTotal}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-2 text-center text-slate-700">{subject.tests}</td>
                                                    <td className="py-3 px-2 text-center text-slate-700">{subject.assignments}</td>
                                                    <td className="py-3 px-2 text-center text-slate-700">{subject.extraClasses}</td>
                                                    <td className="py-3 px-2 text-center font-medium text-slate-800">{subject.periods}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-md border-0">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-orange-500" />
                                Pending & Upcoming
                            </CardTitle>
                            <CardDescription>Items that need your attention</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    Pending Lecture Topics ({pendingTopicsCount})
                                </p>
                                {pendingLectureTopics.length === 0 ? (
                                    <p className="text-sm text-green-600 flex items-center gap-1">
                                        <CheckCircle2 className="h-4 w-4" /> All topics completed
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {pendingLectureTopics.map((row, i) => (
                                            <li key={i} className="text-sm border-l-2 border-orange-300 pl-3 py-0.5">
                                                <span className="font-medium text-slate-800">{row.topic || 'Untitled'}</span>
                                                <span className="text-xs text-slate-500 block">{row.subject}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    Tests Not Yet Conducted ({upcomingTests.length})
                                </p>
                                {upcomingTests.length === 0 ? (
                                    <p className="text-sm text-slate-500">No pending tests</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {upcomingTests.map((row, i) => (
                                            <li key={i} className="text-sm border-l-2 border-purple-300 pl-3 py-0.5">
                                                <span className="font-medium text-slate-800">{row.subject}</span>
                                                {row.proposed_test_date && (
                                                    <span className="text-xs text-slate-500 block">
                                                        Proposed: {row.proposed_test_date}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <Link href="/lecture-plan">
                                <Button variant="outline" size="sm" className="w-full mt-2">
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Update Logbook
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>

                {/* Stat cards */}
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Module Summary</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <StatCard
                            title="Lecture Plans"
                            value={lecturePlanCount}
                            subtitle={`${completedTopicsCount} completed · ${pendingTopicsCount} pending`}
                            icon={BookOpen}
                            href="/lecture-plan"
                            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                            accent="text-blue-100"
                        />
                        <StatCard
                            title="Tests"
                            value={testsCount}
                            subtitle={periodLabel}
                            icon={Calendar}
                            href="/tests"
                            gradient="bg-gradient-to-br from-purple-500 to-purple-600"
                            accent="text-purple-100"
                        />
                        <StatCard
                            title="Assignments"
                            value={assignmentsCount}
                            subtitle={periodLabel}
                            icon={ClipboardList}
                            href="/assignments"
                            gradient="bg-gradient-to-br from-orange-500 to-orange-600"
                            accent="text-orange-100"
                        />
                        <StatCard
                            title="Extra Classes"
                            value={extraClassesCount}
                            subtitle={periodLabel}
                            icon={Clock}
                            href="/extra-classes"
                            gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
                            accent="text-emerald-100"
                        />
                        <StatCard
                            title="Assessments"
                            value={assessmentCount}
                            subtitle={`Theory: ${theoryCount} · Practical: ${practicalCount}`}
                            icon={GraduationCap}
                            href="/assessment/theory"
                            gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
                            accent="text-indigo-100"
                        />
                        <StatCard
                            title="Workload"
                            value={totalWorkloadPeriods}
                            subtitle={`Total periods/week · ${periodLabel}`}
                            icon={Users}
                            href="/workload"
                            gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
                            accent="text-cyan-100"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
