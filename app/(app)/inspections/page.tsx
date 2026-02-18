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
}

export default function InspectionsPage() {
    const [data, setData] = useState<Inspection[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<Inspection> | null>(null)
    const [open, setOpen] = useState(false)
    const [submitResult, setSubmitResult] = useState<{ id: string, name: string } | null>(null)
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)
    const supabase = createClient()

    // Academic Year and Semester Filter State
    const [academicYear, setAcademicYear] = useState<string>("2025-2026")
    const [semesterType, setSemesterType] = useState<string>("Even")

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('inspections')
            .select('*')
            .eq('staff_id', user.id)
            .order('date', { ascending: false })

        if (data) setData(data)
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const item = {
            ...editingItem,
            staff_id: user.id,
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
            .update({ status: 'Submitted' })
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
        switch (status) {
            case 'Submitted':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Submitted</Badge>
            case 'HOD Approved':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">HOD Approved</Badge>
            case 'Dean Approved':
                return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Dean Approved</Badge>
            case 'Returned':
                return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">Returned</Badge>
            default:
                return <Badge variant="outline">Pending</Badge>
        }
    }

    const columns: ColumnDef<Inspection>[] = [
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
            header: 'HOD Initial',
            cell: ({ row }) => row.original.hod_initial_url ? <img src={row.original.hod_initial_url} alt="HOD" className="h-8" /> : '-'
        },
        {
            accessorKey: 'dean_initial_url',
            header: 'Dean Initial',
            cell: ({ row }) => row.original.dean_initial_url ? <img src={row.original.dean_initial_url} alt="Dean" className="h-8" /> : '-'
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
                                        setSubmitResult({ id: row.original.id, name: formatInAppTz(row.original.date, 'dd/MM/yyyy') })
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Inspections</h1>
                <Button onClick={() => { setEditingItem({}); setOpen(true); }}>
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
                            <SelectItem value="2025-2026">2025-2026</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Semester Filter */}
                <div className="grid gap-2">
                    <Label>Semester</Label>
                    <Select value={semesterType} onValueChange={setSemesterType} disabled>
                        <SelectTrigger className="w-[100px] h-8 bg-background">
                            <SelectValue placeholder="Sem Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Even">Even</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <DataTable columns={columns} data={data} />

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
                            <span className="text-red-500 font-medium">Warning: This action cannot be undone. You will not be able to edit or delete this entry after submission.</span>
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
