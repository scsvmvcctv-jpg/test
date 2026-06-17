'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Pencil, Trash2, Send, AlertCircle } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { formatInAppTz } from '@/lib/datetime'
import { SignatureUploader } from '@/components/SignatureUploader'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
    getDeanApprovalDisplay,
    getHodApprovalDisplay,
    getStaffInspectionStatusDisplay,
} from '@/lib/inspection-status'
import { fetchFilterOptions } from '@/app/actions/assessment'
import {
    DEFAULT_ACADEMIC_YEAR,
    DEFAULT_SEMESTER_TYPE,
    getAcademicYearOptions,
    resolveAcademicYear,
} from '@/lib/academic-years'
import { isLogbookLockedForPeriod } from '@/lib/inspection-lock'

type Inspection = {
    id: string
    date: string
    deviations: string
    corrective_action: string
    remarks: string
    hod_initial_url: string
    dean_initial_url: string
    status: string
    admin_comments?: string
    academic_year?: string | null
    semester_type?: string | null
}

export default function InspectionsPage() {
    const [data, setData] = useState<Inspection[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<Inspection> | null>(null)
    const [open, setOpen] = useState(false)
    const [submitResult, setSubmitResult] = useState<{
        id: string
        name: string
        academicYear: string
        semesterType: string
    } | null>(null)
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)
    const supabase = createClient()

    const [academicYear, setAcademicYear] = useState<string>(DEFAULT_ACADEMIC_YEAR)
    const [academicYearOptions, setAcademicYearOptions] = useState<string[]>([DEFAULT_ACADEMIC_YEAR])
    const [semesterType, setSemesterType] = useState<string>(DEFAULT_SEMESTER_TYPE)

    useEffect(() => {
        initializePage()
    }, [])

    const initializePage = async () => {
        setLoading(true)
        const filterResult = await fetchFilterOptions()
        if (filterResult.success && filterResult.data) {
            const years = getAcademicYearOptions(filterResult.data)
            setAcademicYearOptions(years)
            setAcademicYear((current) => resolveAcademicYear(years, current))
        }
        await fetchData()
    }

    const fetchData = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('inspections')
            .select('*')
            .eq('staff_id', user.id)
            .order('date', { ascending: false })

        if (data) {
            setData(data)
            const years = getAcademicYearOptions(
                null,
                data.map((row) => row.academic_year).filter(Boolean) as string[]
            )
            setAcademicYearOptions((prev) => {
                const merged = [...new Set([...prev, ...years])].sort((a, b) => b.localeCompare(a))
                return merged.length ? merged : prev
            })
        }
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const item = {
            ...editingItem,
            staff_id: user.id,
            academic_year: editingItem?.academic_year || academicYear,
            semester_type: editingItem?.semester_type || semesterType,
            status: (editingItem?.status === 'Returned') ? 'Pending' : (editingItem?.status || 'Pending'),
        }

        let error
        if (item.id) {
            const { error: updateError } = await supabase.from('inspections').update(item).eq('id', item.id)
            error = updateError
        } else {
            const { error: insertError } = await supabase.from('inspections').insert(item)
            error = insertError
        }

        if (!error) {
            setOpen(false)
            fetchData()
        } else {
            alert('Error saving data')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return
        const { error } = await supabase.from('inspections').delete().eq('id', id)
        if (!error) fetchData()
    }

    const handleSubmitToHod = async () => {
        if (!submitResult) return

        const { error } = await supabase
            .from('inspections')
            .update({
                status: 'Submitted',
                academic_year: submitResult.academicYear,
                semester_type: submitResult.semesterType,
            })
            .eq('id', submitResult.id)

        if (!error) {
            fetchData()
            setConfirmSubmitOpen(false)
            setSubmitResult(null)
        } else {
            alert('Error submitting to HOD')
        }
    }

    const getStatusBadge = (status: string) => {
        const display = getStaffInspectionStatusDisplay(status)
        return <Badge className={display.className}>{display.label}</Badge>
    }

    const getApprovalBadge = (display: { label: string; className: string }) => (
        <Badge className={display.className}>{display.label}</Badge>
    )

    const renderInitialCell = (signatureUrl: string | null | undefined, display: { label: string; className: string }) => (
        <div className="flex flex-col gap-1 min-w-[100px]">
            {getApprovalBadge(display)}
            {signatureUrl ? (
                <img src={signatureUrl} alt="Signature" className="h-8 w-auto object-contain" />
            ) : null}
        </div>
    )

    const columns: ColumnDef<Inspection>[] = [
        {
            accessorKey: 'academic_year',
            header: 'Academic Year',
            cell: ({ row }) => row.original.academic_year || '-'
        },
        {
            accessorKey: 'semester_type',
            header: 'Semester',
            cell: ({ row }) => row.original.semester_type || '-'
        },
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ row }) => row.original.date ? formatInAppTz(row.original.date, 'dd/MM/yyyy') : '-'
        },
        { accessorKey: 'deviations', header: 'Deviations' },
        { accessorKey: 'corrective_action', header: 'Corrective Action' },
        { accessorKey: 'remarks', header: 'Remarks' },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => getStatusBadge(row.original.status || 'Pending')
        },
        {
            id: 'comments',
            header: 'Admin Query',
            cell: ({ row }) => row.original.status === 'Returned' && row.original.admin_comments ? (
                <div className="flex items-center text-red-600 font-medium text-sm max-w-[200px]">
                    <AlertCircle className="w-4 h-4 mr-1 shrink-0" />
                    <span className="truncate" title={row.original.admin_comments}>{row.original.admin_comments}</span>
                </div>
            ) : '-'
        },
        {
            accessorKey: 'hod_initial_url',
            header: 'HOD Status',
            cell: ({ row }) => renderInitialCell(
                row.original.hod_initial_url,
                getHodApprovalDisplay(row.original.status)
            )
        },
        {
            accessorKey: 'dean_initial_url',
            header: 'Dean Status',
            cell: ({ row }) => renderInitialCell(
                row.original.dean_initial_url,
                getDeanApprovalDisplay(row.original.status)
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const isPending = !row.original.status || row.original.status === 'Pending' || row.original.status === 'Returned'
                return (
                    <div className="flex justify-end gap-2">
                        {isPending && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                    onClick={() => {
                                        setSubmitResult({
                                            id: row.original.id,
                                            name: formatInAppTz(row.original.date, 'dd/MM/yyyy'),
                                            academicYear: row.original.academic_year || academicYear,
                                            semesterType: row.original.semester_type || semesterType,
                                        })
                                        setConfirmSubmitOpen(true)
                                    }}
                                >
                                    <Send className="w-3 h-3" />
                                    Submit
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setEditingItem(row.original); setOpen(true); }}>
                                    <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(row.original.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </>
                        )}
                        {!isPending && (
                            <span className="text-xs text-muted-foreground italic flex items-center h-8 px-2">
                                Locked
                            </span>
                        )}
                    </div>
                )
            }
        }
    ]

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    const periodLocked = isLogbookLockedForPeriod(data, academicYear, semesterType)

    return (
        <div className="space-y-6">
            {periodLocked && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Logbook locked for this period</AlertTitle>
                    <AlertDescription>
                        Inspection for Academic Year {academicYear}, {semesterType} semester has been submitted.
                        Other pages are locked for this year and semester only.
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Inspections</h1>
                <Button onClick={() => { setEditingItem({ academic_year: academicYear, semester_type: semesterType }); setOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entry
                </Button>
            </div>

            {/* Academic Year and Semester Filters */}
            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg flex-wrap">
                {/* Academic Year Filter */}
                <div className="grid gap-2">
                    <Label>Academic Year</Label>
                    <Select value={academicYear} onValueChange={setAcademicYear}>
                        <SelectTrigger className="w-[140px] h-8 bg-background">
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
                    <Label>Semester</Label>
                    <Select value={semesterType} onValueChange={setSemesterType}>
                        <SelectTrigger className="w-[100px] h-8 bg-background">
                            <SelectValue placeholder="Sem Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Odd">Odd</SelectItem>
                            <SelectItem value="Even">Even</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={data.filter((row) => {
                    if (row.academic_year && row.academic_year !== academicYear) return false
                    if (row.semester_type && row.semester_type !== semesterType) return false
                    return true
                })}
            />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Inspection</DialogTitle>
                    </DialogHeader>
                    {editingItem?.status === 'Returned' && editingItem.admin_comments && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Action Required</AlertTitle>
                            <AlertDescription>{editingItem.admin_comments}</AlertDescription>
                        </Alert>
                    )}
                    <form onSubmit={handleSave} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="date">Date</Label>
                            <Input id="date" type="date" value={editingItem?.date || ''} onChange={e => setEditingItem({ ...editingItem, date: e.target.value })} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="deviations">Deviations</Label>
                            <Input id="deviations" value={editingItem?.deviations || ''} onChange={e => setEditingItem({ ...editingItem, deviations: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="corrective_action">Corrective Action</Label>
                            <Input id="corrective_action" value={editingItem?.corrective_action || ''} onChange={e => setEditingItem({ ...editingItem, corrective_action: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="remarks">Remarks</Label>
                            <Input id="remarks" value={editingItem?.remarks || ''} onChange={e => setEditingItem({ ...editingItem, remarks: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Academic Year</Label>
                                <Input value={editingItem?.academic_year || academicYear} disabled readOnly />
                            </div>
                            <div className="grid gap-2">
                                <Label>Semester</Label>
                                <Input value={editingItem?.semester_type || semesterType} disabled readOnly />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <SignatureUploader
                                label="HOD Initial"
                                onUpload={(url) => setEditingItem({ ...editingItem, hod_initial_url: url })}
                                initialUrl={editingItem?.hod_initial_url}

                            />
                            <SignatureUploader
                                label="Dean Initial"
                                onUpload={(url) => setEditingItem({ ...editingItem, dean_initial_url: url })}
                                initialUrl={editingItem?.dean_initial_url}
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit">Save</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Submission</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to submit the inspection for <strong>{submitResult?.name}</strong> to the HOD?
                            <br /><br />
                            <span className="text-red-500 font-medium">
                                Warning: After submission, the logbook will be locked for Academic Year {submitResult?.academicYear}, {submitResult?.semesterType} semester only. You can still edit other years/semesters.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmitToHod}>Confirm Submit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
