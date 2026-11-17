'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Loader2,
    Download,
    Printer,
    CheckCircle2,
    XCircle,
    Building2,
    ListChecks,
    BarChart3,
    FileSpreadsheet,
} from 'lucide-react'
import {
    DEFAULT_ACADEMIC_YEAR,
    DEFAULT_SEMESTER_TYPE,
    filterRecordsByPeriod,
    getAcademicYearOptions,
} from '@/lib/academic-years'
import {
    buildInspectionReport,
    type InspectionReportStaff,
} from '@/components/admin/InspectionSubmissionReport'
import { formatInAppTz } from '@/lib/datetime'
import { cn } from '@/lib/utils'

type ReportType =
    | 'completed'
    | 'not_completed'
    | 'status_wise'
    | 'department_wise'
    | 'staff_detail'

type ProfileRow = {
    id: string
    full_name?: string | null
    department_name?: string | null
    department?: string | null
    designation_name?: string | null
    designation?: string | null
}

type InspectionRow = {
    staff_id?: string
    date?: string
    status?: string | null
    academic_year?: string | null
    semester_type?: string | null
}

const REPORT_TYPES: {
    id: ReportType
    title: string
    description: string
    icon: typeof CheckCircle2
}[] = [
    {
        id: 'completed',
        title: 'Completed',
        description: 'Staff who submitted inspection for the selected period',
        icon: CheckCircle2,
    },
    {
        id: 'not_completed',
        title: 'Not Completed',
        description: 'Staff who have not submitted inspection yet',
        icon: XCircle,
    },
    {
        id: 'status_wise',
        title: 'Status-wise',
        description: 'Breakup by Submitted / HOD / Dean / Returned',
        icon: ListChecks,
    },
    {
        id: 'department_wise',
        title: 'Department-wise',
        description: 'Completion summary across all departments',
        icon: Building2,
    },
    {
        id: 'staff_detail',
        title: 'Staff Detail',
        description: 'Full staff list with inspection status',
        icon: FileSpreadsheet,
    },
]

function normalizeDepartmentName(name?: string | null) {
    return (name || '').replace(/,\s*$/, '').trim()
}

function isDepartmentScopedAdmin(userType?: string | null) {
    const type = (userType || '').trim()
    return /^(supervisor|hod)$/i.test(type)
}

function statusBadgeClass(status: string) {
    if (status === 'Submitted') return 'bg-yellow-100 text-yellow-800'
    if (status === 'HOD Approved') return 'bg-indigo-100 text-indigo-800'
    if (status === 'Dean Approved') return 'bg-green-100 text-green-800'
    if (status === 'Returned') return 'bg-red-100 text-red-800'
    return 'bg-slate-100 text-slate-700'
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
    const csv = [header, ...rows]
        .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}

export default function OfficerReportsPage() {
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [adminDetails, setAdminDetails] = useState<any>(null)
    const [canSelectDepartment, setCanSelectDepartment] = useState(false)
    const [departmentList, setDepartmentList] = useState<string[]>([])
    const [selectedDepartment, setSelectedDepartment] = useState('ALL')
    const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR)
    const [semesterType, setSemesterType] = useState(DEFAULT_SEMESTER_TYPE)
    const [yearOptions, setYearOptions] = useState<string[]>([DEFAULT_ACADEMIC_YEAR])
    const [reportType, setReportType] = useState<ReportType>('completed')
    const [search, setSearch] = useState('')

    const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([])
    const [allInspections, setAllInspections] = useState<InspectionRow[]>([])

    useEffect(() => {
        const token = localStorage.getItem('adminToken')
        if (!token) {
            router.push('/officer-login')
            return
        }
        void init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const init = async () => {
        setLoading(true)
        try {
            const adminDataStr = localStorage.getItem('adminData')
            if (!adminDataStr) {
                router.push('/officer-login')
                return
            }

            const localAdminData = JSON.parse(adminDataStr)
            const { data } = await supabase
                .from('admins')
                .select('*')
                .eq('user_id', localAdminData.UserId.trim())
                .single()

            const currentAdmin = data || {
                user_id: localAdminData.UserId,
                dept_mail_id: localAdminData.Deptmailid,
                department_name: localAdminData.DepartmentName,
                user_type: localAdminData.UserType,
            }
            setAdminDetails(currentAdmin)

            const userType = currentAdmin?.user_type || localAdminData.UserType
            const adminDept = normalizeDepartmentName(
                currentAdmin?.department_name || localAdminData.DepartmentName
            )
            const deptScoped = isDepartmentScopedAdmin(userType)
            setCanSelectDepartment(!deptScoped)

            const token = localStorage.getItem('adminToken')
            if (!token) return

            // Officers: load all departments for department-wise reports
            const response = await fetch('/api/admin/dashboard-data', {
                headers: { Authorization: `Bearer ${token}` },
            })
            const payload = await response.json()
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('adminToken')
                    localStorage.removeItem('adminData')
                    router.push('/officer-login')
                    return
                }
                throw new Error(payload.error || 'Failed to load report data')
            }

            const profiles: ProfileRow[] = payload.profiles || []
            const inspections: InspectionRow[] = payload.inspections || []
            setAllProfiles(profiles)
            setAllInspections(inspections)

            const years = getAcademicYearOptions(
                null,
                inspections.map((row) => row.academic_year).filter(Boolean) as string[]
            )
            setYearOptions(years)

            if (deptScoped) {
                const deptList = adminDept ? [adminDept] : []
                setDepartmentList(deptList)
                setSelectedDepartment(adminDept || 'ALL')
            } else {
                const names = profiles
                    .map((p) => normalizeDepartmentName(p.department_name || p.department))
                    .filter(Boolean)
                const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b))
                setDepartmentList(unique)
                setSelectedDepartment('ALL')
            }
        } catch (error) {
            console.error('Reports init failed:', error)
            alert(error instanceof Error ? error.message : 'Failed to load reports')
        } finally {
            setLoading(false)
        }
    }

    const periodInspections = useMemo(
        () => filterRecordsByPeriod(allInspections, academicYear, semesterType),
        [allInspections, academicYear, semesterType]
    )

    const staffForDepartment = useMemo(() => {
        return allProfiles
            .filter((p) => {
                if (selectedDepartment === 'ALL') return true
                return (
                    normalizeDepartmentName(p.department_name || p.department) ===
                    selectedDepartment
                )
            })
            .map((p) => ({
                id: p.id,
                full_name: p.full_name || 'Unknown',
                designation: p.designation_name || p.designation || '-',
                department: normalizeDepartmentName(p.department_name || p.department) || '-',
            }))
    }, [allProfiles, selectedDepartment])

    const { staffRows, stats } = useMemo(
        () => buildInspectionReport(staffForDepartment, periodInspections),
        [staffForDepartment, periodInspections]
    )

    const filteredStaffRows = useMemo(() => {
        let rows = staffRows
        if (reportType === 'completed') {
            rows = rows.filter((r) => r.inspectionStatus !== 'Not Submitted')
        } else if (reportType === 'not_completed') {
            rows = rows.filter((r) => r.inspectionStatus === 'Not Submitted')
        }

        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter(
            (r) =>
                r.full_name.toLowerCase().includes(q) ||
                r.department.toLowerCase().includes(q) ||
                r.designation.toLowerCase().includes(q) ||
                r.inspectionStatus.toLowerCase().includes(q)
        )
    }, [staffRows, reportType, search])

    const departmentSummary = useMemo(() => {
        const byDept = new Map<string, ProfileRow[]>()
        for (const profile of allProfiles) {
            const dept = normalizeDepartmentName(profile.department_name || profile.department) || 'Unknown'
            if (selectedDepartment !== 'ALL' && dept !== selectedDepartment) continue
            const list = byDept.get(dept) || []
            list.push(profile)
            byDept.set(dept, list)
        }

        return Array.from(byDept.entries())
            .map(([department, profiles]) => {
                const staff = profiles.map((p) => ({
                    id: p.id,
                    full_name: p.full_name || 'Unknown',
                    designation: p.designation_name || p.designation || '-',
                    department,
                }))
                const { stats: deptStats } = buildInspectionReport(staff, periodInspections)
                return {
                    department,
                    ...deptStats,
                    completionPct: deptStats.total
                        ? Math.round((deptStats.submittedTotal / deptStats.total) * 100)
                        : 0,
                }
            })
            .sort((a, b) => a.department.localeCompare(b.department))
    }, [allProfiles, periodInspections, selectedDepartment])

    const statusGroups = useMemo(() => {
        const groups: Record<string, InspectionReportStaff[]> = {
            'Not Submitted': [],
            Submitted: [],
            'HOD Approved': [],
            'Dean Approved': [],
            Returned: [],
        }
        for (const row of staffRows) {
            const key = groups[row.inspectionStatus] ? row.inspectionStatus : 'Not Submitted'
            groups[key].push(row)
        }
        return groups
    }, [staffRows])

    const exportCurrentReport = () => {
        const stamp = `${academicYear}-${semesterType}`
        const deptLabel =
            selectedDepartment === 'ALL' ? 'all-departments' : selectedDepartment

        if (reportType === 'department_wise') {
            downloadCsv(
                `department-wise-report-${stamp}.csv`,
                [
                    'Department',
                    'Total Staff',
                    'Completed (Submitted)',
                    'Not Completed',
                    'Pending HOD',
                    'HOD Approved',
                    'Dean Approved',
                    'Returned',
                    'Completion %',
                ],
                departmentSummary.map((d) => [
                    d.department,
                    String(d.total),
                    String(d.submittedTotal),
                    String(d.notSubmitted),
                    String(d.pendingHod),
                    String(d.hodApproved),
                    String(d.deanApproved),
                    String(d.returned),
                    String(d.completionPct),
                ])
            )
            return
        }

        if (reportType === 'status_wise') {
            const rows: string[][] = []
            Object.entries(statusGroups).forEach(([status, list]) => {
                list.forEach((r) => {
                    rows.push([
                        status,
                        r.full_name,
                        r.designation,
                        r.department,
                        r.inspectionDate
                            ? formatInAppTz(r.inspectionDate, 'dd/MM/yyyy')
                            : '-',
                    ])
                })
            })
            downloadCsv(
                `status-wise-report-${deptLabel}-${stamp}.csv`,
                ['Status', 'Staff Name', 'Designation', 'Department', 'Inspection Date'],
                rows
            )
            return
        }

        const title =
            reportType === 'completed'
                ? 'completed'
                : reportType === 'not_completed'
                  ? 'not-completed'
                  : 'staff-detail'

        downloadCsv(
            `${title}-report-${deptLabel}-${stamp}.csv`,
            ['Staff Name', 'Designation', 'Department', 'Inspection Date', 'Status'],
            filteredStaffRows.map((r) => [
                r.full_name,
                r.designation,
                r.department,
                r.inspectionDate ? formatInAppTz(r.inspectionDate, 'dd/MM/yyyy') : '-',
                r.inspectionStatus,
            ])
        )
    }

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8 space-y-6 print:py-2">
            <div className="flex flex-col gap-2 print:hidden">
                <div className="flex items-center gap-2 text-blue-900">
                    <BarChart3 className="h-7 w-7" />
                    <h1 className="text-3xl font-bold tracking-tight">Officer Reports</h1>
                </div>
                <p className="text-gray-500">
                    Generate completed / not completed and department-wise inspection reports
                    {adminDetails?.user_id ? ` for ${adminDetails.user_id}` : ''}.
                </p>
            </div>

            <Card className="print:hidden border-t-4 border-t-indigo-500 shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Filters</CardTitle>
                    <CardDescription>
                        Choose academic period and department, then select a report type.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Academic Year</label>
                        <Select value={academicYear} onValueChange={setAcademicYear}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {yearOptions.map((year) => (
                                    <SelectItem key={year} value={year}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Semester</label>
                        <Select value={semesterType} onValueChange={setSemesterType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Odd">Odd</SelectItem>
                                <SelectItem value="Even">Even</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Department</label>
                        <Select
                            value={selectedDepartment}
                            onValueChange={setSelectedDepartment}
                            disabled={!canSelectDepartment && selectedDepartment !== 'ALL'}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                                {canSelectDepartment && (
                                    <SelectItem value="ALL">All Departments</SelectItem>
                                )}
                                {departmentList.map((dept) => (
                                    <SelectItem key={dept} value={dept}>
                                        {dept}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 print:hidden">
                {REPORT_TYPES.map((item) => {
                    const Icon = item.icon
                    const active = reportType === item.id
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setReportType(item.id)}
                            className={cn(
                                'text-left rounded-xl border p-4 transition-all shadow-sm hover:shadow-md',
                                active
                                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                    : 'border-slate-200 bg-white hover:border-indigo-200'
                            )}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Icon
                                    className={cn(
                                        'h-5 w-5',
                                        active ? 'text-indigo-700' : 'text-slate-500'
                                    )}
                                />
                                <span className="font-semibold text-slate-900">{item.title}</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                {item.description}
                            </p>
                        </button>
                    )
                })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-sm font-medium text-white/90">Total Staff</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-sm font-medium text-white/90">Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.submittedTotal}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-slate-500 to-slate-600 text-white border-none">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-sm font-medium text-white/90">Not Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.notSubmitted}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-sm font-medium text-white/90">Pending HOD</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.pendingHod}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-none">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-sm font-medium text-white/90">Dean Approved</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.deanApproved}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-md">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>
                            {REPORT_TYPES.find((r) => r.id === reportType)?.title} Report
                        </CardTitle>
                        <CardDescription>
                            {academicYear} · {semesterType} semester
                            {selectedDepartment !== 'ALL' ? ` · ${selectedDepartment}` : ' · All Departments'}
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 print:hidden">
                        {(reportType === 'completed' ||
                            reportType === 'not_completed' ||
                            reportType === 'staff_detail') && (
                            <Input
                                placeholder="Search staff..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-[200px]"
                            />
                        )}
                        <Button type="button" variant="outline" onClick={exportCurrentReport}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button type="button" variant="outline" onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {reportType === 'department_wise' ? (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Department</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Completed</TableHead>
                                        <TableHead className="text-right">Not Completed</TableHead>
                                        <TableHead className="text-right">Pending HOD</TableHead>
                                        <TableHead className="text-right">HOD Approved</TableHead>
                                        <TableHead className="text-right">Dean Approved</TableHead>
                                        <TableHead className="text-right">Returned</TableHead>
                                        <TableHead className="text-right">Completion %</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {departmentSummary.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                                No department data found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        departmentSummary.map((row) => (
                                            <TableRow key={row.department}>
                                                <TableCell className="font-medium">{row.department}</TableCell>
                                                <TableCell className="text-right">{row.total}</TableCell>
                                                <TableCell className="text-right text-emerald-700 font-semibold">
                                                    {row.submittedTotal}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-700 font-semibold">
                                                    {row.notSubmitted}
                                                </TableCell>
                                                <TableCell className="text-right">{row.pendingHod}</TableCell>
                                                <TableCell className="text-right">{row.hodApproved}</TableCell>
                                                <TableCell className="text-right">{row.deanApproved}</TableCell>
                                                <TableCell className="text-right">{row.returned}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {row.completionPct}%
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    ) : reportType === 'status_wise' ? (
                        <div className="space-y-6">
                            {Object.entries(statusGroups).map(([status, list]) => (
                                <div key={status} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge className={statusBadgeClass(status)}>{status}</Badge>
                                            <span className="text-sm text-muted-foreground">
                                                {list.length} staff
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Staff Name</TableHead>
                                                    <TableHead>Designation</TableHead>
                                                    <TableHead>Department</TableHead>
                                                    <TableHead>Inspection Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {list.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={4}
                                                            className="text-center text-muted-foreground py-4"
                                                        >
                                                            No staff in this status.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    list.map((row) => (
                                                        <TableRow key={`${status}-${row.id}`}>
                                                            <TableCell className="font-medium">
                                                                {row.full_name}
                                                            </TableCell>
                                                            <TableCell>{row.designation}</TableCell>
                                                            <TableCell>{row.department}</TableCell>
                                                            <TableCell>
                                                                {row.inspectionDate
                                                                    ? formatInAppTz(
                                                                          row.inspectionDate,
                                                                          'dd/MM/yyyy'
                                                                      )
                                                                    : '-'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Staff Name</TableHead>
                                        <TableHead>Designation</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Inspection Date</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStaffRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="text-center text-muted-foreground py-8"
                                            >
                                                No matching staff found for this report.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredStaffRows.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell className="font-medium">{row.full_name}</TableCell>
                                                <TableCell>{row.designation}</TableCell>
                                                <TableCell>{row.department}</TableCell>
                                                <TableCell>
                                                    {row.inspectionDate
                                                        ? formatInAppTz(row.inspectionDate, 'dd/MM/yyyy')
                                                        : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={statusBadgeClass(row.inspectionStatus)}>
                                                        {row.inspectionStatus}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
