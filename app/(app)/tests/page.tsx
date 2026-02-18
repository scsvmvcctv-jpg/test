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
import { Loader2, Plus, Pencil, Trash2, Upload, Download, FileDown, Printer } from 'lucide-react'
import { fetchFilterOptions } from '@/app/actions/assessment'
import { ColumnDef } from '@tanstack/react-table'
import { formatInAppTz, getTodayInAppTz, parseCSVDateToAppTz } from '@/lib/datetime'
import Papa from 'papaparse'

type Test = {
    id: string
    subject: string
    section: string | null
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

type DeptOption = { id: string; name: string }
const FALLBACK_DEPARTMENTS: DeptOption[] = [
    { id: '1', name: 'CSE' }, { id: '2', name: 'ECE' }, { id: '3', name: 'EEE' },
    { id: '4', name: 'MECH' }, { id: '5', name: 'CIVIL' }, { id: '6', name: 'IT' }, { id: '7', name: 'AUTO' }
]

const SECTION_OPTIONS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']
// Subject and section from dropdown; CSV has no subject/section columns
const EXPECTED_CSV_HEADERS = ['proposed_test_date', 'actual_date', 'date_returned', 'remarks']

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
    const [selectedSubject, setSelectedSubject] = useState<string>("__ALL__")
    const [selectedSection, setSelectedSection] = useState<string>("")
    const [loadingSubjects, setLoadingSubjects] = useState(false)

    // Academic Year and Semester Filter State
    const [academicYear, setAcademicYear] = useState<string>("2025-2026")
    const [semesterType, setSemesterType] = useState<string>("Even")

    // Store user profile data for refetching
    const [userProfile, setUserProfile] = useState<{ emp_id: string; department_no: string } | null>(null)
    const [departments, setDepartments] = useState<DeptOption[]>([])

    useEffect(() => {
        initializeData()
    }, [])

    // Re-fetch subjects when Academic Year or Semester changes
    useEffect(() => {
        const refetchSubjects = async () => {
            if (userProfile?.emp_id && userProfile?.department_no) {
                setLoadingSubjects(true)
                await fetchSubjects(userProfile.emp_id, userProfile.department_no, academicYear, semesterType, departments)
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

        // Fetch departments for "other dept" subjects (same as lecture-plan)
        let deptList: DeptOption[] = []
        const filterResult = await fetchFilterOptions()
        if (filterResult.success && filterResult.data) {
            const raw = filterResult.data as any
            const arr = raw.departments ?? raw.Department ?? raw.Dept
            if (Array.isArray(arr) && arr.length) {
                deptList = arr.map((d: any) => ({
                    id: String(d.DeptID ?? d.DeptNo ?? d.DepartmentNo ?? d.id ?? ''),
                    name: d.DepartmentName || d.DeptName || d.name || 'Unknown'
                })).filter((d: DeptOption) => d.id)
            }
        }
        if (!deptList.length) deptList = [...FALLBACK_DEPARTMENTS]
        setDepartments(deptList)

        // Fetch User Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('emp_id, department_no')
            .eq('id', user.id)
            .single()

        if (profile?.emp_id && profile?.department_no) {
            setUserProfile({ emp_id: profile.emp_id, department_no: profile.department_no })
            await fetchSubjects(profile.emp_id, profile.department_no, academicYear, semesterType, deptList)
        }

        // Fetch Tests
        await fetchTests(user.id)

        setLoading(false)
        setLoadingSubjects(false)
    }

    const fetchSubjects = async (
        empId: string,
        deptId: string,
        filterYear?: string,
        filterSemester?: string,
        depts: DeptOption[] = []
    ) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const fetchWorkloadForDept = async (dept: string): Promise<any[]> => {
                const res = await fetch(`/api/faculty-workload?EmpId=${empId}&Dept=${dept}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await res.json();
                if (!res.ok || result?.error) return [];
                const arr = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
                return arr;
            };

            const applyYearSemesterFilter = (items: any[]) => {
                let filtered = items;
                if (filterYear && filtered.length) {
                    const yearPrefix = filterYear.split('-')[0];
                    filtered = filtered.filter((item: any) => {
                        const y = item.Academicyear;
                        return y === filterYear || (typeof y === 'string' && y.startsWith(yearPrefix));
                    });
                }
                if (filterSemester) {
                    filtered = filtered.filter((item: any) => {
                        const sem = Number(item.Semester);
                        if (filterSemester === "Odd") return sem % 2 !== 0;
                        if (filterSemester === "Even") return sem % 2 === 0;
                        return true;
                    });
                }
                return filtered;
            };

            const uniqueBySubject = new Map<string, SubjectItem>();
            const otherDeptIds = depts.map(d => d.id).filter(id => String(id) !== String(deptId));

            const ownDeptData = await fetchWorkloadForDept(deptId);
            const ownFiltered = applyYearSemesterFilter(ownDeptData);
            ownFiltered.forEach((item: any) => {
                if (!item.SubjectCode || !item.Subject_Name) return;
                const key = `${item.SubjectCode}|${item.Subject_Name}`;
                const displayName = `${item.SubjectCode} - ${item.Subject_Name}`;
                if (!uniqueBySubject.has(key)) {
                    uniqueBySubject.set(key, { code: item.SubjectCode, name: item.Subject_Name, displayName });
                }
            });

            for (const otherId of otherDeptIds) {
                const otherData = await fetchWorkloadForDept(otherId);
                const otherFiltered = applyYearSemesterFilter(otherData);
                otherFiltered.forEach((item: any) => {
                    if (!item.SubjectCode || !item.Subject_Name) return;
                    const key = `${item.SubjectCode}|${item.Subject_Name}`;
                    const displayName = `${item.SubjectCode} - ${item.Subject_Name}`;
                    if (!uniqueBySubject.has(key)) {
                        uniqueBySubject.set(key, { code: item.SubjectCode, name: item.Subject_Name, displayName });
                    }
                });
            }

            const merged = Array.from(uniqueBySubject.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
            setSubjects(merged);

            if (selectedSubject && selectedSubject !== '__ALL__') {
                const exists = merged.some(s => s.displayName === selectedSubject);
                if (!exists) setSelectedSubject('__ALL__');
            }
        } catch (error) {
            console.error("Failed to fetch subjects", error);
            setSubjects([]);
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

        const item: any = {
            ...editingItem,
            staff_id: user.id,
        }
        if (item.section === '' || item.section === undefined) {
            item.section = null
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

    const handleImportClick = () => {
        if (!selectedSubject || selectedSubject === '__ALL__') {
            alert('Please select a subject from the dropdown before importing CSV.')
            return
        }
        if (!selectedSection) {
            alert('Please select a section from the dropdown before importing CSV.')
            return
        }
        fileInputRef.current?.click()
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (!selectedSubject || selectedSubject === '__ALL__') {
            alert('Please select a subject from the dropdown before importing CSV.')
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }
        if (!selectedSection) {
            alert('Please select a section from the dropdown before importing CSV.')
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }

        setImporting(true)
        const subjObj = subjects.find(s => s.displayName === selectedSubject)
        const importSubjectName = subjObj?.name ?? selectedSubject
        const importSection = selectedSection || null

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setImporting(false)
                    return
                }

                const fileHeaders = results.meta?.fields ?? (Array.isArray(results.data) && results.data[0] ? Object.keys(results.data[0] as object) : [])
                const normalized = fileHeaders.map((h: string) => String(h).trim().toLowerCase())
                const missing = EXPECTED_CSV_HEADERS.filter(h => !normalized.includes(h))
                if (missing.length > 0) {
                    alert(`Invalid CSV format. Expected columns: ${EXPECTED_CSV_HEADERS.join(', ')}\n\nMissing: ${missing.join(', ')}\n\nPlease download the sample CSV and use that format.`)
                    setImporting(false)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                    return
                }

                const rows = results.data as any[]
                const validRows = rows.map(row => {
                    const proposed = parseCSVDateToAppTz(row.proposed_test_date || row.ProposedTestDate || row.ProposedDate || '')
                    const actual = parseCSVDateToAppTz(row.actual_date || row.ActualDate || '')
                    const returned = parseCSVDateToAppTz(row.date_returned || row.DateReturned || row.ReturnedDate || '')

                    const item: any = {
                        staff_id: user.id,
                        subject: importSubjectName,
                        section: importSection,
                        proposed_test_date: proposed || null,
                        actual_date: actual || null,
                        date_returned: returned || null,
                        remarks: row.remarks || row.Remarks
                    }
                    if (row.id && row.id.trim() !== '') item.id = row.id.trim()
                    return item
                }).filter(row => row.proposed_test_date)

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
        const csvContent = `proposed_test_date,actual_date,date_returned,remarks\n2024-02-15,2024-02-15,2024-02-20,Unit Test 1`
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
        const dataToExport = dataToShow;

        if (dataToExport.length === 0) {
            alert('No data to export');
            return;
        }

        // Map data to CSV format
        const csvRows = dataToExport.map(item => ({
            id: item.id,
            subject: item.subject,
            section: item.section || '',
            proposed_test_date: item.proposed_test_date ? formatInAppTz(item.proposed_test_date, 'yyyy-MM-dd') : '',
            actual_date: item.actual_date ? formatInAppTz(item.actual_date, 'yyyy-MM-dd') : '',
            date_returned: item.date_returned ? formatInAppTz(item.date_returned, 'yyyy-MM-dd') : '',
            remarks: item.remarks || ''
        }));

        const csv = Papa.unparse(csvRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `tests_schedule_${showAllSubjects ? 'all' : selectedSubject}_${getTodayInAppTz('yyyyMMdd')}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    const handlePrint = () => {
        const dataToPrint = dataToShow;

        if (dataToPrint.length === 0) {
            alert('No data to print');
            return;
        }

        // Create print window content
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const subjectName = showAllSubjects ? 'All Subjects' : selectedSubject;
        const sectionLabel = selectedSection ? ` | Section: ${selectedSection}` : '';
        const currentDate = getTodayInAppTz('dd/MM/yyyy');
        
        let printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tests Schedule - ${subjectName}${sectionLabel}</title>
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
                    .footer {
                        margin-top: 30px;
                        text-align: right;
                        font-size: 11px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>TESTS SCHEDULE</h1>
                    <p><strong>Subject:</strong> ${subjectName}${sectionLabel}</p>
                    <p><strong>Academic Year:</strong> ${academicYear} | <strong>Semester:</strong> ${semesterType}</p>
                    <p><strong>Date:</strong> ${currentDate}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">S.No</th>
                            <th style="width: 8%;">Section</th>
                            <th style="width: 18%;">Subject</th>
                            <th style="width: 15%;">Proposed Date</th>
                            <th style="width: 15%;">Actual Date</th>
                            <th style="width: 15%;">Date Returned</th>
                            <th style="width: 30%;">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        dataToPrint.forEach((item, index) => {
            const proposedDate = item.proposed_test_date ? formatInAppTz(item.proposed_test_date, 'dd/MM/yyyy') : '-';
            const actualDate = item.actual_date ? formatInAppTz(item.actual_date, 'dd/MM/yyyy') : '-';
            const returnedDate = item.date_returned ? formatInAppTz(item.date_returned, 'dd/MM/yyyy') : '-';
            
            printContent += `
                        <tr>
                            <td style="text-align: center;">${index + 1}</td>
                            <td style="text-align: center;">${item.section || '-'}</td>
                            <td>${item.subject || '-'}</td>
                            <td style="text-align: center;">${proposedDate}</td>
                            <td style="text-align: center;">${actualDate}</td>
                            <td style="text-align: center;">${returnedDate}</td>
                            <td>${item.remarks || '-'}</td>
                        </tr>
            `;
        });

        printContent += `
                    </tbody>
                </table>
                <div class="footer">
                    <p>Total Tests: ${dataToPrint.length}</p>
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

    const showAllSubjects = selectedSubject === '__ALL__'
    const filteredData = !showAllSubjects && selectedSubject
        ? data.filter(item => {
            const subjObj = subjects.find(s => s.displayName === selectedSubject);
            const subjectMatch = !subjObj ? item.subject === selectedSubject : (item.subject === subjObj.name || item.subject === subjObj.code || item.subject === selectedSubject);
            if (!subjectMatch) return false;
            if (selectedSection) {
                return (item.section || '') === selectedSection;
            }
            return true;
        })
        : []
    const dataToShow = showAllSubjects
        ? (selectedSection ? data.filter(item => (item.section || '') === selectedSection) : data)
        : filteredData

    const columns: ColumnDef<Test>[] = [
        { accessorKey: 'subject', header: 'Subject' },
        { accessorKey: 'section', header: 'Section', cell: ({ row }) => row.original.section || '-' },
        {
            accessorKey: 'proposed_test_date',
            header: 'Proposed Date',
            cell: ({ row }) => row.original.proposed_test_date ? formatInAppTz(row.original.proposed_test_date, 'dd/MM/yyyy') : '-'
        },
        {
            accessorKey: 'actual_date',
            header: 'Actual Date',
            cell: ({ row }) => row.original.actual_date ? formatInAppTz(row.original.actual_date, 'dd/MM/yyyy') : '-'
        },
        {
            accessorKey: 'date_returned',
            header: 'Returned Date',
            cell: ({ row }) => row.original.date_returned ? formatInAppTz(row.original.date_returned, 'dd/MM/yyyy') : '-'
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
        const subjObj = (selectedSubject && selectedSubject !== '__ALL__') ? subjects.find(s => s.displayName === selectedSubject) : undefined
        setEditingItem({ subject: subjObj ? subjObj.name : '', section: selectedSection || null })
        setOpen(true)
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <>
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
                                <Button variant="outline" onClick={handlePrint} title="Print Tests Schedule" disabled={dataToShow.length === 0}>
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
                                <Button variant="outline" onClick={handleImportClick} disabled={importing}>
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
                                <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedSection(''); }} disabled={loadingSubjects}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder={loadingSubjects ? "Loading subjects..." : "All subjects (show all uploaded)"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__ALL__">All subjects (show all uploaded)</SelectItem>
                                        {subjects.map((subj) => (
                                            <SelectItem key={subj.displayName} value={subj.displayName}>
                                                {subj.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Section Filter */}
                            <div className="grid gap-2">
                                <Label>Section</Label>
                                <Select value={selectedSection || "ALL"} onValueChange={(v) => setSelectedSection(v === "ALL" ? "" : v)}>
                                    <SelectTrigger className="w-[100px] h-8 bg-background">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All</SelectItem>
                                        {SECTION_OPTIONS.map((sec) => (
                                            <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

            <DataTable columns={columns} data={dataToShow} />
            </>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Test</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={editingItem?.subject || ''} onChange={e => setEditingItem({ ...editingItem, subject: e.target.value })} required />
                            {selectedSubject && selectedSubject !== '__ALL__' && (
                                <p className="text-xs text-muted-foreground">
                                    Current filter: {selectedSubject}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label>Section</Label>
                            <Select value={editingItem?.section || "ALL"} onValueChange={(v) => setEditingItem({ ...editingItem, section: v === "ALL" ? null : v })}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All</SelectItem>
                                    {SECTION_OPTIONS.map((sec) => (
                                        <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
