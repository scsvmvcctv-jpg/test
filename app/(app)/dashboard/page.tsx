import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Calendar, ClipboardList, GraduationCap, Users, Clock } from 'lucide-react'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return <div>Please log in to view the dashboard.</div>
    }

    const [
        { count: lecturePlanCount },
        { count: completedTopicsCount },
        { count: testsCount },
        { count: assignmentsCount },
        { count: extraClassesCount },
        { count: theoryCount },
        { count: practicalCount },
        { count: workloadCount }
    ] = await Promise.all([
        supabase.from('lecture_plans').select('*', { count: 'exact', head: true }).eq('staff_id', user.id),
        supabase.from('lecture_plans').select('*', { count: 'exact', head: true }).eq('staff_id', user.id).not('actual_completion_date', 'is', null),
        supabase.from('tests').select('*', { count: 'exact', head: true }).eq('staff_id', user.id),
        supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('staff_id', user.id),
        supabase.from('extra_classes').select('*', { count: 'exact', head: true }).eq('staff_id', user.id),
        supabase.from('assessment_theory').select('*', { count: 'exact', head: true }).eq('staff_id', user.id),
        supabase.from('assessment_practical').select('*', { count: 'exact', head: true }).eq('staff_id', user.id),
        supabase.from('workload_schedule').select('*', { count: 'exact', head: true }).eq('staff_id', user.id)
    ])

    return (
        <div className="space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-blue-100">
                            Lecture Plans
                        </CardTitle>
                        <BookOpen className="h-5 w-5 text-white/90" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight mt-2">{lecturePlanCount || 0}</div>
                        <p className="text-sm font-medium text-blue-100 mt-1">
                            {completedTopicsCount || 0} topics completed
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-purple-100">
                            Tests Scheduled
                        </CardTitle>
                        <Calendar className="h-5 w-5 text-white/90" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight mt-2">{testsCount || 0}</div>
                        <p className="text-sm font-medium text-purple-100 mt-1">
                            Upcoming and completed
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-orange-100">
                            Assignments
                        </CardTitle>
                        <ClipboardList className="h-5 w-5 text-white/90" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight mt-2">{assignmentsCount || 0}</div>
                        <p className="text-sm font-medium text-orange-100 mt-1">
                            Assignments & Lab Records
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-emerald-100">
                            Extra Classes
                        </CardTitle>
                        <Clock className="h-5 w-5 text-white/90" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight mt-2">{extraClassesCount || 0}</div>
                        <p className="text-sm font-medium text-emerald-100 mt-1">
                            Additional sessions
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-indigo-100">
                            Assessments
                        </CardTitle>
                        <GraduationCap className="h-5 w-5 text-white/90" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight mt-2">{(theoryCount || 0) + (practicalCount || 0)}</div>
                        <p className="text-sm font-medium text-indigo-100 mt-1">
                            Theory: {theoryCount || 0} | Practical: {practicalCount || 0}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-cyan-100">
                            Workload
                        </CardTitle>
                        <Users className="h-5 w-5 text-white/90" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-extrabold tracking-tight mt-2">{workloadCount || 0}</div>
                        <p className="text-sm font-medium text-cyan-100 mt-1">
                            Scheduled periods
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
