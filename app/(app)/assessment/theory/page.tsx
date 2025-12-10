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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Pencil, Trash2, Upload, Download } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import Papa from 'papaparse'

type TheoryAssessment = {
    id: string
    subject: string
    student_id: string
    internal_1: number
    internal_2: number
    assignment_attendance: number
    total: number
}

type SubjectItem = {
    code: string
    name: string
    displayName: string
}

export default function TheoryAssessmentPage() {
    const [data, setData] = useState<TheoryAssessment[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<TheoryAssessment> | null>(null)
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

        // Fetch Assessment Theory
        await fetchAssessments(user.id)

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

    const fetchAssessments = async (userId: string) => {
        const { data } = await supabase
            .from('assessment_theory')
            .select('*')
            .eq('staff_id', userId)
            .order('student_id', { ascending: true })

        if (data) setData(data)
    }

    const reloadData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await fetchAssessments(user.id)
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
            reloadData()
        } else {
            alert('Error saving data')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return
        const { error } = await supabase.from('assessment_theory').delete().eq('id', id)
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
                    return {
                        staff_id: user.id,
                        subject: row.subject || row.Subject,
                        student_id: row.student_id || row.StudentId || row.RegisterNo,
                        internal_1: parseFloat(row.internal_1 || row.Internal1 || '0'),
                        internal_2: parseFloat(row.internal_2 || row.Internal2 || '0'),
                        assignment_attendance: parseFloat(row.assignment_attendance || row.AssignmentAttendance || '0')
                    }
                }).filter(row => row.subject && row.student_id)

                if (validRows.length > 0) {
                    const { error } = await supabase.from('assessment_theory').insert(validRows)
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
        const csvContent = "Subject,StudentId,Internal1,Internal2,AssignmentAttendance\nMathematics,11199A001,12,13,9\nMathematics,11199A002,14,11,8"
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', 'theory_assessment_sample.csv')
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

    const handleAddItem = () => {
        const subjObj = subjects.find(s => s.displayName === selectedSubject);
        setEditingItem({
            subject: subjObj ? subjObj.name : '',
            internal_1: 0,
            internal_2: 0,
            assignment_attendance: 0
        });
        setOpen(true);
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold">Theory Assessment</h1>
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
                                <SelectValue placeholder={loadingSubjects ? "Loading subjects..." : "Select a subject to view assessment..."} />
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
                    <p className="text-lg font-medium">Please select a subject to view assessment details</p>
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Assessment</DialogTitle>
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
