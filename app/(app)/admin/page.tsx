'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Users, ArrowLeft } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'

type StaffSummary = {
    id: string
    full_name: string
    email: string
    department: string
    designation: string
    lecture_plans_total: number
    lecture_plans_completed: number
    tests_count: number
    assignments_count: number
    extra_classes_count: number
    assessments_count: number
    workload_count: number
}

export default function AdminPage() {
    const [data, setData] = useState<StaffSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedStaff, setSelectedStaff] = useState<StaffSummary | null>(null)
    const [staffDetails, setStaffDetails] = useState<any>({
        lecturePlans: [],
        tests: [],
        assignments: [],
        extraClasses: [],
        theory: [],
        practical: [],
        workload: []
    })
    const [detailsLoading, setDetailsLoading] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        if (selectedStaff) {
            fetchStaffDetails(selectedStaff.id)
        }
    }, [selectedStaff])

    const fetchData = async () => {
        setLoading(true)

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true })

        if (profilesError || !profiles) {
            console.error('Error fetching profiles:', profilesError)
            setLoading(false)
            return
        }

        const [
            { data: lecturePlans },
            { data: tests },
            { data: assignments },
            { data: extraClasses },
            { data: theoryAssessments },
            { data: practicalAssessments },
            { data: workload }
        ] = await Promise.all([
            supabase.from('lecture_plans').select('staff_id, actual_completion_date'),
            supabase.from('tests').select('staff_id'),
            supabase.from('assignments').select('staff_id'),
            supabase.from('extra_classes').select('staff_id'),
            supabase.from('assessment_theory').select('staff_id'),
            supabase.from('assessment_practical').select('staff_id'),
            supabase.from('workload_schedule').select('staff_id')
        ])

        const summaryData: StaffSummary[] = profiles.map(profile => {
            const staffId = profile.id

            const staffLecturePlans = lecturePlans?.filter((r: any) => r.staff_id === staffId) || []
            const staffTests = tests?.filter((r: any) => r.staff_id === staffId) || []
            const staffAssignments = assignments?.filter((r: any) => r.staff_id === staffId) || []
            const staffExtraClasses = extraClasses?.filter((r: any) => r.staff_id === staffId) || []
            const staffTheory = theoryAssessments?.filter((r: any) => r.staff_id === staffId) || []
            const staffPractical = practicalAssessments?.filter((r: any) => r.staff_id === staffId) || []
            const staffWorkload = workload?.filter((r: any) => r.staff_id === staffId) || []

            return {
                id: profile.id,
                full_name: profile.full_name || 'N/A',
                email: profile.email || 'N/A',
                department: profile.department_name || profile.department || '-',
                designation: profile.designation_name || profile.designation || '-',
                lecture_plans_total: staffLecturePlans.length,
                lecture_plans_completed: staffLecturePlans.filter((r: any) => r.actual_completion_date).length,
                tests_count: staffTests.length,
                assignments_count: staffAssignments.length,
                extra_classes_count: staffExtraClasses.length,
                assessments_count: staffTheory.length + staffPractical.length,
                workload_count: staffWorkload.length
            }
        })

        setData(summaryData)
        setLoading(false)
    }

    const fetchStaffDetails = async (staffId: string) => {
        setDetailsLoading(true)
        const [
            { data: lecturePlans },
            { data: tests },
            { data: assignments },
            { data: extraClasses },
            { data: theory },
            { data: practical },
            { data: workload }
        ] = await Promise.all([
            supabase.from('lecture_plans').select('*').eq('staff_id', staffId).order('proposed_date', { ascending: true }),
            supabase.from('tests').select('*').eq('staff_id', staffId).order('proposed_test_date', { ascending: true }),
            supabase.from('assignments').select('*').eq('staff_id', staffId).order('proposed_date', { ascending: true }),
            supabase.from('extra_classes').select('*').eq('staff_id', staffId).order('date', { ascending: true }),
            supabase.from('assessment_theory').select('*').eq('staff_id', staffId),
            supabase.from('assessment_practical').select('*').eq('staff_id', staffId),
            supabase.from('workload_schedule').select('*').eq('staff_id', staffId)
        ])

        setStaffDetails({
            lecturePlans: lecturePlans || [],
            tests: tests || [],
            assignments: assignments || [],
            extraClasses: extraClasses || [],
            theory: theory || [],
            practical: practical || [],
            workload: workload || []
        })
        setDetailsLoading(false)
    }

    const summaryColumns: ColumnDef<StaffSummary>[] = [
        {
            accessorKey: 'full_name',
            header: 'Staff Name',
            cell: ({ row }) => (
                <Button variant="link" className="p-0 h-auto font-semibold text-blue-600" onClick={() => setSelectedStaff(row.original)}>
                    {row.original.full_name}
                </Button>
            )
        },
        { accessorKey: 'designation', header: 'Designation' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'lecture_plans_completed',
            header: 'Lecture Plans',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">
                        {row.original.lecture_plans_completed} / {row.original.lecture_plans_total}
                    </span>
                    <span className="text-xs text-muted-foreground">Completed</span>
                </div>
            )
        },
        { accessorKey: 'tests_count', header: 'Tests' },
        { accessorKey: 'assignments_count', header: 'Assignments' },
        { accessorKey: 'extra_classes_count', header: 'Extra Classes' },
        { accessorKey: 'assessments_count', header: 'Assessments' },
        { accessorKey: 'workload_count', header: 'Workload' },
    ]

    // Detailed Columns
    const lecturePlanColumns: ColumnDef<any>[] = [
        { accessorKey: 'subject', header: 'Subject' },
        { accessorKey: 'period_no', header: 'Period' },
        { accessorKey: 'proposed_date', header: 'Proposed Date', cell: ({ row }) => row.original.proposed_date ? format(new Date(row.original.proposed_date), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'topic', header: 'Topic' },
        { accessorKey: 'actual_completion_date', header: 'Actual Date', cell: ({ row }) => row.original.actual_completion_date ? format(new Date(row.original.actual_completion_date), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'remarks', header: 'Remarks' },
    ]

    const testColumns: ColumnDef<any>[] = [
        { accessorKey: 'subject', header: 'Subject' },
        { accessorKey: 'proposed_test_date', header: 'Proposed Date', cell: ({ row }) => row.original.proposed_test_date ? format(new Date(row.original.proposed_test_date), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'actual_date', header: 'Actual Date', cell: ({ row }) => row.original.actual_date ? format(new Date(row.original.actual_date), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'date_returned', header: 'Returned Date', cell: ({ row }) => row.original.date_returned ? format(new Date(row.original.date_returned), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'remarks', header: 'Remarks' },
    ]

    const assignmentColumns: ColumnDef<any>[] = [
        { accessorKey: 'subject', header: 'Subject' },
        { accessorKey: 'type', header: 'Type' },
        { accessorKey: 'proposed_date', header: 'Proposed Date', cell: ({ row }) => row.original.proposed_date ? format(new Date(row.original.proposed_date), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'actual_date', header: 'Actual Date', cell: ({ row }) => row.original.actual_date ? format(new Date(row.original.actual_date), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'date_returned', header: 'Returned Date', cell: ({ row }) => row.original.date_returned ? format(new Date(row.original.date_returned), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'remarks', header: 'Remarks' },
    ]

    const extraClassColumns: ColumnDef<any>[] = [
        { accessorKey: 'date', header: 'Date', cell: ({ row }) => row.original.date ? format(new Date(row.original.date), 'dd/MM/yyyy') : '-' },
        { accessorKey: 'period', header: 'Period' },
        { accessorKey: 'topic', header: 'Topic' },
        { accessorKey: 'remarks', header: 'Remarks' },
    ]

    const theoryColumns: ColumnDef<any>[] = [
        { accessorKey: 'student_id', header: 'Student ID' },
        { accessorKey: 'internal_1', header: 'Internal 1' },
        { accessorKey: 'internal_2', header: 'Internal 2' },
        { accessorKey: 'assignment_attendance', header: 'Assignment/Att' },
        { accessorKey: 'total', header: 'Total' },
    ]

    const practicalColumns: ColumnDef<any>[] = [
        { accessorKey: 'student_id', header: 'Student ID' },
        { accessorKey: 'observations', header: 'Observations' },
        { accessorKey: 'model_test', header: 'Model Test' },
        { accessorKey: 'record_attendance', header: 'Record/Att' },
        { accessorKey: 'total', header: 'Total' },
    ]

    const workloadColumns: ColumnDef<any>[] = [
        { accessorKey: 'day_of_week', header: 'Day' },
        { accessorKey: 'period_1', header: '1' },
        { accessorKey: 'period_2', header: '2' },
        { accessorKey: 'period_3', header: '3' },
        { accessorKey: 'period_4', header: '4' },
        { accessorKey: 'period_5', header: '5' },
        { accessorKey: 'period_6', header: '6' },
        { accessorKey: 'period_7', header: '7' },
        { accessorKey: 'period_8', header: '8' },
    ]

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    if (selectedStaff) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedStaff(null)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">{selectedStaff.full_name}</h1>
                        <p className="text-muted-foreground">{selectedStaff.designation} - {selectedStaff.department}</p>
                    </div>
                </div>

                {detailsLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : (
                    <Tabs defaultValue="lecture-plans" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
                            <TabsTrigger value="lecture-plans">Lecture Plans</TabsTrigger>
                            <TabsTrigger value="tests">Tests</TabsTrigger>
                            <TabsTrigger value="assignments">Assignments</TabsTrigger>
                            <TabsTrigger value="extra-classes">Extra Classes</TabsTrigger>
                            <TabsTrigger value="assessments">Assessments</TabsTrigger>
                            <TabsTrigger value="workload">Workload</TabsTrigger>
                        </TabsList>

                        <TabsContent value="lecture-plans" className="mt-6">
                            <Card>
                                <CardHeader><CardTitle>Lecture Plans</CardTitle></CardHeader>
                                <CardContent>
                                    <DataTable columns={lecturePlanColumns} data={staffDetails.lecturePlans} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="tests" className="mt-6">
                            <Card>
                                <CardHeader><CardTitle>Tests</CardTitle></CardHeader>
                                <CardContent>
                                    <DataTable columns={testColumns} data={staffDetails.tests} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="assignments" className="mt-6">
                            <Card>
                                <CardHeader><CardTitle>Assignments</CardTitle></CardHeader>
                                <CardContent>
                                    <DataTable columns={assignmentColumns} data={staffDetails.assignments} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="extra-classes" className="mt-6">
                            <Card>
                                <CardHeader><CardTitle>Extra Classes</CardTitle></CardHeader>
                                <CardContent>
                                    <DataTable columns={extraClassColumns} data={staffDetails.extraClasses} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="assessments" className="mt-6">
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader><CardTitle>Theory Assessments</CardTitle></CardHeader>
                                    <CardContent>
                                        <DataTable columns={theoryColumns} data={staffDetails.theory} />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle>Practical Assessments</CardTitle></CardHeader>
                                    <CardContent>
                                        <DataTable columns={practicalColumns} data={staffDetails.practical} />
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="workload" className="mt-6">
                            <Card>
                                <CardHeader><CardTitle>Workload Schedule</CardTitle></CardHeader>
                                <CardContent>
                                    <DataTable columns={workloadColumns} data={staffDetails.workload} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-4xl font-extrabold tracking-tight">Admin Dashboard</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/90">
                            Total Staff
                        </CardTitle>
                        <Users className="h-4 w-4 text-white/80" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.length}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-md border bg-card text-card-foreground shadow-sm">
                <DataTable columns={summaryColumns} data={data} />
            </div>
        </div>
    )
}
