'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation' // Import useRouter
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/DataTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Users, ArrowLeft, CheckCircle, MessageSquare } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { formatInAppTz } from '@/lib/datetime'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { InspectionSubmissionReport } from '@/components/admin/InspectionSubmissionReport'
import {
    DEFAULT_ACADEMIC_YEAR,
    DEFAULT_SEMESTER_TYPE,
    filterRecordsByPeriod,
    getAcademicYearOptions,
    resolveAcademicYear,
} from '@/lib/academic-years'

function normalizeDepartmentName(name?: string | null) {
    return (name || '').replace(/,\s*$/, '').trim()
}

function isDepartmentScopedAdmin(userType?: string | null) {
    const type = (userType || '').trim()
    return /^(supervisor|hod)$/i.test(type)
}

function getInspectionDisplayStatus(status: string | undefined | null, isHodView: boolean) {
    const value = status || 'Pending'
    if (isHodView && value === 'HOD Approved') return 'Pending Dean'
    return value
}

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
    inspections_count: number
}

export default function AdminPage() {
    const [profiles, setProfiles] = useState<{
        id: string
        full_name?: string | null
        email?: string | null
        department_name?: string | null
        department?: string | null
        designation_name?: string | null
        designation?: string | null
    }[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedStaff, setSelectedStaff] = useState<StaffSummary | null>(null)
    const [staffDetails, setStaffDetails] = useState<any>({
        lecturePlans: [],
        tests: [],
        assignments: [],
        extraClasses: [],
        theory: [],
        practical: [],
        workload: [],
        inspections: []
    })
    const [detailsLoading, setDetailsLoading] = useState(false)
    const [queryDialogOpen, setQueryDialogOpen] = useState(false)
    const [queryId, setQueryId] = useState<string | null>(null)
    const [queryComment, setQueryComment] = useState('')
    const [approvingInspectionId, setApprovingInspectionId] = useState<string | null>(null)
    const [activityData, setActivityData] = useState<{
        lecturePlans: Record<string, unknown>[]
        tests: Record<string, unknown>[]
        assignments: Record<string, unknown>[]
        extraClasses: Record<string, unknown>[]
        theory: Record<string, unknown>[]
        practical: Record<string, unknown>[]
        workload: Record<string, unknown>[]
        inspections: Record<string, unknown>[]
    } | null>(null)

    const supabase = createClient()
    const router = useRouter() // Add router

    const [adminDetails, setAdminDetails] = useState<any>(null)
    const [departmentList, setDepartmentList] = useState<string[]>([])
    const [selectedDepartment, setSelectedDepartment] = useState<string>('')
    const [canSelectDepartment, setCanSelectDepartment] = useState(false)
    const [academicYear, setAcademicYear] = useState<string>(DEFAULT_ACADEMIC_YEAR)
    const [academicYearOptions, setAcademicYearOptions] = useState<string[]>([DEFAULT_ACADEMIC_YEAR])
    const [semesterType, setSemesterType] = useState<string>(DEFAULT_SEMESTER_TYPE)

    const filterByStaff = <T extends { staff_id?: string }>(rows: T[] | null | undefined, staffId: string) =>
        (rows || []).filter((r) => r.staff_id === staffId)

    const buildStaffSummary = (
        profileRows: { id: string; full_name?: string | null; email?: string | null; department_name?: string | null; department?: string | null; designation_name?: string | null; designation?: string | null }[],
        lecturePlans: Record<string, unknown>[],
        tests: Record<string, unknown>[],
        assignments: Record<string, unknown>[],
        extraClasses: Record<string, unknown>[],
        theoryAssessments: Record<string, unknown>[],
        practicalAssessments: Record<string, unknown>[],
        workload: Record<string, unknown>[],
        inspections: Record<string, unknown>[]
    ): StaffSummary[] =>
        profileRows.map((profile) => {
            const staffId = profile.id
            const staffLecturePlans = filterByStaff(lecturePlans as { staff_id?: string }[], staffId)
            const staffTests = filterByStaff(tests as { staff_id?: string }[], staffId)
            const staffAssignments = filterByStaff(assignments as { staff_id?: string }[], staffId)
            const staffExtraClasses = filterByStaff(extraClasses as { staff_id?: string }[], staffId)
            const staffTheory = filterByStaff(theoryAssessments as { staff_id?: string }[], staffId)
            const staffPractical = filterByStaff(practicalAssessments as { staff_id?: string }[], staffId)
            const staffWorkload = filterByStaff(workload as { staff_id?: string }[], staffId)
            const staffInspections = filterByStaff(inspections as { staff_id?: string }[], staffId)

            return {
                id: profile.id,
                full_name: profile.full_name || 'N/A',
                email: profile.email || 'N/A',
                department: profile.department_name || profile.department || '-',
                designation: profile.designation_name || profile.designation || '-',
                lecture_plans_total: staffLecturePlans.length,
                lecture_plans_completed: staffLecturePlans.filter((r) => Boolean((r as { actual_completion_date?: string | null }).actual_completion_date)).length,
                tests_count: staffTests.length,
                assignments_count: staffAssignments.length,
                extra_classes_count: staffExtraClasses.length,
                assessments_count: staffTheory.length + staffPractical.length,
                workload_count: staffWorkload.length,
                inspections_count: staffInspections.length,
            }
        })

    const periodFilteredActivity = useMemo(() => {
        if (!activityData) return null

        return {
            ...activityData,
            inspections: filterRecordsByPeriod(
                activityData.inspections as { academic_year?: string | null; semester_type?: string | null }[],
                academicYear,
                semesterType
            ),
            workload: filterRecordsByPeriod(
                activityData.workload as { academic_year?: string | null; semester_type?: string | null }[],
                academicYear,
                semesterType
            ),
        }
    }, [activityData, academicYear, semesterType])

    const data = useMemo<StaffSummary[]>(() => {
        if (!profiles.length || !periodFilteredActivity) return []

        return buildStaffSummary(
            profiles,
            periodFilteredActivity.lecturePlans,
            periodFilteredActivity.tests,
            periodFilteredActivity.assignments,
            periodFilteredActivity.extraClasses,
            periodFilteredActivity.theory,
            periodFilteredActivity.practical,
            periodFilteredActivity.workload,
            periodFilteredActivity.inspections
        )
    }, [profiles, periodFilteredActivity])

    useEffect(() => {
        // Check for admin token
        const token = localStorage.getItem('adminToken')
        if (!token) {
            router.push('/admin-login')
            return
        }

        // Fetch admin details, department list, then data
        const init = async () => {
            const adminDataStr = localStorage.getItem('adminData')
            if (adminDataStr) {
                const localAdminData = JSON.parse(adminDataStr)
                let currentAdminDetails = null

                // 1. Get Admin Details
                const { data, error } = await supabase
                    .from('admins')
                    .select('*')
                    .eq('user_id', localAdminData.UserId.trim())
                    .single()

                if (data) {
                    setAdminDetails(data)
                    currentAdminDetails = data
                } else {
                    currentAdminDetails = {
                        user_id: localAdminData.UserId,
                        dept_mail_id: localAdminData.Deptmailid,
                        department_name: localAdminData.DepartmentName,
                        user_type: localAdminData.UserType,
                    }
                    setAdminDetails(currentAdminDetails)
                }

                const userType = currentAdminDetails?.user_type || localAdminData.UserType
                const adminDept = normalizeDepartmentName(
                    currentAdminDetails?.department_name || localAdminData.DepartmentName
                )
                const deptScoped = isDepartmentScopedAdmin(userType)
                setCanSelectDepartment(!deptScoped)

                if (deptScoped) {
                    // HOD / Supervisor: only their own department
                    const deptList = adminDept ? [adminDept] : []
                    setDepartmentList(deptList)
                    setSelectedDepartment(adminDept)
                    if (adminDept) {
                        fetchData(adminDept)
                    } else {
                        fetchData()
                    }
                } else {
                    // Officers / Admin: all departments in dropdown
                    const { data: profileDepts } = await supabase
                        .from('profiles')
                        .select('department_name')
                    const names = (profileDepts || [])
                        .map((p: { department_name?: string | null }) => normalizeDepartmentName(p.department_name))
                        .filter(Boolean)
                    const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b))
                    setDepartmentList(unique)

                    const defaultDept = unique.includes(adminDept) ? adminDept : (unique[0] || '')
                    setSelectedDepartment(defaultDept)

                    if (defaultDept) {
                        fetchData(defaultDept)
                    } else {
                        fetchData()
                    }
                }
            }
        }

        init()
    }, [])

    useEffect(() => {
        if (selectedStaff?.id && periodFilteredActivity) {
            applyStaffDetails(selectedStaff.id, periodFilteredActivity)
        }
    }, [selectedStaff, periodFilteredActivity])

    const fetchData = async (departmentFilter?: string) => {
        setLoading(true)

        const token = localStorage.getItem('adminToken')
        if (!token) {
            router.push('/admin-login')
            setLoading(false)
            return
        }

        const params = new URLSearchParams()
        if (departmentFilter) {
            params.set('department', departmentFilter)
        }

        try {
            const response = await fetch(`/api/admin/dashboard-data?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            const payload = await response.json()
            if (!response.ok) {
                if (response.status === 401) {
                    alert('Session expired. Please login again.')
                    localStorage.removeItem('adminToken')
                    localStorage.removeItem('adminData')
                    router.push('/login')
                    return
                }
                throw new Error(payload.error || 'Failed to load dashboard data')
            }

            const {
                profiles,
                lecturePlans,
                tests,
                assignments,
                extraClasses,
                theory,
                practical,
                workload,
                inspections,
            } = payload

            setActivityData({
                lecturePlans: lecturePlans || [],
                tests: tests || [],
                assignments: assignments || [],
                extraClasses: extraClasses || [],
                theory: theory || [],
                practical: practical || [],
                workload: workload || [],
                inspections: inspections || [],
            })

            setProfiles(profiles || [])

            const years = getAcademicYearOptions(
                null,
                (inspections || []).map((row: { academic_year?: string | null }) => row.academic_year).filter(Boolean) as string[]
            )
            setAcademicYearOptions(years)
            setAcademicYear((current) => resolveAcademicYear(years, current))
        } catch (error: unknown) {
            console.error('Error fetching dashboard data:', error)
            alert(error instanceof Error ? error.message : 'Failed to load dashboard data')
        } finally {
            setLoading(false)
        }
    }

    const applyStaffDetails = (staffId: string, source = activityData) => {
        if (!source) return

        setStaffDetails({
            lecturePlans: filterByStaff(source.lecturePlans as { staff_id?: string }[], staffId),
            tests: filterByStaff(source.tests as { staff_id?: string }[], staffId),
            assignments: filterByStaff(source.assignments as { staff_id?: string }[], staffId),
            extraClasses: filterByStaff(source.extraClasses as { staff_id?: string }[], staffId),
            theory: filterByStaff(source.theory as { staff_id?: string }[], staffId),
            practical: filterByStaff(source.practical as { staff_id?: string }[], staffId),
            workload: filterByStaff(source.workload as { staff_id?: string }[], staffId),
            inspections: filterByStaff(source.inspections as { staff_id?: string }[], staffId),
        })
    }

    const handleApproveInspection = async (id: string, newStatus: string) => {
        if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return

        setApprovingInspectionId(id)
        try {
            const token = localStorage.getItem('adminToken')
            if (!token) {
                alert('Admin session expired. Please login again.')
                router.push('/login')
                return
            }

            const response = await fetch('/api/admin/update-inspection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, status: newStatus })
            })

            const text = await response.text()
            let data: { error?: string; message?: string } = {}
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('Failed to parse JSON response:', text)
                alert('Server returned invalid response. Check console for details.')
                throw new Error('Invalid JSON response')
            }

            if (!response.ok) {
                if (response.status === 401) {
                    alert(`Session expired: ${data.error || 'Please login again.'}`)
                    localStorage.removeItem('adminToken')
                    localStorage.removeItem('adminData')
                    router.push('/login')
                    return
                }
                throw new Error(data.error || 'Failed to update status')
            }

            alert(`Inspection updated to "${newStatus}" successfully.`)
            await fetchData(selectedDepartment || undefined)
        } catch (error: unknown) {
            console.error('Error updating status:', error)
            alert(error instanceof Error ? error.message : 'Error updating status')
        } finally {
            setApprovingInspectionId(null)
        }
    }

    const handleQuerySubmit = async () => {
        if (!queryComment.trim()) {
            alert('Please enter comments')
            return
        }

        try {
            const token = localStorage.getItem('adminToken')
            if (!token) {
                alert('Admin session expired. Please login again.')
                router.push('/admin-login')
                return
            }

            const response = await fetch('/api/admin/update-inspection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    id: queryId,
                    status: 'Returned',
                    admin_comments: queryComment
                })
            })

            const text = await response.text()
            let data
            try {
                data = JSON.parse(text)
            } catch (e) {
                console.error('Failed to parse JSON response:', text)
                alert('Server returned invalid response. Check console for details.')
                throw new Error('Invalid JSON response')
            }

            if (!response.ok) {
                if (response.status === 401) {
                    alert(`Session expired: ${data.error || 'Unknown error'}. Please login again.`)
                    localStorage.removeItem('adminToken')
                    localStorage.removeItem('adminData')
                    router.push('/admin-login')
                    return
                }
                throw new Error(data.error || 'Failed to submit query')
            }

            setQueryDialogOpen(false)
            setQueryComment('')
            setQueryId(null)
            alert('Query submitted successfully.')
            await fetchData(selectedDepartment || undefined)
        } catch (error: unknown) {
            console.error('Error submitting query:', error)
            alert(error instanceof Error ? error.message : 'Error submitting query')
        }
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
        { accessorKey: 'inspections_count', header: 'Inspections' },
    ]

    // Detailed Columns
    const lecturePlanColumns: ColumnDef<any>[] = [
        { accessorKey: 'staff_name', header: 'Staff Name', cell: () => selectedStaff?.full_name },
        { accessorKey: 'subject', header: 'Subject' },
        { accessorKey: 'period_no', header: 'Period' },
        { accessorKey: 'proposed_date', header: 'Proposed Date', cell: ({ row }) => row.original.proposed_date ? formatInAppTz(row.original.proposed_date, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'topic', header: 'Topic' },
        { accessorKey: 'actual_completion_date', header: 'Actual Date', cell: ({ row }) => row.original.actual_completion_date ? formatInAppTz(row.original.actual_completion_date, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'remarks', header: 'Remarks' },
    ]

    const testColumns: ColumnDef<any>[] = [
        { accessorKey: 'staff_name', header: 'Staff Name', cell: () => selectedStaff?.full_name },
        { accessorKey: 'subject', header: 'Subject' },
        { accessorKey: 'proposed_test_date', header: 'Proposed Date', cell: ({ row }) => row.original.proposed_test_date ? formatInAppTz(row.original.proposed_test_date, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'actual_date', header: 'Actual Date', cell: ({ row }) => row.original.actual_date ? formatInAppTz(row.original.actual_date, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'date_returned', header: 'Returned Date', cell: ({ row }) => row.original.date_returned ? formatInAppTz(row.original.date_returned, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'remarks', header: 'Remarks' },
    ]

    const assignmentColumns: ColumnDef<any>[] = [
        { accessorKey: 'staff_name', header: 'Staff Name', cell: () => selectedStaff?.full_name },
        { accessorKey: 'subject', header: 'Subject' },
        { accessorKey: 'type', header: 'Type' },
        { accessorKey: 'proposed_date', header: 'Proposed Date', cell: ({ row }) => row.original.proposed_date ? formatInAppTz(row.original.proposed_date, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'actual_date', header: 'Actual Date', cell: ({ row }) => row.original.actual_date ? formatInAppTz(row.original.actual_date, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'date_returned', header: 'Returned Date', cell: ({ row }) => row.original.date_returned ? formatInAppTz(row.original.date_returned, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'remarks', header: 'Remarks' },
    ]

    const extraClassColumns: ColumnDef<any>[] = [
        { accessorKey: 'staff_name', header: 'Staff Name', cell: () => selectedStaff?.full_name },
        { accessorKey: 'date', header: 'Date', cell: ({ row }) => row.original.date ? formatInAppTz(row.original.date, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'period', header: 'Period' },
        { accessorKey: 'topic', header: 'Topic' },
        { accessorKey: 'remarks', header: 'Remarks' },
    ]

    const theoryColumns: ColumnDef<any>[] = [
        { accessorKey: 'staff_name', header: 'Staff Name', cell: () => selectedStaff?.full_name },
        { accessorKey: 'student_id', header: 'Student ID' },
        { accessorKey: 'internal_1', header: 'Internal 1' },
        { accessorKey: 'internal_2', header: 'Internal 2' },
        { accessorKey: 'assignment_attendance', header: 'Assignment/Att' },
        { accessorKey: 'total', header: 'Total' },
    ]

    const practicalColumns: ColumnDef<any>[] = [
        { accessorKey: 'staff_name', header: 'Staff Name', cell: () => selectedStaff?.full_name },
        { accessorKey: 'student_id', header: 'Student ID' },
        { accessorKey: 'observations', header: 'Observations' },
        { accessorKey: 'model_test', header: 'Model Test' },
        { accessorKey: 'record_attendance', header: 'Record/Att' },
        { accessorKey: 'total', header: 'Total' },
    ]

    const workloadColumns: ColumnDef<any>[] = [
        { accessorKey: 'staff_name', header: 'Staff Name', cell: () => selectedStaff?.full_name },
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

    const inspectionColumns: ColumnDef<any>[] = [
        { accessorKey: 'staff_name', header: 'Staff Name', cell: () => selectedStaff?.full_name },
        { accessorKey: 'date', header: 'Date', cell: ({ row }) => row.original.date ? formatInAppTz(row.original.date, 'dd/MM/yyyy') : '-' },
        { accessorKey: 'deviations', header: 'Deviations' },
        { accessorKey: 'corrective_action', header: 'Corrective Action' },
        { accessorKey: 'remarks', header: 'Remarks' },
        {
            accessorKey: 'admin_comments',
            header: 'Query / Comments',
            cell: ({ row }) => row.original.admin_comments ? (
                <div className="flex items-center text-red-600 font-medium text-sm max-w-[200px]">
                    <MessageSquare className="w-3 h-3 mr-1 shrink-0" />
                    <span className="truncate" title={row.original.admin_comments}>{row.original.admin_comments}</span>
                </div>
            ) : '-'
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status || 'Pending'
                const displayStatus = getInspectionDisplayStatus(status, !canSelectDepartment)
                return (
                    <Badge variant={
                        status === 'Submitted' ? 'secondary' :
                            status === 'HOD Approved' ? 'default' :
                                status === 'Dean Approved' ? 'outline' :
                                    status === 'Returned' ? 'destructive' : 'outline'
                    } className={
                        status === 'Submitted' ? 'bg-yellow-100 text-yellow-800' :
                            status === 'HOD Approved' ? 'bg-indigo-100 text-indigo-800' :
                                status === 'Dean Approved' ? 'bg-green-100 text-green-800' :
                                    status === 'Returned' ? 'bg-red-100 text-red-800' : ''
                    }>
                        {displayStatus}
                    </Badge>
                )
            }
        },
        {
            id: 'actions',
            header: 'Approvals',
            cell: ({ row }) => {
                const status = row.original.status
                if (status === 'Submitted') {
                    const busy = approvingInspectionId === row.original.id
                    return (
                        <div className="flex gap-2 flex-wrap">
                            <Button
                                type="button"
                                size="sm"
                                disabled={!!approvingInspectionId}
                                onClick={() => handleApproveInspection(row.original.id, 'HOD Approved')}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                                HOD Verify
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!!approvingInspectionId}
                                onClick={() => { setQueryId(row.original.id); setQueryDialogOpen(true); }}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                                <MessageSquare className="w-3 h-3 mr-1" /> Query
                            </Button>
                        </div>
                    )
                }
                if (status === 'HOD Approved' && canSelectDepartment) {
                    const busy = approvingInspectionId === row.original.id
                    return (
                        <div className="flex gap-2 flex-wrap">
                            <Button
                                type="button"
                                size="sm"
                                disabled={!!approvingInspectionId}
                                onClick={() => handleApproveInspection(row.original.id, 'Dean Approved')}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                                Dean Approve
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!!approvingInspectionId}
                                onClick={() => { setQueryId(row.original.id); setQueryDialogOpen(true); }}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                                <MessageSquare className="w-3 h-3 mr-1" /> Query
                            </Button>
                        </div>
                    )
                }
                return null
            }
        }
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
                        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 h-auto">
                            <TabsTrigger value="lecture-plans">Lecture Plans</TabsTrigger>
                            <TabsTrigger value="tests">Tests</TabsTrigger>
                            <TabsTrigger value="assignments">Assignments</TabsTrigger>
                            <TabsTrigger value="extra-classes">Extra Classes</TabsTrigger>
                            <TabsTrigger value="assessments">Assessments</TabsTrigger>
                            <TabsTrigger value="workload">Workload</TabsTrigger>
                            <TabsTrigger value="inspections">Inspections</TabsTrigger>
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

                        <TabsContent value="inspections" className="mt-6">
                            <Card>
                                <CardHeader><CardTitle>Inspections & Approvals</CardTitle></CardHeader>
                                <CardContent>
                                    <DataTable columns={inspectionColumns} data={staffDetails.inspections} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}

                <Dialog open={queryDialogOpen} onOpenChange={setQueryDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Raise Query</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="query" className="mb-2 block">Query / Comment</Label>
                            <Input
                                id="query"
                                value={queryComment}
                                onChange={(e) => setQueryComment(e.target.value)}
                                placeholder="Enter your query here..."
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setQueryDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleQuerySubmit} disabled={!queryComment}>Send Query</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {adminDetails && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-blue-900">Welcome, {adminDetails.user_id}</h2>
                                <p className="text-blue-700">{adminDetails.department_name}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-blue-600 bg-white/50 px-3 py-1 rounded-full border border-blue-200">
                                <span className="font-medium">Email:</span> {adminDetails.dept_mail_id}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h1 className="text-4xl font-extrabold tracking-tight">Admin Dashboard</h1>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="academic-year-select" className="text-sm font-medium">Academic Year</Label>
                            <Select value={academicYear} onValueChange={setAcademicYear}>
                                <SelectTrigger id="academic-year-select" className="w-[140px] bg-background">
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {academicYearOptions.map((year) => (
                                        <SelectItem key={year} value={year}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="semester-select" className="text-sm font-medium">Semester</Label>
                            <Select value={semesterType} onValueChange={setSemesterType}>
                                <SelectTrigger id="semester-select" className="w-[100px] bg-background">
                                    <SelectValue placeholder="Semester" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Odd">Odd</SelectItem>
                                    <SelectItem value="Even">Even</SelectItem>
                                    <SelectItem value="All">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="dept-select" className="text-sm font-medium">Department</Label>
                            {canSelectDepartment ? (
                                <Select
                                    value={selectedDepartment || '__ALL__'}
                                    onValueChange={(value) => {
                                        const dept = value === '__ALL__' ? '' : value
                                        setSelectedDepartment(dept)
                                        if (dept) fetchData(dept)
                                        else fetchData()
                                    }}
                                >
                                    <SelectTrigger id="dept-select" className="w-[280px] bg-background">
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__ALL__">All departments</SelectItem>
                                        {departmentList.map((name) => (
                                            <SelectItem key={name} value={name}>
                                                {name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div
                                    id="dept-select"
                                    className="min-w-[280px] rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium"
                                >
                                    {selectedDepartment || normalizeDepartmentName(adminDetails?.department_name) || '—'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    Showing inspection and workload data for Academic Year <span className="font-medium">{academicYear}</span>,{' '}
                    <span className="font-medium">{semesterType}</span> semester.
                </p>
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

            {periodFilteredActivity && (
                <InspectionSubmissionReport
                    staffList={data}
                    inspections={periodFilteredActivity.inspections as { staff_id?: string; date?: string; status?: string | null; academic_year?: string | null; semester_type?: string | null }[]}
                    departmentLabel={selectedDepartment || normalizeDepartmentName(adminDetails?.department_name) || 'department'}
                    academicYear={academicYear}
                    semesterType={semesterType}
                    isHodView={!canSelectDepartment}
                />
            )}

            <div className="rounded-md border bg-card text-card-foreground shadow-sm">
                <DataTable columns={summaryColumns} data={data} />
            </div>
        </div>
    )
}
