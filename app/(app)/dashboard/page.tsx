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

        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 -m-6">
            <div className="space-y-8 max-w-7xl mx-auto">
                <div className="flex flex-col space-y-2">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 text-lg">Overview of your academic activities and progress.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
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
                            <div className="text-5xl font-extrabold tracking-tight mt-2">{lecturePlanCount || 0}</div>
                            <p className="text-sm font-medium text-blue-100 mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-300 rounded-full animate-pulse" />
                                {completedTopicsCount || 0} topics completed
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
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
                            <div className="text-5xl font-extrabold tracking-tight mt-2">{testsCount || 0}</div>
                            <p className="text-sm font-medium text-purple-100 mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-purple-300 rounded-full animate-pulse" />
                                Upcoming and completed
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
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
                            <div className="text-5xl font-extrabold tracking-tight mt-2">{assignmentsCount || 0}</div>
                            <p className="text-sm font-medium text-orange-100 mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-orange-300 rounded-full animate-pulse" />
                                Assignments & Lab Records
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
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
                            <div className="text-5xl font-extrabold tracking-tight mt-2">{extraClassesCount || 0}</div>
                            <p className="text-sm font-medium text-emerald-100 mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
                                Additional sessions
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
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
                            <div className="text-5xl font-extrabold tracking-tight mt-2">{(theoryCount || 0) + (practicalCount || 0)}</div>
                            <p className="text-sm font-medium text-indigo-100 mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-300 rounded-full animate-pulse" />
                                Theory: {theoryCount || 0} | Practical: {practicalCount || 0}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
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
                            <div className="text-5xl font-extrabold tracking-tight mt-2">{workloadCount || 0}</div>
                            <p className="text-sm font-medium text-cyan-100 mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-cyan-300 rounded-full animate-pulse" />
                                Scheduled periods
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )

}
