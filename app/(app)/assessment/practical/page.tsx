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
import { Loader2, Plus, Pencil, Trash2, Upload, Download, FileDown, Search, Save, CheckSquare, AlertCircle, Edit2, X } from 'lucide-react'
import { ColumnDef } from '@tanstack/react-table'
import Papa from 'papaparse'
import { Checkbox } from '@/components/ui/checkbox'
import { getTodayInAppTz } from '@/lib/datetime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchFilterOptions, fetchStudentData } from '@/app/actions/assessment'

type PracticalAssessment = {
    id?: string
    subject: string
    student_id: string
    observations?: number
    model_test?: number
    record_attendance?: number
    total?: number
}

type SubjectItem = {
    code: string
    name: string
    displayName: string
    /** From faculty workload (first row for this subject) - used to auto-fill Course/Semester/Mode */
    courseRaw?: string
    semester?: string
    mode?: string
}

export default function PracticalAssessmentPage() {
    const [data, setData] = useState<PracticalAssessment[]>([])
    const [loading, setLoading] = useState(true)
    const [editingItem, setEditingItem] = useState<Partial<PracticalAssessment> | null>(null)
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

    // Student Filter State
    const [filterOptions, setFilterOptions] = useState<any>(null)
    const [loadingFilters, setLoadingFilters] = useState(true)
    const [filterError, setFilterError] = useState<string | null>(null)
    const [selectedYear, setSelectedYear] = useState('2025-2026')
    const [selectedCourse, setSelectedCourse] = useState('')
    const [selectedSemester, setSelectedSemester] = useState('2')
    const [selectedMode, setSelectedMode] = useState('')
    const [selectedSection, setSelectedSection] = useState('ALL')
    const [students, setStudents] = useState<any[]>([])
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [studentError, setStudentError] = useState<string | null>(null)
    const [hasSearched, setHasSearched] = useState(false)
    const [studentMarks, setStudentMarks] = useState<Map<string, PracticalAssessment>>(new Map())
    const [loadingMarks, setLoadingMarks] = useState(false)

    // Inline Edit State
    const [editMode, setEditMode] = useState(false)
    const [editingMarks, setEditingMarks] = useState<Map<string, { observations?: number, model_test?: number, record_attendance?: number }>>(new Map())
    const [savingInline, setSavingInline] = useState(false)

    // Student Selection State
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
    const [bulkAssessmentDialogOpen, setBulkAssessmentDialogOpen] = useState(false)
    const [bulkAssessmentForm, setBulkAssessmentForm] = useState<{
        observations?: number
        model_test?: number
        record_attendance?: number
    }>({
        observations: undefined,
        model_test: undefined,
        record_attendance: undefined
    })
    const [savingBulk, setSavingBulk] = useState(false)

    useEffect(() => {
        initializeData()
        loadFilterOptions()
    }, [])

    const loadFilterOptions = async () => {
        setLoadingFilters(true)
        const result = await fetchFilterOptions()
        if (result.success) {
            const data = result.data as any
            setFilterOptions(data)
            const courses = data?.courses
            if (Array.isArray(courses) && courses.length > 0) {
                const first = courses[0]
                setSelectedCourse(first.CourseName ?? first ?? '')
            } else {
                setSelectedCourse('BE')
            }
        } else {
            setFilterError(result.error)
        }
        setLoadingFilters(false)
    }

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

    const resolveCourseDisplay = (courseRaw: string | undefined): string => {
        if (!courseRaw) return ''
        if (!filterOptions?.courses?.length) return courseRaw
        const c = filterOptions.courses.find((x: any) =>
            x.CourseID === courseRaw || x.CourseNo === courseRaw || x.CourseName === courseRaw ||
            String(x.CourseID) === String(courseRaw) || String(x.CourseNo) === String(courseRaw))
        return (c?.CourseName ?? c?.CourseNo ?? c?.CourseID) ?? courseRaw
    }

    useEffect(() => {
        if (!selectedSubject || !subjects.length) return
        const subject = subjects.find((s) => s.displayName === selectedSubject)
        if (!subject) return
        setSelectedCourse(resolveCourseDisplay(subject.courseRaw))
        if (subject.semester != null && subject.semester !== '') setSelectedSemester(subject.semester)
        if (subject.mode != null && subject.mode !== '') setSelectedMode(subject.mode)
    }, [selectedSubject, subjects, filterOptions])

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

        // Fetch Assessment Practical
        await fetchAssessments(user.id)

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

                // Extract unique subjects from filtered data; keep course/semester/mode from first row for auto-fill
                const uniqueSubjects = new Map<string, SubjectItem>();

                filteredData.forEach((item: any) => {
                    if (item.SubjectCode && item.Subject_Name) {
                        const key = `${item.SubjectCode}-${item.Subject_Name}`;
                        if (!uniqueSubjects.has(key)) {
                            uniqueSubjects.set(key, {
                                code: item.SubjectCode,
                                name: item.Subject_Name,
                                displayName: `${item.SubjectCode} - ${item.Subject_Name}`,
                                courseRaw: item.CourseName ?? item.Course,
                                semester: item.Semester != null ? String(item.Semester) : undefined,
                                mode: item.Mode ?? undefined
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

    const fetchAssessments = async (userId: string) => {
        const { data } = await supabase
            .from('assessment_practical')
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

        // Build item object, excluding total (it's GENERATED ALWAYS)
        const item: any = {
            ...editingItem,
            staff_id: user.id,
        }

        // Remove total if present (it's auto-calculated)
        delete item.total

        let error
        if (item.id) {
            const { error: updateError } = await supabase.from('assessment_practical').update(item).eq('id', item.id)
            error = updateError
        } else {
            const { error: insertError } = await supabase.from('assessment_practical').insert(item)
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
        const { error } = await supabase.from('assessment_practical').delete().eq('id', id)
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
                    // Note: 'total' is a GENERATED ALWAYS column, so we don't include it
                    const item: any = {
                        staff_id: user.id,
                        subject: row.subject || row.Subject,
                        student_id: row.student_id || row.StudentId || row.RegisterNo,
                        observations: row.observations || row.Observations ? parseFloat(row.observations || row.Observations || '0') : null,
                        model_test: row.model_test || row.ModelTest ? parseFloat(row.model_test || row.ModelTest || '0') : null,
                        record_attendance: row.record_attendance || row.RecordAttendance ? parseFloat(row.record_attendance || row.RecordAttendance || '0') : null
                    }

                    // If ID exists in CSV, include it for update
                    if (row.id && row.id.trim() !== '') {
                        item.id = row.id.trim()
                    }

                    return item
                }).filter(row => row.subject && row.student_id)

                if (validRows.length > 0) {
                    // Using upsert to handle both inserts and updates
                    const { error } = await supabase.from('assessment_practical').upsert(validRows)

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

        const csvContent = `id,subject,student_id,observations,model_test,record_attendance\n,${defaultSubject},11199A001,12,13,9\n,${defaultSubject},11199A002,14,11,8`
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', 'practical_assessment_sample.csv')
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
            student_id: item.student_id,
            observations: item.observations,
            model_test: item.model_test,
            record_attendance: item.record_attendance,
            total: item.total // Including total just in case, though it's calculated
        }));

        const csv = Papa.unparse(csvRows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `practical_assessment_${selectedSubject || 'all'}_${getTodayInAppTz('yyyyMMdd')}.csv`);
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

    const columns: ColumnDef<PracticalAssessment>[] = [
        { accessorKey: 'student_id', header: 'Student ID' },
        { accessorKey: 'observations', header: 'Observations (15)' },
        { accessorKey: 'model_test', header: 'Model Test (15)' },
        { accessorKey: 'record_attendance', header: 'Record/Att (10)' },
        { accessorKey: 'total', header: 'Total (40)' },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingItem(row.original); setOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => row.original.id && handleDelete(row.original.id)}>
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
            observations: 0,
            model_test: 0,
            record_attendance: 0
        });
        setOpen(true);
    }

    const handleSearch = async () => {
        if (!selectedSubject) {
            setStudentError('Please select a subject.')
            return
        }
        if (!selectedCourse) {
            setStudentError('Please select a course.')
            return
        }
        if (!selectedSemester) {
            setStudentError('Please select a semester.')
            return
        }

        const year = selectedYear || '2025-2026'

        setLoadingStudents(true)
        setStudentError(null)
        setHasSearched(true)
        setStudents([])
        setSelectedSection('ALL')

        const result = await fetchStudentData({
            academicYear: year,
            course: selectedCourse,
            semester: selectedSemester
        })

        if (result.success) {
            if (Array.isArray(result.data)) {
                setStudents(result.data)
            } else {
                setStudentError('Received invalid data format from server.')
                console.error('Expected array, got:', result.data)
            }
        } else {
            setStudentError(result.error)
        }
        setLoadingStudents(false)
    }

    const handleStudentToggle = (registrationNo: string) => {
        if (editMode) {
            // Don't allow selection changes while in edit mode
            return
        }
        const newSelected = new Set(selectedStudents)
        if (newSelected.has(registrationNo)) {
            newSelected.delete(registrationNo)
        } else {
            newSelected.add(registrationNo)
        }
        setSelectedStudents(newSelected)
    }

    const handleSelectAll = () => {
        if (editMode) {
            // Don't allow selection changes while in edit mode
            return
        }
        const filteredStudents = students.filter(
            student => selectedSection === 'ALL' || (student.section || 'Unknown') === selectedSection
        )
        if (selectedStudents.size === filteredStudents.length) {
            setSelectedStudents(new Set())
        } else {
            setSelectedStudents(new Set(filteredStudents.map(s => s.registrationno)))
        }
    }

    const handleOpenBulkAssessmentDialog = () => {
        if (!selectedSubject) {
            alert('Please select a subject first')
            return
        }
        if (selectedStudents.size === 0) {
            alert('Please select at least one student')
            return
        }
        setBulkAssessmentDialogOpen(true)
        setBulkAssessmentForm({
            observations: undefined,
            model_test: undefined,
            record_attendance: undefined
        })
    }

    const fetchStudentMarks = async () => {
        if (!selectedSubject || students.length === 0) {
            setStudentMarks(new Map())
            return
        }

        try {
            setLoadingMarks(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const subjObj = subjects.find(s => s.displayName === selectedSubject)
            const subjectName = subjObj ? subjObj.name : selectedSubject

            const registrationNos = students.map(s => s.registrationno).filter(Boolean)
            if (registrationNos.length === 0) return

            const { data: marks, error } = await supabase
                .from('assessment_practical')
                .select('*')
                .eq('staff_id', user.id)
                .eq('subject', subjectName)
                .in('student_id', registrationNos)

            if (error) {
                console.error('Error fetching marks:', error)
                return
            }

            const marksMap = new Map<string, PracticalAssessment>()
            marks?.forEach((mark: any) => {
                if (mark.student_id) {
                    marksMap.set(mark.student_id, mark)
                }
            })
            setStudentMarks(marksMap)
        } catch (error) {
            console.error('Error fetching student marks:', error)
        } finally {
            setLoadingMarks(false)
        }
    }

    // Fetch marks when subject or students change
    useEffect(() => {
        if (selectedSubject && students.length > 0) {
            fetchStudentMarks()
        } else {
            setStudentMarks(new Map())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSubject, students])

    const handleInlineMarkChange = (registrationNo: string, field: 'observations' | 'model_test' | 'record_attendance', value: string) => {
        const numValue = value === '' ? undefined : parseFloat(value)
        const clampedValue = numValue !== undefined ? Math.max(0, Math.min(numValue, field === 'record_attendance' ? 10 : 15)) : undefined
        
        const newEditingMarks = new Map(editingMarks)
        const currentMarks = newEditingMarks.get(registrationNo) || {}
        newEditingMarks.set(registrationNo, {
            ...currentMarks,
            [field]: clampedValue
        })
        setEditingMarks(newEditingMarks)
    }

    const handleSaveInlineMarks = async () => {
        if (!selectedSubject) {
            alert('Please select a subject first')
            return
        }
        if (editingMarks.size === 0) {
            alert('No marks to save')
            return
        }

        setSavingInline(true)
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            
            if (userError || !user) {
                alert('Authentication error. Please log in again.')
                setSavingInline(false)
                return
            }

            const subjObj = subjects.find(s => s.displayName === selectedSubject)
            const subjectName = subjObj ? subjObj.name : selectedSubject

            // Note: 'total' is a GENERATED ALWAYS column, so we don't include it in inserts/updates
            const assessments = Array.from(editingMarks.entries()).map(([regNo, marks]) => {
                return {
                    staff_id: user.id,
                    subject: subjectName,
                    student_id: regNo,
                    observations: marks.observations !== undefined ? marks.observations : null,
                    model_test: marks.model_test !== undefined ? marks.model_test : null,
                    record_attendance: marks.record_attendance !== undefined ? marks.record_attendance : null
                }
            })

            // Check if assessments already exist
            const registrationNos = Array.from(editingMarks.keys())
            const { data: existing } = await supabase
                .from('assessment_practical')
                .select('id, student_id')
                .eq('staff_id', user.id)
                .eq('subject', subjectName)
                .in('student_id', registrationNos)

            const existingMap = new Map(existing?.map(e => [e.student_id, e.id]) || [])

            const toInsert = assessments.filter(a => !existingMap.has(a.student_id))
            const toUpdate = assessments.filter(a => existingMap.has(a.student_id))

            if (toInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('assessment_practical')
                    .insert(toInsert)
                if (insertError) throw insertError
            }

            if (toUpdate.length > 0) {
                for (const assessment of toUpdate) {
                    const id = existingMap.get(assessment.student_id)
                    if (id) {
                        // Note: 'total' is a GENERATED ALWAYS column, so we don't include it in updates
                        const { error: updateError } = await supabase
                            .from('assessment_practical')
                            .update({
                                observations: assessment.observations,
                                model_test: assessment.model_test,
                                record_attendance: assessment.record_attendance
                            })
                            .eq('id', id)
                        if (updateError) throw updateError
                    }
                }
            }

            alert(`Successfully saved marks for ${assessments.length} student(s)`)
            setEditMode(false)
            setEditingMarks(new Map())
            setSelectedStudents(new Set())
            // Refresh marks after saving
            await fetchStudentMarks()
        } catch (error: any) {
            console.error('Error saving inline marks:', error)
            alert('Error saving marks: ' + (error.message || 'Unknown error'))
        } finally {
            setSavingInline(false)
        }
    }

    const handleCancelEdit = () => {
        setEditMode(false)
        setEditingMarks(new Map())
    }

    const handleEnterEditMode = () => {
        if (!selectedSubject) {
            alert('Please select a subject first')
            return
        }
        if (selectedStudents.size === 0) {
            alert('Please select at least one student to edit marks')
            return
        }
        setEditMode(true)
        // Initialize editing marks with existing marks or empty
        const initialMarks = new Map<string, { observations?: number, model_test?: number, record_attendance?: number }>()
        selectedStudents.forEach(regNo => {
            const existingMarks = studentMarks.get(regNo)
            if (existingMarks) {
                initialMarks.set(regNo, {
                    observations: existingMarks.observations,
                    model_test: existingMarks.model_test,
                    record_attendance: existingMarks.record_attendance
                })
            }
        })
        setEditingMarks(initialMarks)
    }

    const handleSaveBulkAssessment = async () => {
        if (!selectedSubject) {
            alert('Please select a subject')
            return
        }
        if (selectedStudents.size === 0) {
            alert('Please select at least one student')
            return
        }

        setSavingBulk(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setSavingBulk(false)
            return
        }

        try {
            const subjObj = subjects.find(s => s.displayName === selectedSubject)
            const subjectName = subjObj ? subjObj.name : selectedSubject

            // Note: 'total' is a GENERATED ALWAYS column, so we don't include it in inserts/updates
            const assessments = Array.from(selectedStudents).map(regNo => ({
                staff_id: user.id,
                subject: subjectName,
                student_id: regNo,
                observations: bulkAssessmentForm.observations || null,
                model_test: bulkAssessmentForm.model_test || null,
                record_attendance: bulkAssessmentForm.record_attendance || null
            }))

            // Check if assessments already exist for these students and subject
            const { data: existing } = await supabase
                .from('assessment_practical')
                .select('id, student_id')
                .eq('staff_id', user.id)
                .eq('subject', subjectName)
                .in('student_id', Array.from(selectedStudents))

            const existingMap = new Map(existing?.map(e => [e.student_id, e.id]) || [])

            const toInsert = assessments.filter(a => !existingMap.has(a.student_id))
            const toUpdate = assessments.filter(a => existingMap.has(a.student_id))

            if (toInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('assessment_practical')
                    .insert(toInsert)
                if (insertError) throw insertError
            }

            if (toUpdate.length > 0) {
                for (const assessment of toUpdate) {
                    const id = existingMap.get(assessment.student_id)
                    if (id) {
                        // Note: 'total' is a GENERATED ALWAYS column, so we don't include it in updates
                        const { error: updateError } = await supabase
                            .from('assessment_practical')
                            .update({
                                observations: assessment.observations || null,
                                model_test: assessment.model_test || null,
                                record_attendance: assessment.record_attendance || null
                            })
                            .eq('id', id)
                        if (updateError) throw updateError
                    }
                }
            }

            alert(`Successfully saved assessments for ${assessments.length} student(s)`)
            setBulkAssessmentDialogOpen(false)
            setSelectedStudents(new Set())
            reloadData()
        } catch (error: any) {
            console.error('Error saving assessments:', error)
            alert('Error saving assessments: ' + (error.message || 'Unknown error'))
        } finally {
            setSavingBulk(false)
        }
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Assessment Practical</h1>
                <p className="text-gray-500">Manage student assessments and practical marks.</p>
            </div>

            {/* Filter Students - same behaviour as Theory: Subject first, then Course/Semester/Mode auto-filled */}
            <Card className="border-t-4 border-t-indigo-500 shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="w-5 h-5 text-indigo-500" />
                        Filter Students
                    </CardTitle>
                    <CardDescription>Select subject, course, semester, and mode to fetch student list.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {filterError && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Failed to load filters: {filterError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Subject</label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={loadingSubjects || subjects.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingSubjects ? "Loading..." : subjects.length === 0 ? "No subjects" : "Select Subject"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map((subject) => (
                                        <SelectItem key={subject.displayName} value={subject.displayName}>
                                            {subject.displayName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Course</label>
                            <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={loadingFilters}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Course" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filterOptions?.courses?.map((course: any, idx: number) => (
                                        <SelectItem key={idx} value={course.CourseName ?? course}>
                                            {course.CourseName ?? course}
                                        </SelectItem>
                                    ))}
                                    {!filterOptions?.courses?.length && <SelectItem value="BE">BE (Fallback)</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Semester</label>
                            <Select value={selectedSemester} onValueChange={setSelectedSemester} disabled={loadingFilters}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Sem" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                                        <SelectItem key={sem} value={sem.toString()}>
                                            Sem {sem}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Mode</label>
                            <Select value={selectedMode} onValueChange={setSelectedMode} disabled={loadingFilters}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filterOptions?.modes?.map((mode: any, idx: number) => (
                                        <SelectItem key={idx} value={mode.ModeName ?? mode}>
                                            {mode.ModeName ?? mode}
                                        </SelectItem>
                                    ))}
                                    {!filterOptions?.modes?.length && <SelectItem value="Regular">Regular (Fallback)</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleSearch}
                            disabled={loadingStudents || loadingFilters || !selectedSubject || !selectedCourse || !selectedSemester}
                            className="bg-indigo-600 hover:bg-indigo-700 w-full md:w-auto"
                        >
                            {loadingStudents ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Fetching Data...
                                </>
                            ) : (
                                'Get Student Details'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Student List Card */}
            {hasSearched && (
                <Card className="shadow-md">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    Student List
                                    {editMode && (
                                        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-md">
                                            Edit Mode
                                        </span>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Found {students.length} students for {selectedCourse} - Sem {selectedSemester} ({selectedYear})
                                    {selectedStudents.size > 0 && ` • ${selectedStudents.size} selected`}
                                    {editMode && ' • Enter marks in the table below'}
                                </CardDescription>
                            </div>

                            <div className="flex gap-2">
                                {/* Client-side Section Filter */}
                                {students.length > 0 && (
                                    <div className="w-[200px]">
                                        <Select
                                            value={selectedSection}
                                            onValueChange={setSelectedSection}
                                            disabled={editMode}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Filter by Section" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">All Sections</SelectItem>
                                                {Array.from(new Set(students.map(s => s.section || 'Unknown')))
                                                    .sort()
                                                    .map((sec: any) => (
                                                        <SelectItem key={sec} value={sec}>
                                                            Section {sec}
                                                        </SelectItem>
                                                    ))
                                                }
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Select All Button */}
                                {students.length > 0 && !editMode && (
                                    <Button
                                        variant="outline"
                                        onClick={handleSelectAll}
                                        size="sm"
                                    >
                                        {selectedStudents.size === students.filter(
                                            s => selectedSection === 'ALL' || (s.section || 'Unknown') === selectedSection
                                        ).length ? 'Deselect All' : 'Select All'}
                                    </Button>
                                )}

                                {/* Edit Marks Button */}
                                {selectedStudents.size > 0 && selectedSubject && !editMode && (
                                    <Button
                                        onClick={handleEnterEditMode}
                                        className="bg-blue-600 hover:bg-blue-700"
                                        size="sm"
                                    >
                                        <Edit2 className="mr-2 h-4 w-4" />
                                        Edit Marks ({selectedStudents.size})
                                    </Button>
                                )}

                                {/* Save Inline Marks Button */}
                                {editMode && (
                                    <>
                                        <Button
                                            onClick={handleCancelEdit}
                                            variant="outline"
                                            size="sm"
                                        >
                                            <X className="mr-2 h-4 w-4" />
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleSaveInlineMarks}
                                            className="bg-green-600 hover:bg-green-700"
                                            size="sm"
                                            disabled={savingInline}
                                        >
                                            {savingInline ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Save Marks ({editingMarks.size})
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}

                                {/* Save Assessment Button (Dialog) */}
                                {selectedStudents.size > 0 && selectedSubject && !editMode && (
                                    <Button
                                        onClick={handleOpenBulkAssessmentDialog}
                                        className="bg-green-600 hover:bg-green-700"
                                        size="sm"
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Assessment ({selectedStudents.size})
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {studentError ? (
                            <div className="p-4 text-center text-red-600 bg-red-50 rounded-lg border border-red-100">
                                <p className="font-semibold">Error loading data</p>
                                <p className="text-sm mt-1">{studentError}</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                No students found matching the selected criteria.
                            </div>
                        ) : (
                            <div className="border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-gray-50">
                                        <TableRow>
                                            <TableHead className="w-[50px]">
                                                <Checkbox
                                                    checked={selectedStudents.size === students.filter(
                                                        s => selectedSection === 'ALL' || (s.section || 'Unknown') === selectedSection
                                                    ).length && students.filter(
                                                        s => selectedSection === 'ALL' || (s.section || 'Unknown') === selectedSection
                                                    ).length > 0}
                                                    onCheckedChange={handleSelectAll}
                                                    disabled={editMode}
                                                />
                                            </TableHead>
                                            <TableHead className="w-[100px]">Reg No</TableHead>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Section</TableHead>
                                            <TableHead className="text-center">Observations<br />(15)</TableHead>
                                            <TableHead className="text-center">Model Test<br />(15)</TableHead>
                                            <TableHead className="text-center">Record &<br />Attendance (10)</TableHead>
                                            <TableHead className="text-center font-semibold">Total<br />(40)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {students
                                            .filter(student => selectedSection === 'ALL' || (student.section || 'Unknown') === selectedSection)
                                            .map((student: any, index: number) => {
                                                const marks = studentMarks.get(student.registrationno)
                                                return (
                                                    <TableRow
                                                        key={student.registrationno || index}
                                                        className={
                                                            editMode && selectedStudents.has(student.registrationno) 
                                                                ? 'bg-blue-100 border-2 border-blue-300' 
                                                                : selectedStudents.has(student.registrationno) 
                                                                    ? 'bg-blue-50' 
                                                                    : ''
                                                        }
                                                    >
                                                        <TableCell>
                                                            <Checkbox
                                                                checked={selectedStudents.has(student.registrationno)}
                                                                onCheckedChange={() => handleStudentToggle(student.registrationno)}
                                                                disabled={editMode}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium">{student.registrationno}</TableCell>
                                                        <TableCell>{student.name}</TableCell>
                                                        <TableCell>{student.section || '-'}</TableCell>
                                                        <TableCell className="text-center">
                                                            {loadingMarks ? (
                                                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                            ) : editMode && selectedStudents.has(student.registrationno) ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max="15"
                                                                    step="0.01"
                                                                    className="w-20 mx-auto text-center h-8"
                                                                    value={editingMarks.get(student.registrationno)?.observations ?? ''}
                                                                    onChange={(e) => handleInlineMarkChange(student.registrationno, 'observations', e.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            ) : marks?.observations !== null && marks?.observations !== undefined 
                                                                ? marks.observations.toFixed(2) 
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {loadingMarks ? (
                                                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                            ) : editMode && selectedStudents.has(student.registrationno) ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max="15"
                                                                    step="0.01"
                                                                    className="w-20 mx-auto text-center h-8"
                                                                    value={editingMarks.get(student.registrationno)?.model_test ?? ''}
                                                                    onChange={(e) => handleInlineMarkChange(student.registrationno, 'model_test', e.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            ) : marks?.model_test !== null && marks?.model_test !== undefined 
                                                                ? marks.model_test.toFixed(2) 
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {loadingMarks ? (
                                                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                            ) : editMode && selectedStudents.has(student.registrationno) ? (
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max="10"
                                                                    step="0.01"
                                                                    className="w-20 mx-auto text-center h-8"
                                                                    value={editingMarks.get(student.registrationno)?.record_attendance ?? ''}
                                                                    onChange={(e) => handleInlineMarkChange(student.registrationno, 'record_attendance', e.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            ) : marks?.record_attendance !== null && marks?.record_attendance !== undefined 
                                                                ? marks.record_attendance.toFixed(2) 
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center font-semibold">
                                                            {loadingMarks ? (
                                                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                            ) : editMode && selectedStudents.has(student.registrationno) ? (
                                                                (() => {
                                                                    const editMarks = editingMarks.get(student.registrationno)
                                                                    const total = (editMarks?.observations || 0) + (editMarks?.model_test || 0) + (editMarks?.record_attendance || 0)
                                                                    return total > 0 ? total.toFixed(2) : '-'
                                                                })()
                                                            ) : marks?.total !== null && marks?.total !== undefined 
                                                                ? marks.total.toFixed(2) 
                                                                : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Bulk Assessment Dialog */}
            <Dialog open={bulkAssessmentDialogOpen} onOpenChange={setBulkAssessmentDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Enter Assessment Marks</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input value={selectedSubject} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Number of Students</Label>
                            <Input value={selectedStudents.size} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Observations (15)</Label>
                            <Input
                                type="number"
                                placeholder="Enter marks"
                                value={bulkAssessmentForm.observations || ''}
                                onChange={(e) => setBulkAssessmentForm({
                                    ...bulkAssessmentForm,
                                    observations: e.target.value ? parseFloat(e.target.value) : undefined
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Model Test (15)</Label>
                            <Input
                                type="number"
                                placeholder="Enter marks"
                                value={bulkAssessmentForm.model_test || ''}
                                onChange={(e) => setBulkAssessmentForm({
                                    ...bulkAssessmentForm,
                                    model_test: e.target.value ? parseFloat(e.target.value) : undefined
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Record/Attendance (10)</Label>
                            <Input
                                type="number"
                                placeholder="Enter marks"
                                value={bulkAssessmentForm.record_attendance || ''}
                                onChange={(e) => setBulkAssessmentForm({
                                    ...bulkAssessmentForm,
                                    record_attendance: e.target.value ? parseFloat(e.target.value) : undefined
                                })}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setBulkAssessmentDialogOpen(false)}
                                disabled={savingBulk}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveBulkAssessment}
                                disabled={savingBulk}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {savingBulk ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save for {selectedStudents.size} Student(s)
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
