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
import { Loader2, Plus, Pencil, Trash2, Upload, Download, FileDown } from 'lucide-react'
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

    // Academic Year and Semester Filter State
    const [academicYear, setAcademicYear] = useState<string>("2024-2025")
    const [semesterType, setSemesterType] = useState<string>("Odd")

    // Store user profile data for refetching
    const [userProfile, setUserProfile] = useState<{ emp_id: string; department_no: string } | null>(null)

    useEffect(() => {
        initializeData()
    }, [])

    // Re-fetch subjects when Academic Year or Semester changes
    useEffect(() => {
        const refetchSubjects = async () => {
            if (userProfile?.emp_id && userProfile?.department_no) {
                setLoadingSubjects(true)
                await fetchSubjects(userProfile.emp_id, userProfile.department_no, academicYear, semesterType)
                setLoadingSubjects(false)
            }
        }

        // Only refetch if we have user profile data
        if (userProfile) {
            refetchSubjects()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [academicYear, semesterType])

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
            setUserProfile({ emp_id: profile.emp_id, department_no: profile.department_no })
            await fetchSubjects(profile.emp_id, profile.department_no, academicYear, semesterType)
        }

        // Fetch Tests
        await fetchTests(user.id)

        setLoading(false)
        setLoadingSubjects(false)
    }

    const fetchSubjects = async (empId: string, deptId: string, filterYear?: string, filterSemester?: string) => {
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
                // Filter by Academic Year and Semester if provided
                let filteredData = result.data;
                
                if (filterYear) {
                    filteredData = filteredData.filter((item: any) => item.Academicyear === filterYear);
                }

                if (filterSemester) {
                    filteredData = filteredData.filter((item: any) => {
                        const sem = Number(item.Semester);
                        if (filterSemester === "Odd") {
                            return sem % 2 !== 0; // Odd semesters: 1, 3, 5, 7
                        } else if (filterSemester === "Even") {
                            return sem % 2 === 0; // Even semesters: 2, 4, 6, 8
                        }
                        return true;
                    });
                }

                // Extract unique subjects from filtered data
                const uniqueSubjects = new Map<string, SubjectItem>();

                filteredData.forEach((item: any) => {
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
                
                // Clear selected subject if it's no longer in the filtered list
                if (selectedSubject) {
                    const subjectExists = Array.from(uniqueSubjects.values()).some(
                        subj => subj.displayName === selectedSubject
                    );
                    if (!subjectExists) {
                        setSelectedSubject("");
                    }
                }
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

                        // Handle DD-MM-YYYY or DD/MM/YYYY
                        // Regex matches 1-2 digits, separator, 1-2 digits, separator, 4 digits
                        const dmYMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
                        if (dmYMatch) {
                            const [_, day, month, year] = dmYMatch
                            // month is 0-indexed in JS Date? No, in string ctor it's usually YYYY-MM-DD.
                            // But better to use: new Date(year, monthIndex, day)
                            // Note: month needs -1
                            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                            // Adjust for timezone offset if needed? standard Date(y,m,d) creates local time. 
                            // toISOString converts to UTC. Ideally we want the date to represent the day.
                            // Simple approach: create UTC date to avoid shifts
                            const utcDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)))
                            return utcDate.toISOString()
                        }

                        const date = new Date(dateStr)
                        return isNaN(date.getTime()) ? null : date.toISOString()
                    }

                    const item: any = {
                        staff_id: user.id,
                        subject: row.subject || row.Subject,
                        proposed_test_date: safeParseDate(row.proposed_test_date || row.ProposedTestDate || row.ProposedDate),
                        actual_date: safeParseDate(row.actual_date || row.ActualDate),
                        date_returned: safeParseDate(row.date_returned || row.DateReturned || row.ReturnedDate),
                        remarks: row.remarks || row.Remarks
                    }

                    // If ID exists in CSV, include it for update
                    if (row.id && row.id.trim() !== '') {
                        item.id = row.id.trim()
                    }

                    return item
                }).filter(row => row.subject)

                if (validRows.length > 0) {
                    // Using upsert to handle both inserts and updates
                    const { error } = await supabase.from('tests').upsert(validRows)

                    if (error) {
                        alert('Error importing data: ' + error.message)
                    } else {
                        alert(`Successfully imported/updated ${validRows.length} records`)
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
        // Pre-fill subject name if filter is selected
        const defaultSubject = selectedSubject ? subjects.find(s => s.displayName === selectedSubject)?.name || selectedSubject : "Mathematics";

        const csvContent = `id,subject,proposed_test_date,actual_date,date_returned,remarks\n,${defaultSubject},2024-02-15,2024-02-15,2024-02-20,Unit Test 1`
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

    const handleExport = () => {
        const dataToExport = selectedSubject ? filteredData : data;

        if (dataToExport.length === 0) {
            alert('No data to export');
            return;
        }

        // Map data to CSV format
        const csvRows = dataToExport.map(item => ({
            id: item.id,
            subject: item.subject,
            proposed_test_date: item.proposed_test_date ? format(new Date(item.proposed_test_date), 'yyyy-MM-dd') : '',
            actual_date: item.actual_date ? format(new Date(item.actual_date), 'yyyy-MM-dd') : '',
            date_returned: item.date_returned ? format(new Date(item.date_returned), 'yyyy-MM-dd') : '',
            remarks: item.remarks || ''
        }));

        const csv = Papa.unparse(csvRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `tests_schedule_${selectedSubject || 'all'}_${format(new Date(), 'yyyyMMdd')}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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
                        <Button variant="outline" onClick={handleExport} title="Export Current View" disabled={data.length === 0}>
                            <FileDown className="w-4 h-4 mr-2" />
                            Export CSV
                        </Button>
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

                <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg flex-wrap">
                    {/* Academic Year Filter */}
                    <div className="grid gap-2">
                        <Label>Academic Year</Label>
                        <Select value={academicYear} onValueChange={setAcademicYear}>
                            <SelectTrigger className="w-[140px] h-8 bg-background">
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2024-2025">2024-2025</SelectItem>
                                <SelectItem value="2025-2026">2025-2026</SelectItem>
                                <SelectItem value="2023-2024">2023-2024</SelectItem>
                                <SelectItem value="2026-2027">2026-2027</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Semester Filter */}
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

                    {/* Subject Filter */}
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
