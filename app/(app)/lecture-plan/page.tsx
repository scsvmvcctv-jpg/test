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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Pencil, Trash2, Upload, Download, FileDown, Printer } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import Papa from 'papaparse'

type LecturePlan = {
    id: string
    subject: string
    unit_no: number | null
    period_no: number
    proposed_date: string
    topic: string
    actual_completion_date: string | null
    remarks: string
}

type SubjectItem = {
    code: string
    name: string
    displayName: string
}

export default function LecturePlanPage() {
    const [data, setData] = useState<LecturePlan[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<LecturePlan> | null>(null)
    const [open, setOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    // Subject Filter State
    const [subjects, setSubjects] = useState<SubjectItem[]>([])
    const [selectedSubject, setSelectedSubject] = useState<string>("")
    const [loadingSubjects, setLoadingSubjects] = useState(false)

    // Academic Year and Semester Filter State
    const [academicYear, setAcademicYear] = useState<string>("2025-2026")
    const [semesterType, setSemesterType] = useState<string>("Even")

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

        // Fetch Lecture Plans
        await fetchLecturePlans(user.id)

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
            } else {
                // If no data, set empty array
                setSubjects([]);
            }
        } catch (error) {
            console.error("Failed to fetch subjects", error)
            setSubjects([]);
        }
    }

    const fetchLecturePlans = async (userId: string) => {
        const { data } = await supabase
            .from('lecture_plans')
            .select('*')
            .eq('staff_id', userId)
            .order('proposed_date', { ascending: true })

        if (data) setData(data)
    }

    const reloadData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await fetchLecturePlans(user.id)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Build item object, only including unit_no if it has a value
        const item: any = {
            ...editingItem,
            staff_id: user.id,
        }

        // Only include unit_no if it's provided (not null/undefined)
        // This prevents errors if the column doesn't exist in the database yet
        if (item.unit_no === null || item.unit_no === undefined || item.unit_no === '') {
            delete item.unit_no
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
            reloadData()
        } else {
            alert('Error saving data: ' + (error.message || 'Unknown error'))
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return
        const { error } = await supabase.from('lecture_plans').delete().eq('id', id)
        if (!error) reloadData()
    }

    const toggleCompletion = async (item: LecturePlan, checked: boolean) => {
        const updates = {
            actual_completion_date: checked ? new Date().toISOString() : null,
        }

        // Optimistic update
        setData(prev => prev.map(p => p.id === item.id ? { ...p, ...updates } : p))

        const { error } = await supabase.from('lecture_plans').update(updates).eq('id', item.id)
        if (error) {
            alert('Error updating status')
            reloadData() // Revert on error
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

                        // Handle DD-MM-YYYY or DD/MM/YYYY
                        const dmYMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
                        if (dmYMatch) {
                            const [_, day, month, year] = dmYMatch
                            const utcDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)))
                            return utcDate.toISOString()
                        }

                        const date = new Date(dateStr)
                        return isNaN(date.getTime()) ? null : date.toISOString()
                    }

                    // Clean object construction
                    const item: any = {
                        staff_id: user.id,
                        subject: row.subject || row.Subject,
                        period_no: parseInt(row.period_no || row.Period || '0'),
                        proposed_date: safeParseDate(row.proposed_date || row.ProposedDate),
                        topic: row.topic || row.Topic,
                        actual_completion_date: safeParseDate(row.actual_completion_date || row.ActualDate),
                        remarks: row.remarks || row.Remarks
                    }

                    // Only include unit_no if it's provided in the CSV
                    // This makes it optional and prevents errors if the column doesn't exist yet
                    const unitNoValue = row.unit_no || row.UnitNo
                    if (unitNoValue !== undefined && unitNoValue !== null && unitNoValue !== '') {
                        const parsedUnitNo = parseInt(unitNoValue)
                        if (!isNaN(parsedUnitNo)) {
                            item.unit_no = parsedUnitNo
                        }
                    }

                    // If ID exists in CSV, include it for update
                    if (row.id && row.id.trim() !== '') {
                        item.id = row.id.trim()
                    }

                    return item
                }).filter(row => row.subject && row.topic)

                if (validRows.length > 0) {
                    // Using upsert to handle both inserts and updates
                    // Note: Supabase upsert matches on primary key (id)
                    const { error } = await supabase.from('lecture_plans').upsert(validRows)

                    if (error) {
                        // If error is about unit_no column not existing, try without it
                        if (error.message && error.message.includes('unit_no')) {
                            console.warn('unit_no column not found, retrying without it')
                            const rowsWithoutUnitNo = validRows.map(({ unit_no, ...rest }) => rest)
                            const { error: retryError } = await supabase.from('lecture_plans').upsert(rowsWithoutUnitNo)
                            
                            if (retryError) {
                                alert('Error importing data: ' + retryError.message + '\n\nNote: Please apply the migration to add unit_no column to the database.')
                            } else {
                                alert(`Successfully imported/updated ${validRows.length} records (without unit_no column).\n\nNote: Apply migration to enable unit_no support.`)
                                reloadData()
                            }
                        } else {
                            alert('Error importing data: ' + error.message)
                        }
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

        const csvContent = `subject,unit_no,period_no,proposed_date,topic,actual_completion_date,remarks\n${defaultSubject},1,1,2024-01-20,Introduction to Calculus,2024-01-20,Completed`
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
            unit_no: item.unit_no || '',
            period_no: item.period_no,
            proposed_date: item.proposed_date ? format(new Date(item.proposed_date), 'yyyy-MM-dd') : '',
            topic: item.topic,
            actual_completion_date: item.actual_completion_date ? format(new Date(item.actual_completion_date), 'yyyy-MM-dd') : '',
            remarks: item.remarks || ''
        }));

        const csv = Papa.unparse(csvRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `lecture_plans_${selectedSubject || 'all'}_${format(new Date(), 'yyyyMMdd')}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    const handlePrint = () => {
        const dataToPrint = selectedSubject ? filteredData : data;

        if (dataToPrint.length === 0) {
            alert('No data to print');
            return;
        }

        // Create print window content
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const subjectName = selectedSubject || 'All Subjects';
        const currentDate = format(new Date(), 'dd/MM/yyyy');
        
        let printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lecture Plan - ${subjectName}</title>
                <style>
                    @media print {
                        @page {
                            size: A4;
                            margin: 1cm;
                        }
                        body {
                            margin: 0;
                            padding: 20px;
                            font-family: Arial, sans-serif;
                            font-size: 12px;
                        }
                        .no-print {
                            display: none;
                        }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 18px;
                        font-weight: bold;
                    }
                    .header p {
                        margin: 5px 0;
                        font-size: 12px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 8px;
                        text-align: left;
                        font-size: 11px;
                    }
                    th {
                        background-color: #f0f0f0;
                        font-weight: bold;
                        text-align: center;
                    }
                    td {
                        text-align: left;
                    }
                    .completed {
                        text-align: center;
                    }
                    .footer {
                        margin-top: 30px;
                        text-align: right;
                        font-size: 11px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>LECTURE PLAN</h1>
                    <p><strong>Subject:</strong> ${subjectName}</p>
                    <p><strong>Academic Year:</strong> ${academicYear} | <strong>Semester:</strong> ${semesterType}</p>
                    <p><strong>Date:</strong> ${currentDate}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">S.No</th>
                            <th style="width: 8%;">Unit No</th>
                            <th style="width: 8%;">Period</th>
                            <th style="width: 12%;">Proposed Date</th>
                            <th style="width: 35%;">Topic</th>
                            <th style="width: 12%;">Actual Date</th>
                            <th style="width: 5%;">Status</th>
                            <th style="width: 15%;">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        dataToPrint.forEach((item, index) => {
            const proposedDate = item.proposed_date ? format(new Date(item.proposed_date), 'dd/MM/yyyy') : '-';
            const actualDate = item.actual_completion_date ? format(new Date(item.actual_completion_date), 'dd/MM/yyyy') : '-';
            const status = item.actual_completion_date ? '✓' : '';
            const unitNo = item.unit_no || '-';
            
            printContent += `
                        <tr>
                            <td style="text-align: center;">${index + 1}</td>
                            <td style="text-align: center;">${unitNo}</td>
                            <td style="text-align: center;">${item.period_no}</td>
                            <td style="text-align: center;">${proposedDate}</td>
                            <td>${item.topic || '-'}</td>
                            <td style="text-align: center;">${actualDate}</td>
                            <td style="text-align: center;">${status}</td>
                            <td>${item.remarks || '-'}</td>
                        </tr>
            `;
        });

        printContent += `
                    </tbody>
                </table>
                <div class="footer">
                    <p>Total Topics: ${dataToPrint.length} | Completed: ${dataToPrint.filter(item => item.actual_completion_date).length}</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait for content to load, then print
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }

    // Filter data based on selected subject
    // We try to match loosely by checking if the data subject content is included in our selected Subject Name
    // or if the subject name is the selected subject.
    const filteredData = selectedSubject
        ? data.filter(item => {
            // Find the full subject object for the selected value
            const subjObj = subjects.find(s => s.displayName === selectedSubject);
            if (!subjObj) return item.subject === selectedSubject; // Fallback

            // Allow flexibility: if the plan says "Mathematics" and our subject is "SUB101 - Mathematics",
            // we want to match "Mathematics".
            // Or if plan says "SUB101", we match "SUB101".
            return item.subject === subjObj.name || item.subject === subjObj.code || item.subject === selectedSubject;
        })
        : [];

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
        { accessorKey: 'unit_no', header: 'Unit No' },
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

    const handleAddItem = () => {
        // Pre-fill subject if selected
        const subjObj = subjects.find(s => s.displayName === selectedSubject);
        setEditingItem({
            subject: subjObj ? subjObj.name : ''
        });
        setOpen(true);
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            {!selectedSubject ? (
                // Show only dropdown when no subject is selected
                <div className="flex flex-col gap-4">
                    <h1 className="text-3xl font-bold">Lecture Plan</h1>
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

                        {/* Subject Filter */}
                        <div className="grid gap-2 w-full max-w-md">
                            <Label>Select Subject</Label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={loadingSubjects}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder={loadingSubjects ? "Loading subjects..." : "Select a subject to view plan..."} />
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
            ) : (
                // Show everything when subject is selected
                <>
                    <div className="flex flex-col gap-4">
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
                                <Button variant="outline" onClick={handlePrint} title="Print Lecture Plan" disabled={!selectedSubject || (selectedSubject ? filteredData.length === 0 : data.length === 0)}>
                                    <Printer className="w-4 h-4 mr-2" />
                                    Print
                                </Button>
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
                                <Button onClick={handleAddItem}>
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

                            {/* Subject Filter */}
                            <div className="grid gap-2 w-full max-w-md">
                                <Label>Select Subject</Label>
                                <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={loadingSubjects}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder={loadingSubjects ? "Loading subjects..." : "Select a subject to view plan..."} />
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

                    <DataTable columns={columns} data={filteredData} />
                </>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Lecture Plan</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                                id="subject"
                                value={editingItem?.subject || ''}
                                onChange={e => setEditingItem({ ...editingItem, subject: e.target.value })}
                                required
                            />
                            {/* Helper hint */}
                            {selectedSubject && (
                                <p className="text-xs text-muted-foreground">
                                    Current filter: {selectedSubject}
                                </p>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="unit_no">Unit No</Label>
                                <Input id="unit_no" type="number" value={editingItem?.unit_no || ''} onChange={e => setEditingItem({ ...editingItem, unit_no: e.target.value ? parseInt(e.target.value) : null })} />
                            </div>
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
