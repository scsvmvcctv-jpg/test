'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, ClipboardList } from 'lucide-react'
import { formatInAppTz } from '@/lib/datetime'

type StaffRow = {
    id: string
    full_name: string
    designation: string
    department: string
}

type InspectionRecord = {
    staff_id?: string
    date?: string
    status?: string | null
}

export type InspectionReportStaff = StaffRow & {
    inspectionStatus: string
    inspectionDate?: string
}

export type InspectionReportStats = {
    total: number
    notSubmitted: number
    submitted: number
    hodApproved: number
    deanApproved: number
    returned: number
    submittedTotal: number
    pendingHod: number
}

const STATUS_COLORS: Record<string, string> = {
    'Not Submitted': '#94a3b8',
    Submitted: '#f59e0b',
    'HOD Approved': '#3b82f6',
    'Pending Dean': '#6366f1',
    'Dean Approved': '#22c55e',
    Returned: '#ef4444',
}

function getReportDisplayStatus(status: string, isHodView: boolean) {
    if (isHodView && status === 'HOD Approved') return 'Pending Dean'
    return status
}

export function buildInspectionReport(
    staffList: StaffRow[],
    inspections: InspectionRecord[]
): { staffRows: InspectionReportStaff[]; stats: InspectionReportStats } {
    const byStaff = new Map<string, InspectionRecord[]>()

    for (const inspection of inspections) {
        const staffId = inspection.staff_id
        if (!staffId) continue
        const list = byStaff.get(staffId) || []
        list.push(inspection)
        byStaff.set(staffId, list)
    }

    const staffRows: InspectionReportStaff[] = staffList.map((staff) => {
        const staffInspections = (byStaff.get(staff.id) || []).sort((a, b) =>
            String(b.date || '').localeCompare(String(a.date || ''))
        )
        const latest = staffInspections[0]
        const rawStatus = latest?.status?.trim() || ''
        const inspectionStatus =
            !latest || !rawStatus || rawStatus === 'Pending' ? 'Not Submitted' : rawStatus

        return {
            ...staff,
            inspectionStatus,
            inspectionDate: latest?.date,
        }
    })

    const stats: InspectionReportStats = {
        total: staffList.length,
        notSubmitted: staffRows.filter((s) => s.inspectionStatus === 'Not Submitted').length,
        submitted: staffRows.filter((s) => s.inspectionStatus === 'Submitted').length,
        hodApproved: staffRows.filter((s) => s.inspectionStatus === 'HOD Approved').length,
        deanApproved: staffRows.filter((s) => s.inspectionStatus === 'Dean Approved').length,
        returned: staffRows.filter((s) => s.inspectionStatus === 'Returned').length,
        submittedTotal: staffRows.filter((s) => s.inspectionStatus !== 'Not Submitted').length,
        pendingHod: staffRows.filter((s) => s.inspectionStatus === 'Submitted').length,
    }

    return { staffRows, stats }
}

function StatusBadge({ status, isHodView = false }: { status: string; isHodView?: boolean }) {
    const displayStatus = getReportDisplayStatus(status, isHodView)
    const className =
        status === 'Submitted'
            ? 'bg-yellow-100 text-yellow-800'
            : status === 'HOD Approved'
              ? 'bg-indigo-100 text-indigo-800'
              : status === 'Dean Approved'
                ? 'bg-green-100 text-green-800'
                : status === 'Returned'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-slate-100 text-slate-700'

    return <Badge className={className}>{displayStatus}</Badge>
}

function DonutChart({ stats, isHodView = false }: { stats: InspectionReportStats; isHodView?: boolean }) {
    const hodLabel = isHodView ? 'Pending Dean' : 'HOD Approved'
    const segments = [
        { key: 'Not Submitted', value: stats.notSubmitted, color: STATUS_COLORS['Not Submitted'] },
        { key: 'Submitted', value: stats.submitted, color: STATUS_COLORS.Submitted },
        { key: hodLabel, value: stats.hodApproved, color: isHodView ? STATUS_COLORS['Pending Dean'] : STATUS_COLORS['HOD Approved'] },
        { key: 'Dean Approved', value: stats.deanApproved, color: STATUS_COLORS['Dean Approved'] },
        { key: 'Returned', value: stats.returned, color: STATUS_COLORS.Returned },
    ].filter((s) => s.value > 0)

    if (stats.total === 0) {
        return <p className="text-sm text-muted-foreground py-8 text-center">No staff data available.</p>
    }

    let cumulative = 0
    const gradientParts = segments.map((segment) => {
        const start = (cumulative / stats.total) * 100
        cumulative += segment.value
        const end = (cumulative / stats.total) * 100
        return `${segment.color} ${start}% ${end}%`
    })

    const submittedPct = stats.total ? Math.round((stats.submittedTotal / stats.total) * 100) : 0

    return (
        <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative h-44 w-44 shrink-0">
                <div
                    className="h-full w-full rounded-full"
                    style={{
                        background:
                            gradientParts.length > 0
                                ? `conic-gradient(${gradientParts.join(', ')})`
                                : '#e2e8f0',
                    }}
                />
                <div className="absolute inset-5 rounded-full bg-card flex flex-col items-center justify-center text-center shadow-inner">
                    <span className="text-3xl font-bold">{submittedPct}%</span>
                    <span className="text-xs text-muted-foreground px-2">Submitted</span>
                </div>
            </div>

            <div className="flex-1 space-y-3 w-full">
                {segments.map((segment) => (
                    <div key={segment.key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span
                                    className="inline-block h-3 w-3 rounded-full"
                                    style={{ backgroundColor: segment.color }}
                                />
                                <span>{segment.key}</span>
                            </div>
                            <span className="font-semibold">
                                {segment.value} ({Math.round((segment.value / stats.total) * 100)}%)
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${(segment.value / stats.total) * 100}%`,
                                    backgroundColor: segment.color,
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function exportReportCsv(
    staffRows: InspectionReportStaff[],
    departmentLabel: string,
    academicYear?: string,
    semesterType?: string
) {
    const header = ['Staff Name', 'Designation', 'Department', 'Inspection Date', 'Status']
    const rows = staffRows.map((row) => [
        row.full_name,
        row.designation,
        row.department,
        row.inspectionDate ? formatInAppTz(row.inspectionDate, 'dd/MM/yyyy') : '-',
        row.inspectionStatus,
    ])

    const csv = [header, ...rows]
        .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inspection-submission-report-${departmentLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${academicYear ? `-${academicYear}` : ''}${semesterType ? `-${semesterType}` : ''}.csv`
    link.click()
    URL.revokeObjectURL(url)
}

type InspectionSubmissionReportProps = {
    staffList: StaffRow[]
    inspections: InspectionRecord[]
    departmentLabel?: string
    academicYear?: string
    semesterType?: string
    isHodView?: boolean
}

export function InspectionSubmissionReport({
    staffList,
    inspections,
    departmentLabel = 'department',
    academicYear,
    semesterType,
    isHodView = false,
}: InspectionSubmissionReportProps) {
    const { staffRows, stats } = useMemo(
        () => buildInspectionReport(staffList, inspections),
        [staffList, inspections]
    )

    const summaryCards = [
        { label: 'Total Staff', value: stats.total, className: 'from-blue-500 to-blue-600' },
        { label: 'Submitted for Inspection', value: stats.submittedTotal, className: 'from-emerald-500 to-emerald-600' },
        { label: 'Pending HOD Review', value: stats.pendingHod, className: 'from-amber-500 to-amber-600' },
        { label: isHodView ? 'Pending Dean' : 'HOD Approved', value: stats.hodApproved, className: 'from-indigo-500 to-indigo-600' },
        { label: 'Not Submitted', value: stats.notSubmitted, className: 'from-slate-500 to-slate-600' },
    ]

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {summaryCards.map((card) => (
                    <Card key={card.label} className={`bg-gradient-to-br ${card.className} text-white border-none shadow-lg`}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-white/90">{card.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{card.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Inspection Submission Chart</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DonutChart stats={stats} isHodView={isHodView} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Submission Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Staff submitted for inspection</span>
                                <span className="font-semibold">
                                    {stats.submittedTotal} / {stats.total}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Awaiting HOD verification</span>
                                <span className="font-semibold text-amber-700">{stats.pendingHod}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{isHodView ? 'Pending Dean approval' : 'HOD approved (pending Dean)'}</span>
                                <span className="font-semibold text-indigo-700">{stats.hodApproved}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Fully approved (Dean)</span>
                                <span className="font-semibold text-green-700">{stats.deanApproved}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Returned with query</span>
                                <span className="font-semibold text-red-700">{stats.returned}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span>Not yet submitted</span>
                                <span className="font-semibold text-slate-700">{stats.notSubmitted}</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Status is based on each staff member&apos;s latest inspection record
                            {academicYear ? ` for ${academicYear}` : ''}
                            {semesterType ? ` (${semesterType} semester)` : ''}.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                        <CardTitle>Staff Inspection Submission Report</CardTitle>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            exportReportCsv(
                                staffRows.map((row) => ({
                                    ...row,
                                    inspectionStatus: getReportDisplayStatus(row.inspectionStatus, isHodView),
                                })),
                                departmentLabel,
                                academicYear,
                                semesterType
                            )
                        }
                        disabled={staffRows.length === 0}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Staff Name</th>
                                    <th className="px-4 py-3 text-left font-medium">Designation</th>
                                    <th className="px-4 py-3 text-left font-medium">Inspection Date</th>
                                    <th className="px-4 py-3 text-left font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                            No staff records found.
                                        </td>
                                    </tr>
                                ) : (
                                    staffRows.map((row) => (
                                        <tr key={row.id} className="border-t">
                                            <td className="px-4 py-3 font-medium">{row.full_name}</td>
                                            <td className="px-4 py-3">{row.designation}</td>
                                            <td className="px-4 py-3">
                                                {row.inspectionDate
                                                    ? formatInAppTz(row.inspectionDate, 'dd/MM/yyyy')
                                                    : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={row.inspectionStatus} isHodView={isHodView} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
