'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Pencil, Trash2, Upload, Download } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import Papa from 'papaparse'

type LecturePlan = {
    id: string
    subject: string
    period_no: number
    proposed_date: string
    topic: string
    actual_completion_date: string | null
    remarks: string
}

export default function LecturePlanPage() {
    const [data, setData] = useState<LecturePlan[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<LecturePlan> | null>(null)
    const [open, setOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
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

    const toggleCompletion = async (item: LecturePlan, checked: boolean) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const updates = {
            actual_completion_date: checked ? new Date().toISOString() : null,
        }

        // Optimistic update
        setData(prev => prev.map(p => p.id === item.id ? { ...p, ...updates } : p))

        const { error } = await supabase.from('lecture_plans').update(updates).eq('id', item.id)
        if (error) {
            alert('Error updating status')
            fetchData() // Revert on error
        }
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setImporting(true)
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setImporting(false)
                    return
                }

                const rows = results.data as any[]
                const validRows = rows.map(row => {
                    const safeParseDate = (dateStr: string) => {
                        if (!dateStr) return null
                        const date = new Date(dateStr)
                        return isNaN(date.getTime()) ? null : date.toISOString()
                    }

                    return {
                        staff_id: user.id,
                        subject: row.subject || row.Subject,
                        period_no: parseInt(row.period_no || row.Period || '0'),
                        proposed_date: safeParseDate(row.proposed_date || row.ProposedDate),
                        topic: row.topic || row.Topic,
                        actual_completion_date: safeParseDate(row.actual_completion_date || row.ActualDate),
                        remarks: row.remarks || row.Remarks
                    }
                }).filter(row => row.subject && row.topic)

                if (validRows.length > 0) {
                    const { error } = await supabase.from('lecture_plans').insert(validRows)
                    if (error) {
                        alert('Error importing data: ' + error.message)
                    } else {
                        alert(`Successfully imported ${validRows.length} records`)
                        fetchData()
                    }
                } else {
                    alert('No valid records found in CSV')
                }
                setImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
            },
            error: (error) => {
                alert('Error parsing CSV: ' + error.message)
                setImporting(false)
            }
        })
    }

    const downloadSample = () => {
        const csvContent = "Subject,Period,ProposedDate,Topic,ActualDate,Remarks\nMathematics,1,2024-01-20,Introduction to Calculus,2024-01-20,Completed\nPhysics,2,2024-01-21,Newton's Laws,,"
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', 'lecture_plan_sample.csv')
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

    const columns: ColumnDef<LecturePlan>[] = [
        {
            id: 'completed',
            header: 'Done',
            cell: ({ row }) => (
                <Checkbox
                    checked={!!row.original.actual_completion_date}
                    onCheckedChange={(checked) => toggleCompletion(row.original, checked as boolean)}
                />
            )
        },
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h1 className="text-3xl font-bold">Lecture Plan</h1>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <Button variant="outline" onClick={downloadSample} title="Download Sample CSV">
                        <Download className="w-4 h-4 mr-2" />
                        Sample CSV
                    </Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                        {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        Import CSV
                    </Button>
                    <Button onClick={() => { setEditingItem({}); setOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Entry
                    </Button>
                </div>
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
