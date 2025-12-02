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
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'

type LecturePlan = {
    id: string
    subject: string
    period_no: number
    proposed_date: string
    topic: string
    actual_completion_date: string
    remarks: string
}

export default function LecturePlanPage() {
    const [data, setData] = useState<LecturePlan[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<LecturePlan> | null>(null)
    const [open, setOpen] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('lecture_plans')
            .select('*')
            .eq('staff_id', user.id)
            .order('proposed_date', { ascending: true })

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
        }

        let error
        if (item.id) {
            const { error: updateError } = await supabase.from('lecture_plans').update(item).eq('id', item.id)
            error = updateError
        } else {
            const { error: insertError } = await supabase.from('lecture_plans').insert(item)
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
        const { error } = await supabase.from('lecture_plans').delete().eq('id', id)
        if (!error) fetchData()
    }

    const columns: ColumnDef<LecturePlan>[] = [
        { accessorKey: 'subject', header: 'Subject' },
        { accessorKey: 'period_no', header: 'Period' },
        {
            accessorKey: 'proposed_date',
            header: 'Proposed Date',
            cell: ({ row }) => row.original.proposed_date ? format(new Date(row.original.proposed_date), 'dd/MM/yyyy') : '-'
        },
        { accessorKey: 'topic', header: 'Topic' },
        {
            accessorKey: 'actual_completion_date',
            header: 'Actual Date',
            cell: ({ row }) => row.original.actual_completion_date ? format(new Date(row.original.actual_completion_date), 'dd/MM/yyyy') : '-'
        },
        { accessorKey: 'remarks', header: 'Remarks' },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingItem(row.original); setOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )
        }
    ]

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Lecture Plan</h1>
                <Button onClick={() => { setEditingItem({}); setOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entry
                </Button>
            </div>

            <DataTable columns={columns} data={data} />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Lecture Plan</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={editingItem?.subject || ''} onChange={e => setEditingItem({ ...editingItem, subject: e.target.value })} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="period_no">Period No</Label>
                                <Input id="period_no" type="number" value={editingItem?.period_no || ''} onChange={e => setEditingItem({ ...editingItem, period_no: parseInt(e.target.value) })} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="proposed_date">Proposed Date</Label>
                                <Input id="proposed_date" type="date" value={editingItem?.proposed_date || ''} onChange={e => setEditingItem({ ...editingItem, proposed_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="topic">Topic</Label>
                            <Input id="topic" value={editingItem?.topic || ''} onChange={e => setEditingItem({ ...editingItem, topic: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="actual_completion_date">Actual Date</Label>
                                <Input id="actual_completion_date" type="date" value={editingItem?.actual_completion_date || ''} onChange={e => setEditingItem({ ...editingItem, actual_completion_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="remarks">Remarks</Label>
                            <Input id="remarks" value={editingItem?.remarks || ''} onChange={e => setEditingItem({ ...editingItem, remarks: e.target.value })} />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit">Save</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
