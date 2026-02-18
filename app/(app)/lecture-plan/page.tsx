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
import { fetchFilterOptions } from '@/app/actions/assessment'
import { ColumnDef } from '@tanstack/react-table'
import { formatInAppTz, getTodayInAppTz, parseCSVDateToAppTz } from '@/lib/datetime'
import Papa from 'papaparse'

type LecturePlan = {
    id: string
    subject: string
    section: string | null
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

type DeptOption = { id: string; name: string }

// Fallback when filter-options has no departments (matches workload page deptMap)
const FALLBACK_DEPARTMENTS: DeptOption[] = [
    { id: '1', name: 'CSE' }, { id: '2', name: 'ECE' }, { id: '3', name: 'EEE' },
    { id: '4', name: 'MECH' }, { id: '5', name: 'CIVIL' }, { id: '6', name: 'IT' }, { id: '7', name: 'AUTO' }
]

// Section options (S1 through S10)
const SECTION_OPTIONS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']

// Expected CSV headers (must match sample file format exactly; subject and section omitted from file)
const EXPECTED_CSV_HEADERS = ['unit_no', 'period_no', 'proposed_date', 'topic', 'actual_completion_date', 'remarks']

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
    const [selectedSubject, setSelectedSubject] = useState<string>("__ALL__")
    const [selectedSection, setSelectedSection] = useState<string>("")
    const [loadingSubjects, setLoadingSubjects] = useState(false)

    // Academic Year and Semester Filter State
    const [academicYear, setAcademicYear] = useState<string>("2025-2026")
    const [semesterType, setSemesterType] = useState<string>("Even")

    // Store user profile data for refetching
    const [userProfile, setUserProfile] = useState<{ emp_id: string; department_no: string } | null>(null)

    // All departments (for fetching other-dept subjects)
    const [departments, setDepartments] = useState<DeptOption[]>([])

    // Multi-select for bulk delete
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState(false)

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

        // Fetch departments for "other dept" subjects
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

        // Fetch Lecture Plans
        await fetchLecturePlans(user.id)

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

            // Deduplicate by SubjectCode + Subject_Name only (same as workload page faculty subject list)
            const uniqueBySubject = new Map<string, SubjectItem>();
            const otherDeptIds = depts.map(d => d.id).filter(id => String(id) !== String(deptId));

            // 1. User's own department workload
            const ownDeptData = await fetchWorkloadForDept(deptId);
            const ownFiltered = applyYearSemesterFilter(ownDeptData);
            ownFiltered.forEach((item: any) => {
                if (!item.SubjectCode || !item.Subject_Name) return;
                const key = `${item.SubjectCode}|${item.Subject_Name}`;
                const displayName = `${item.SubjectCode} - ${item.Subject_Name}`;
                if (!uniqueBySubject.has(key)) {
                    uniqueBySubject.set(key, {
                        code: item.SubjectCode,
                        name: item.Subject_Name,
                        displayName
                    });
                }
            });

            // 2. Other departments (faculty workload only) – same subject key = no duplicate in dropdown
            for (const otherId of otherDeptIds) {
                const otherData = await fetchWorkloadForDept(otherId);
                const otherFiltered = applyYearSemesterFilter(otherData);
                otherFiltered.forEach((item: any) => {
                    if (!item.SubjectCode || !item.Subject_Name) return;
                    const key = `${item.SubjectCode}|${item.Subject_Name}`;
                    const displayName = `${item.SubjectCode} - ${item.Subject_Name}`;
                    if (!uniqueBySubject.has(key)) {
                        uniqueBySubject.set(key, {
                            code: item.SubjectCode,
                            name: item.Subject_Name,
                            displayName
                        });
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
        if (item.unit_no === null || item.unit_no === undefined || item.unit_no === '') {
            delete item.unit_no
        }
        // Normalize section: empty string -> null
        if (item.section === '' || item.section === undefined) {
            item.section = null
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
        if (!error) {
            setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
            reloadData()
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        const ids = dataToShow.map(row => row.id)
        if (selectedIds.size >= ids.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(ids))
        }
    }

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Delete ${selectedIds.size} selected row(s)?`)) return
        setDeleting(true)
        const ids = Array.from(selectedIds)
        const { error } = await supabase.from('lecture_plans').delete().in('id', ids)
        setDeleting(false)
        if (!error) {
            setSelectedIds(new Set())
            reloadData()
        } else {
            alert('Error deleting: ' + error.message)
        }
    }

    const toggleCompletion = async (item: LecturePlan, checked: boolean) => {
        const updates = {
            actual_completion_date: checked ? getTodayInAppTz('yyyy-MM-dd') : null,
        }

        // Optimistic update
        setData(prev => prev.map(p => p.id === item.id ? { ...p, ...updates } : p))

        const { error } = await supabase.from('lecture_plans').update(updates).eq('id', item.id)
        if (error) {
            alert('Error updating status')
            reloadData() // Revert on error
        }
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

                // Validate CSV headers match sample format exactly
                const fileHeaders = results.meta?.fields ?? (Array.isArray(results.data) && results.data[0] ? Object.keys(results.data[0] as object) : [])
                const normalizedFileHeaders = fileHeaders.map((h: string) => String(h).trim().toLowerCase())
                const missingHeaders = EXPECTED_CSV_HEADERS.filter(h => !normalizedFileHeaders.includes(h))
                const expectedStr = EXPECTED_CSV_HEADERS.join(', ')

                if (missingHeaders.length > 0) {
                    alert(`Invalid CSV format. The uploaded file must match the sample file format.\n\nExpected columns:\n${expectedStr}\n\nMissing in your file: ${missingHeaders.join(', ')}\n\nPlease download the sample CSV (click "Sample CSV" button) and use that exact format.`)
                    setImporting(false)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                    return
                }

                const rows = results.data as any[]
                const validRows = rows.map(row => {
                    // Parse dates as calendar dates in Asia/Kolkata so stored date matches CSV (no one-day shift)
                    const proposedDate = parseCSVDateToAppTz(row.proposed_date || row.ProposedDate || '')
                    const actualDate = parseCSVDateToAppTz(row.actual_completion_date || row.ActualDate || '')

                    // Subject and section come from dropdown selection (required before import)
                    const item: any = {
                        staff_id: user.id,
                        subject: importSubjectName,
                        section: importSection,
                        period_no: parseInt(row.period_no || row.Period || '0'),
                        proposed_date: proposedDate || null,
                        topic: row.topic || row.Topic,
                        actual_completion_date: actualDate || null,
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
                }).filter(row => row.topic)

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
        const csvContent = `unit_no,period_no,proposed_date,topic,actual_completion_date,remarks\n1,1,02-MAR-2026,Introduction to Calculus,02-MAR-2026,Completed`
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
            unit_no: item.unit_no || '',
            period_no: item.period_no,
            proposed_date: item.proposed_date ? formatInAppTz(item.proposed_date, 'yyyy-MM-dd') : '',
            topic: item.topic,
            actual_completion_date: item.actual_completion_date ? formatInAppTz(item.actual_completion_date, 'yyyy-MM-dd') : '',
            remarks: item.remarks || ''
        }));

        const csv = Papa.unparse(csvRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `lecture_plans_${showAllSubjects ? 'all' : selectedSubject}_${getTodayInAppTz('yyyyMMdd')}.csv`);
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
                <title>Lecture Plan - ${subjectName}${sectionLabel}</title>
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
                    <p><strong>Subject:</strong> ${subjectName}${sectionLabel}</p>
                    <p><strong>Academic Year:</strong> ${academicYear} | <strong>Semester:</strong> ${semesterType}</p>
                    <p><strong>Date:</strong> ${currentDate}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">S.No</th>
                            <th style="width: 8%;">Section</th>
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
            const proposedDate = item.proposed_date ? formatInAppTz(item.proposed_date, 'dd/MM/yyyy') : '-';
            const actualDate = item.actual_completion_date ? formatInAppTz(item.actual_completion_date, 'dd/MM/yyyy') : '-';
            const status = item.actual_completion_date ? '✓' : '';
            const unitNo = item.unit_no || '-';
            const section = item.section || '-';
            
            printContent += `
                        <tr>
                            <td style="text-align: center;">${index + 1}</td>
                            <td style="text-align: center;">${section}</td>
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

    const showAllSubjects = selectedSubject === '__ALL__';
    // Filter data based on selected subject and section (when subject selected)
    const filteredData = !showAllSubjects && selectedSubject
        ? data.filter(item => {
            const subjObj = subjects.find(s => s.displayName === selectedSubject);
            const subjectMatch = !subjObj
                ? item.subject === selectedSubject
                : (item.subject === subjObj.name || item.subject === subjObj.code || item.subject === selectedSubject);
            if (!subjectMatch) return false;
            if (selectedSection) {
                const itemSection = item.section || '';
                return itemSection === selectedSection;
            }
            return true;
        })
        : [];
    // Data to display: all when "__ALL__" (optionally filter by section), filtered when subject selected
    const dataToShow = showAllSubjects
        ? (selectedSection ? data.filter(item => (item.section || '') === selectedSection) : data)
        : filteredData;

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
        { accessorKey: 'section', header: 'Section', cell: ({ row }) => row.original.section || '-' },
        { accessorKey: 'unit_no', header: 'Unit No' },
        { accessorKey: 'period_no', header: 'Period' },
        {
            accessorKey: 'proposed_date',
            header: 'Proposed Date',
            cell: ({ row }) => row.original.proposed_date ? formatInAppTz(row.original.proposed_date, 'dd/MM/yyyy') : '-'
        },
        { accessorKey: 'topic', header: 'Topic' },
        {
            accessorKey: 'actual_completion_date',
            header: 'Actual Date',
            cell: ({ row }) => row.original.actual_completion_date ? formatInAppTz(row.original.actual_completion_date, 'dd/MM/yyyy') : '-'
        },
        { accessorKey: 'remarks', header: 'Remarks' },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingItem(row.original); setOpen(true); }} title="Edit">
                        <Pencil className="w-4 h-4" />
                    </Button>
                </div>
            )
        },
        {
            id: 'select',
            header: () => (
                <Checkbox
                    checked={dataToShow.length > 0 && selectedIds.size >= dataToShow.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={selectedIds.has(row.original.id)}
                    onCheckedChange={() => toggleSelect(row.original.id)}
                    aria-label="Select row"
                />
            )
        }
    ]

    const handleAddItem = () => {
        const subjObj = (selectedSubject && selectedSubject !== '__ALL__') ? subjects.find(s => s.displayName === selectedSubject) : undefined;
        setEditingItem({
            subject: subjObj ? subjObj.name : '',
            section: selectedSection || null
        });
        setOpen(true);
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            {/* Always show filters, buttons, and table (all uploaded files when no subject selected) */}
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
                                <Button variant="outline" onClick={handlePrint} title="Print Lecture Plan" disabled={dataToShow.length === 0}>
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
                                <Button
                                    variant="destructive"
                                    onClick={handleDeleteSelected}
                                    disabled={selectedIds.size === 0 || deleting}
                                    title="Delete selected rows"
                                >
                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Delete selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
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
                                <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedSection(""); }} disabled={loadingSubjects}>
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
                            {selectedSubject && selectedSubject !== '__ALL__' && (
                                <p className="text-xs text-muted-foreground">
                                    Current filter: {selectedSubject}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="section">Section</Label>
                            <Select
                                value={editingItem?.section || "NONE"}
                                onValueChange={(v) => setEditingItem({ ...editingItem, section: v === "NONE" ? null : v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select section (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">—</SelectItem>
                                    {SECTION_OPTIONS.map((sec) => (
                                        <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
