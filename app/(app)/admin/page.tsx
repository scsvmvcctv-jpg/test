'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Check, X } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// For simplicity, we'll just show Lecture Plans for now, or a unified view?
// Unified view is hard because schemas differ.
// I'll create tabs or a selector to switch between tables.
// I'll implement a selector.

const TABLES = [
    { value: 'lecture_plans', label: 'Lecture Plans' },
    { value: 'tests', label: 'Tests' },
    { value: 'assignments', label: 'Assignments' },
    { value: 'extra_classes', label: 'Extra Classes' },
    { value: 'inspections', label: 'Inspections' },
]

export default function AdminPage() {
    const [selectedTable, setSelectedTable] = useState('lecture_plans')
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        fetchData()
    }, [selectedTable])

    const fetchData = async () => {
        setLoading(true)
        const { data } = await supabase
            .from(selectedTable)
            .select('*, profiles(email, full_name)')
            .order('created_at', { ascending: false })

        if (data) setData(data)
        setLoading(false)
    }

    const handleStatusUpdate = async (id: string, status: string, comment: string = '') => {
        const { error } = await supabase
            .from(selectedTable)
            .update({ status, admin_comments: comment })
            .eq('id', id)

        if (!error) fetchData()
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: 'profiles.email',
            header: 'Staff',
            cell: ({ row }) => row.original.profiles?.email || row.original.staff_id
        },
        // Dynamic columns based on table?
        // For MVP, I'll just show common fields + JSON dump or specific fields if I map them.
        // I'll map common fields.
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <span className={
                    row.original.status === 'Approved' ? 'text-green-600' :
                        row.original.status === 'Rejected' ? 'text-red-600' :
                            'text-yellow-600'
                }>
                    {row.original.status}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleStatusUpdate(row.original.id, 'Approved')}>
                        <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusUpdate(row.original.id, 'Rejected')}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )
        }
    ]

    // Add specific columns based on table
    if (selectedTable === 'lecture_plans') {
        columns.splice(1, 0, { accessorKey: 'subject', header: 'Subject' }, { accessorKey: 'topic', header: 'Topic' })
    } else if (selectedTable === 'tests') {
        columns.splice(1, 0, { accessorKey: 'subject', header: 'Subject' }, { accessorKey: 'proposed_test_date', header: 'Date' })
    }
    // ... others

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Table" />
                    </SelectTrigger>
                    <SelectContent>
                        {TABLES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
            ) : (
                <DataTable columns={columns} data={data} />
            )}
        </div>
    )
}
