'use client'

import { useEffect, useState, useRef } from 'react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Pencil, Trash2, Upload, Download } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import Papa from 'papaparse'

type Test = {
    id: string
    subject: string
    proposed_test_date: string
    actual_date: string
    date_returned: string
    remarks: string
}

type SubjectItem = {
    code: string
    name: string
    displayName: string
}

export default function TestsPage() {
    const [data, setData] = useState<Test[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<Test> | null>(null)
    const [open, setOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    // Subject Filter State
    const [subjects, setSubjects] = useState<SubjectItem[]>([])
    const [selectedSubject, setSelectedSubject] = useState<string>("")
    const [loadingSubjects, setLoadingSubjects] = useState(false)

    useEffect(() => {
        initializeData()
    }, [])

    const initializeData = async () => {
        setLoading(true)
        setLoadingSubjects(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch User Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('emp_id, department_no')
            .eq('id', user.id)
            .single()

        if (profile?.emp_id && profile?.department_no) {
            await fetchSubjects(profile.emp_id, profile.department_no)
        }

        // Fetch Tests
        await fetchTests(user.id)

        setLoading(false)
        setLoadingSubjects(false)
    }

    const fetchSubjects = async (empId: string, deptId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch(`/api/faculty-workload?EmpId=${empId}&Dept=${deptId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            const result = await res.json()

            if (result.data && Array.isArray(result.data)) {
                // Extract unique subjects
                const uniqueSubjects = new Map<string, SubjectItem>();

                result.data.forEach((item: any) => {
                    if (item.SubjectCode && item.Subject_Name) {
                        const key = `${item.SubjectCode}-${item.Subject_Name}`;
                        if (!uniqueSubjects.has(key)) {
                            uniqueSubjects.set(key, {
                                code: item.SubjectCode,
                                name: item.Subject_Name,
                                displayName: `${item.SubjectCode} - ${item.Subject_Name}`
                            });
                        }
                    }
                });

                setSubjects(Array.from(uniqueSubjects.values()));
            }
        } catch (error) {
            console.error("Failed to fetch subjects", error)
        }
    }

    const fetchTests = async (userId: string) => {
        const { data } = await supabase
            .from('tests')
            .select('*')
            .eq('staff_id', userId)
            .order('proposed_test_date', { ascending: true })

        if (data) setData(data)
    }

    const reloadData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await fetchTests(user.id)
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
            reloadData()
        } else {
            alert('Error saving data')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return
        const { error } = await supabase.from('tests').delete().eq('id', id)
        if (!error) reloadData()
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
                        proposed_test_date: safeParseDate(row.proposed_test_date || row.ProposedTestDate || row.ProposedDate),
                        actual_date: safeParseDate(row.actual_date || row.ActualDate),
                        date_returned: safeParseDate(row.date_returned || row.DateReturned || row.ReturnedDate),
                        remarks: row.remarks || row.Remarks
                    }
                }).filter(row => row.subject)

                if (validRows.length > 0) {
                    const { error } = await supabase.from('tests').insert(validRows)
                    if (error) {
                        alert('Error importing data: ' + error.message)
                    } else {
                        alert(`Successfully imported ${validRows.length} records`)
                        reloadData()
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
        const csvContent = "Subject,ProposedTestDate,ActualDate,DateReturned,Remarks\nMathematics,2024-02-15,2024-02-15,2024-02-20,Unit Test 1\nPhysics,2024-03-10,,,"
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', 'tests_sample.csv')
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

    // Filter Logic
    const filteredData = selectedSubject
        ? data.filter(item => {
            const subjObj = subjects.find(s => s.displayName === selectedSubject);
            if (!subjObj) return item.subject === selectedSubject;
            return item.subject === subjObj.name || item.subject === subjObj.code || item.subject === selectedSubject;
        })
        : [];

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

    const handleAddItem = () => {
        const subjObj = subjects.find(s => s.displayName === selectedSubject);
        setEditingItem({
            subject: subjObj ? subjObj.name : ''
        });
        setOpen(true);
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold">Tests Schedule</h1>
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
                        <Button onClick={handleAddItem} disabled={!selectedSubject}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Entry
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                    <div className="grid gap-2 w-full max-w-md">
                        <Label>Select Subject</Label>
                        <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={loadingSubjects}>
                            <SelectTrigger className="bg-background">
                                <SelectValue placeholder={loadingSubjects ? "Loading subjects..." : "Select a subject to view schedule..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {subjects.map((subj) => (
                                    <SelectItem key={subj.displayName} value={subj.displayName}>
                                        {subj.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {selectedSubject ? (
                <DataTable columns={columns} data={filteredData} />
            ) : (
                <div className="flex flex-col items-center justify-center p-12 border rounded-lg border-dashed text-muted-foreground bg-muted/10">
                    <p className="text-lg font-medium">Please select a subject to view its test schedule</p>
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Test</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={editingItem?.subject || ''} onChange={e => setEditingItem({ ...editingItem, subject: e.target.value })} required />
                            {selectedSubject && (
                                <p className="text-xs text-muted-foreground">
                                    Current filter: {selectedSubject}
                                </p>
                            )}
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
