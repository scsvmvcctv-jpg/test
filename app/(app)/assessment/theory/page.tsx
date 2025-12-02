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

type TheoryAssessment = {
    id: string
    student_id: string
    internal_1: number
    internal_2: number
    assignment_attendance: number
    total: number
}

export default function TheoryAssessmentPage() {
    const [data, setData] = useState<TheoryAssessment[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<TheoryAssessment> | null>(null)
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
            .from('assessment_theory')
            .select('*')
            .eq('staff_id', user.id)
            .order('student_id', { ascending: true })

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
            const { error: updateError } = await supabase.from('assessment_theory').update(item).eq('id', item.id)
            error = updateError
        } else {
            const { error: insertError } = await supabase.from('assessment_theory').insert(item)
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
        const { error } = await supabase.from('assessment_theory').delete().eq('id', id)
        if (!error) fetchData()
    }

    const columns: ColumnDef<TheoryAssessment>[] = [
        { accessorKey: 'student_id', header: 'Student ID' },
        { accessorKey: 'internal_1', header: 'Internal I (15)' },
        { accessorKey: 'internal_2', header: 'Internal II (15)' },
        { accessorKey: 'assignment_attendance', header: 'Assign/Att (10)' },
        { accessorKey: 'total', header: 'Total (40)' },
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
                <h1 className="text-3xl font-bold">Theory Assessment</h1>
                <Button onClick={() => { setEditingItem({}); setOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entry
                </Button>
            </div>

            <DataTable columns={columns} data={data} />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Assessment</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="student_id">Student ID / Name</Label>
                            <Input id="student_id" value={editingItem?.student_id || ''} onChange={e => setEditingItem({ ...editingItem, student_id: e.target.value })} required />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="internal_1">Internal I</Label>
                                <Input id="internal_1" type="number" value={editingItem?.internal_1 || ''} onChange={e => setEditingItem({ ...editingItem, internal_1: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="internal_2">Internal II</Label>
                                <Input id="internal_2" type="number" value={editingItem?.internal_2 || ''} onChange={e => setEditingItem({ ...editingItem, internal_2: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="assignment_attendance">Assign/Att</Label>
                                <Input id="assignment_attendance" type="number" value={editingItem?.assignment_attendance || ''} onChange={e => setEditingItem({ ...editingItem, assignment_attendance: parseFloat(e.target.value) })} />
                            </div>
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
