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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'

type Test = {
    id: string
    subject: string
    proposed_test_date: string
    actual_date: string
    date_returned: string
    remarks: string
}

export default function TestsPage() {
    const [data, setData] = useState<Test[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<Test> | null>(null)
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
            .from('tests')
            .select('*')
            .eq('staff_id', user.id)
            .order('proposed_test_date', { ascending: true })

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
            const { error: updateError } = await supabase.from('tests').update(item).eq('id', item.id)
            error = updateError
        } else {
            const { error: insertError } = await supabase.from('tests').insert(item)
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
        const { error } = await supabase.from('tests').delete().eq('id', id)
        if (!error) fetchData()
    }

    const columns: ColumnDef<Test>[] = [
        { accessorKey: 'subject', header: 'Subject' },
        {
            accessorKey: 'proposed_test_date',
            header: 'Proposed Date',
            cell: ({ row }) => row.original.proposed_test_date ? format(new Date(row.original.proposed_test_date), 'dd/MM/yyyy') : '-'
        },
        {
            accessorKey: 'actual_date',
            header: 'Actual Date',
            cell: ({ row }) => row.original.actual_date ? format(new Date(row.original.actual_date), 'dd/MM/yyyy') : '-'
        },
        {
            accessorKey: 'date_returned',
            header: 'Returned Date',
            cell: ({ row }) => row.original.date_returned ? format(new Date(row.original.date_returned), 'dd/MM/yyyy') : '-'
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
                <h1 className="text-3xl font-bold">Tests Schedule</h1>
                <Button onClick={() => { setEditingItem({}); setOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entry
                </Button>
            </div>

            <DataTable columns={columns} data={data} />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Test</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={editingItem?.subject || ''} onChange={e => setEditingItem({ ...editingItem, subject: e.target.value })} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="proposed_test_date">Proposed Date</Label>
                                <Input id="proposed_test_date" type="date" value={editingItem?.proposed_test_date || ''} onChange={e => setEditingItem({ ...editingItem, proposed_test_date: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="actual_date">Actual Date</Label>
                                <Input id="actual_date" type="date" value={editingItem?.actual_date || ''} onChange={e => setEditingItem({ ...editingItem, actual_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="date_returned">Date Returned</Label>
                                <Input id="date_returned" type="date" value={editingItem?.date_returned || ''} onChange={e => setEditingItem({ ...editingItem, date_returned: e.target.value })} />
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
