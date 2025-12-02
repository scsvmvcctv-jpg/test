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
import { SignatureUploader } from '@/components/SignatureUploader'

type Inspection = {
    id: string
    date: string
    deviations: string
    corrective_action: string
    remarks: string
    hod_initial_url: string
    dean_initial_url: string
}

export default function InspectionsPage() {
    const [data, setData] = useState<Inspection[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<Inspection> | null>(null)
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

    const columns: ColumnDef<Inspection>[] = [
        {
            accessorKey: 'date',
            header: 'Date',
            cell: ({ row }) => row.original.date ? format(new Date(row.original.date), 'dd/MM/yyyy') : '-'
        },
        { accessorKey: 'deviations', header: 'Deviations' },
        { accessorKey: 'corrective_action', header: 'Corrective Action' },
        { accessorKey: 'remarks', header: 'Remarks' },
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
                <h1 className="text-3xl font-bold">Inspections</h1>
                <Button onClick={() => { setEditingItem({}); setOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entry
                </Button>
            </div>

            <DataTable columns={columns} data={data} />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Inspection</DialogTitle>
                    </DialogHeader>
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
                            />
                            <SignatureUploader
                                label="Dean Initial"
                                onUpload={(url) => setEditingItem({ ...editingItem, dean_initial_url: url })}
                            />
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
