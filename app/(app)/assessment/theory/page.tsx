'use client'

import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, Loader2, Search, Save, CheckSquare, Edit2, X, Upload, Download, Plus, Trash2 } from 'lucide-react'
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_SEMESTER_TYPE } from '@/lib/academic-years'
import { fetchFilterOptions, fetchStudentData } from '@/app/actions/assessment'
import { useInspectionLock } from '@/hooks/use-inspection-lock'
import { LogbookLockBanner } from '@/components/LogbookLockBanner'

type StudentSource = 'api' | 'import'

const SECTION_OPTIONS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'A', 'B', 'C', 'D']

type ImportedStudent = {
    registrationno: string
    name: string
    section?: string
}

type ImportedStudentWithMarks = ImportedStudent & {
    internal_1?: number | null
    internal_2?: number | null
    assignment_attendance?: number | null
}

function normalizeHeader(value: string) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
}

function parseMarkValue(raw: unknown, max: number): number | null | undefined {
    if (raw === null || raw === undefined) return undefined
    const text = String(raw).trim()
    if (!text) return undefined
    if (/^(a|ab|absent)$/i.test(text)) return 0
    const num = Number(text)
    if (Number.isNaN(num)) return undefined
    return Math.max(0, Math.min(num, max))
}

function pickRowValue(row: Record<string, unknown>, aliases: string[]) {
    const entries = Object.entries(row)
    for (const alias of aliases) {
        const found = entries.find(([key]) => normalizeHeader(key) === alias)
        if (found) return found[1]
    }
    return undefined
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

type TheoryAssessment = {
    id?: string
    subject: string
    student_id: string
    internal_1?: number
    internal_2?: number
    assignment_attendance?: number
    total?: number
}

export default function AssessmentTheoryPage() {
    const supabase = createClient()
    const studentFileInputRef = useRef<HTMLInputElement>(null)

    // Filter State
    const [filterOptions, setFilterOptions] = useState<any>(null)
    const [loadingFilters, setLoadingFilters] = useState(true)
    const [filterError, setFilterError] = useState<string | null>(null)

    // Selection State (year/semester default 2025-2026 and even 2,4,6,8; course from filters)
    const [selectedYear, setSelectedYear] = useState(DEFAULT_ACADEMIC_YEAR)
    const [selectedCourse, setSelectedCourse] = useState('')
    const [selectedSemester, setSelectedSemester] = useState('2')
    const [selectedMode, setSelectedMode] = useState('')
    const [selectedSection, setSelectedSection] = useState('ALL')
    const [studentSource, setStudentSource] = useState<StudentSource>('api')
    const [rosterLoaded, setRosterLoaded] = useState(false)
    const [loadingRoster, setLoadingRoster] = useState(false)

    // Data State
    const [students, setStudents] = useState<any[]>([])
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [importingStudents, setImportingStudents] = useState(false)
    const [studentError, setStudentError] = useState<string | null>(null)
    const [hasSearched, setHasSearched] = useState(false)
    const [studentMarks, setStudentMarks] = useState<Map<string, TheoryAssessment>>(new Map())
    const [loadingMarks, setLoadingMarks] = useState(false)

    // Subject Selection State
    const [subjects, setSubjects] = useState<SubjectItem[]>([])
    const [selectedSubject, setSelectedSubject] = useState<string>("")
    const [loadingSubjects, setLoadingSubjects] = useState(false)
    const [academicYear, setAcademicYear] = useState<string>(DEFAULT_ACADEMIC_YEAR)
    const [semesterType, setSemesterType] = useState<string>(DEFAULT_SEMESTER_TYPE)
    const { isLocked, lockStatus, blockIfLocked, lockMessage } = useInspectionLock(academicYear, semesterType)
    const [userProfile, setUserProfile] = useState<{ emp_id: string; department_no: string } | null>(null)
    const [authError, setAuthError] = useState<string | null>(null)

    // Student Selection State
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
    const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false)
    const [assessmentForm, setAssessmentForm] = useState<TheoryAssessment>({
        subject: '',
        student_id: '',
        internal_1: undefined,
        internal_2: undefined,
        assignment_attendance: undefined
    })
    const [saving, setSaving] = useState(false)

    // Inline Edit State
    const [editMode, setEditMode] = useState(false)
    const [editingMarks, setEditingMarks] = useState<Map<string, { internal_1?: number, internal_2?: number, assignment_attendance?: number }>>(new Map())
    const [savingInline, setSavingInline] = useState(false)

    // Add Student Dialog
    const [addStudentOpen, setAddStudentOpen] = useState(false)
    const [newStudent, setNewStudent] = useState({ registrationno: '', name: '', section: '' })

    // Initial Load - Fetch Filter Options and User Profile
    useEffect(() => {
        async function loadFilters() {
            setLoadingFilters(true)
            const result = await fetchFilterOptions()
            if (result.success) {
                const data = result.data as any
                setFilterOptions(data)
                // Default course to first available for Get Student Details (2025-2026, even sem)
                const courses = data?.courses
                if (Array.isArray(courses) && courses.length > 0) {
                    const firstCourse = courses[0]
                    setSelectedCourse(firstCourse.CourseName ?? firstCourse ?? '')
                } else {
                    setSelectedCourse('BE')
                }
            } else {
                setFilterError(result.error)
            }
            setLoadingFilters(false)
        }

        async function loadUserProfile() {
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser()
                
                if (userError) {
                    console.error('Auth error:', userError)
                    setAuthError(`Authentication error: ${userError.message}`)
                    return
                }
                
                if (!user) {
                    setAuthError('No user found. Please log in.')
                    return
                }

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('emp_id, department_no')
                    .eq('id', user.id)
                    .single()

                if (profileError) {
                    console.error('Profile error:', profileError)
                    setAuthError(`Profile error: ${profileError.message}`)
                    return
                }

                if (profile?.emp_id && profile?.department_no) {
                    setUserProfile({ emp_id: profile.emp_id, department_no: profile.department_no })
                    await fetchSubjects(profile.emp_id, profile.department_no, academicYear, semesterType)
                } else {
                    setAuthError('Profile incomplete. Missing emp_id or department_no.')
                }
            } catch (error: any) {
                console.error('Error loading user profile:', error)
                setAuthError(`Failed to load user profile: ${error.message || 'Unknown error'}`)
            }
        }

        loadFilters()
        loadUserProfile()
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

        if (userProfile) {
            refetchSubjects()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [academicYear, semesterType])

    // Resolve course ID to display value for dropdown (match workload behaviour)
    const resolveCourseDisplay = (courseRaw: string | undefined): string => {
        if (!courseRaw) return ''
        if (!filterOptions?.courses?.length) return courseRaw
        const c = filterOptions.courses.find((x: any) =>
            x.CourseID === courseRaw || x.CourseNo === courseRaw || x.CourseName === courseRaw ||
            String(x.CourseID) === String(courseRaw) || String(x.CourseNo) === String(courseRaw))
        return (c?.CourseName ?? c?.CourseNo ?? c?.CourseID) ?? courseRaw
    }

    // When subject is selected, auto-fill Course, Semester, and Mode from workload data (like Workload page)
    useEffect(() => {
        if (!selectedSubject || !subjects.length) return
        const subject = subjects.find((s) => s.displayName === selectedSubject)
        if (!subject) return
        setSelectedCourse(resolveCourseDisplay(subject.courseRaw))
        if (subject.semester != null && subject.semester !== '') setSelectedSemester(subject.semester)
        if (subject.mode != null && subject.mode !== '') setSelectedMode(subject.mode)
    }, [selectedSubject, subjects, filterOptions])

    const fetchSubjects = async (empId: string, deptId: string, filterYear?: string, filterSemester?: string) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                console.error('Session error:', sessionError)
                setAuthError(`Session error: ${sessionError.message}`)
                return
            }
            
            const token = session?.access_token;

            if (!token) {
                setAuthError('No access token available. Please log in again.')
                return
            }

            const res = await fetch(`/api/faculty-workload?EmpId=${empId}&Dept=${deptId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            
            if (!res.ok) {
                throw new Error(`API request failed: ${res.status} ${res.statusText}`)
            }
            
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

    const fetchStudentMarks = async () => {
        if (!selectedSubject || students.length === 0) {
            setStudentMarks(new Map())
            return
        }

        try {
            setLoadingMarks(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const registrationNos = students.map(s => s.registrationno).filter(Boolean)
            if (registrationNos.length === 0) return

            const { data: marks, error } = await supabase
                .from('assessment_theory')
                .select('*')
                .eq('staff_id', user.id)
                .eq('subject', selectedSubject)
                .in('student_id', registrationNos)

            if (error) {
                console.error('Error fetching marks:', error)
                return
            }

            const marksMap = new Map<string, TheoryAssessment>()
            marks?.forEach((mark: any) => {
                // Use student_id to match with registrationno
                if (mark.student_id) {
                    marksMap.set(mark.student_id, mark)
                }
            })
            console.log('Fetched marks:', marksMap.size, 'marks for', registrationNos.length, 'students')
            console.log('Sample marks:', Array.from(marksMap.entries()).slice(0, 3))
            setStudentMarks(marksMap)
        } catch (error) {
            console.error('Error fetching student marks:', error)
        } finally {
            setLoadingMarks(false)
        }
    }

    const resetStudentListState = () => {
        setStudents([])
        setSelectedStudents(new Set())
        setSelectedSection('ALL')
        setStudentMarks(new Map())
        setEditMode(false)
        setEditingMarks(new Map())
        setRosterLoaded(false)
    }

    const mapRosterRows = (rows: Array<{ registrationno: string; student_name: string; section?: string | null }>): ImportedStudent[] =>
        rows.map((row) => ({
            registrationno: row.registrationno,
            name: row.student_name,
            section: row.section || undefined,
        }))

    const loadSavedRoster = async (subject: string) => {
        if (!subject) return false

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return false

        setLoadingRoster(true)
        setStudentError(null)

        const { data, error } = await supabase
            .from('assessment_theory_roster')
            .select('registrationno, student_name, section')
            .eq('staff_id', user.id)
            .eq('subject', subject)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType)
            .order('registrationno', { ascending: true })

        if (error) {
            console.error('Failed to load saved roster', error)
            setLoadingRoster(false)
            return false
        }

        if (data && data.length > 0) {
            setStudentSource('import')
            setStudents(mapRosterRows(data))
            setHasSearched(true)
            setRosterLoaded(true)
            setSelectedStudents(new Set())
            setSelectedSection('ALL')
            setLoadingRoster(false)
            return true
        }

        setLoadingRoster(false)
        return false
    }

    const saveRoster = async (studentList: ImportedStudent[]) => {
        if (!selectedSubject) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase
            .from('assessment_theory_roster')
            .delete()
            .eq('staff_id', user.id)
            .eq('subject', selectedSubject)
            .eq('academic_year', academicYear)
            .eq('semester_type', semesterType)

        if (studentList.length === 0) {
            setRosterLoaded(false)
            return
        }

        const rows = studentList.map((student) => ({
            staff_id: user.id,
            subject: selectedSubject,
            academic_year: academicYear,
            semester_type: semesterType,
            registrationno: student.registrationno,
            student_name: student.name,
            section: student.section || null,
        }))

        const { error } = await supabase.from('assessment_theory_roster').insert(rows)
        if (error) {
            console.error('Failed to save roster', error)
            alert('Could not save student list: ' + error.message)
            return
        }

        setRosterLoaded(true)
    }

    const handleSubjectChange = (subject: string) => {
        setSelectedSubject(subject)
        setStudentError(null)
        resetStudentListState()
        setHasSearched(false)
    }

    const hasStudentList = hasSearched && students.length > 0
    const showImportSetup = studentSource === 'import' && !hasStudentList && !loadingRoster

    useEffect(() => {
        if (!selectedSubject) return
        void loadSavedRoster(selectedSubject)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [academicYear, semesterType, selectedSubject])

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

        const year = selectedYear || DEFAULT_ACADEMIC_YEAR

        setLoadingStudents(true)
        setStudentError(null)
        setHasSearched(true)
        resetStudentListState()

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

    const downloadStudentSample = () => {
        // Matches SAMPLE DATA.xlsx column layout used by faculty mark sheets
        const csvContent = [
            'Register. No.,Name of the Candidate,Section,FIRST INTERNAL TEST(15),SECOND INTERNAL TEST(15),ATTENDANCE ASSIGNMENT(10),Final(40.00)',
            '11249A002,ACHARI GANESH,S1,7,12,,19',
            '11249A006,AGNIHOTRAM PURNIMA SAI SRI VYSHNAVI,S1,A,13,,13',
            '11249A011,AKKANA VENKATA MADHUSUDHAN,S2,A,A,,0',
        ].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', 'theory_assessment_sample.csv')
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleStudentImportClick = () => {
        if (!selectedSubject) {
            alert('Please select a subject before importing students.')
            return
        }
        studentFileInputRef.current?.click()
    }

    const mapImportedRows = (rows: Record<string, unknown>[]): ImportedStudentWithMarks[] => {
        const imported = rows
            .map((row) => {
                const registrationno = String(
                    pickRowValue(row, [
                        'registerno',
                        'registrationno',
                        'registernumber',
                        'regno',
                        'studentid',
                        'student_id',
                    ]) ?? ''
                ).trim()
                const name = String(
                    pickRowValue(row, [
                        'nameofthecandidate',
                        'name',
                        'studentname',
                        'candidate',
                    ]) ?? ''
                ).trim()
                const section = String(pickRowValue(row, ['section', 'sec']) ?? '').trim()

                if (!registrationno || !name) return null

                return {
                    registrationno,
                    name,
                    section: section || undefined,
                    internal_1: parseMarkValue(
                        pickRowValue(row, [
                            'firstinternaltest15',
                            'firstinternaltest',
                            'firstinternal',
                            'internal1',
                            'internal_1',
                        ]),
                        15
                    ),
                    internal_2: parseMarkValue(
                        pickRowValue(row, [
                            'secondinternaltest15',
                            'secondinternaltest',
                            'secondinternal',
                            'internal2',
                            'internal_2',
                        ]),
                        15
                    ),
                    assignment_attendance: parseMarkValue(
                        pickRowValue(row, [
                            'attendanceassignment10',
                            'attendanceassignment',
                            'assignmentattendance',
                            'attendance',
                        ]),
                        10
                    ),
                } as ImportedStudentWithMarks
            })
            .filter(Boolean) as ImportedStudentWithMarks[]

        const unique = new Map<string, ImportedStudentWithMarks>()
        imported.forEach((student) => {
            if (!unique.has(student.registrationno)) {
                unique.set(student.registrationno, student)
            }
        })
        return Array.from(unique.values())
    }

    const saveImportedMarks = async (studentList: ImportedStudentWithMarks[]) => {
        if (!selectedSubject) return

        const withMarks = studentList.filter(
            (s) =>
                s.internal_1 !== undefined ||
                s.internal_2 !== undefined ||
                s.assignment_attendance !== undefined
        )
        if (withMarks.length === 0) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const assessments = withMarks.map((student) => ({
            staff_id: user.id,
            subject: selectedSubject,
            student_id: student.registrationno,
            internal_1: student.internal_1 !== undefined ? student.internal_1 : null,
            internal_2: student.internal_2 !== undefined ? student.internal_2 : null,
            assignment_attendance:
                student.assignment_attendance !== undefined ? student.assignment_attendance : null,
        }))

        const registrationNos = assessments.map((a) => a.student_id)
        const { data: existing } = await supabase
            .from('assessment_theory')
            .select('id, student_id')
            .eq('staff_id', user.id)
            .eq('subject', selectedSubject)
            .in('student_id', registrationNos)

        const existingMap = new Map(existing?.map((e) => [e.student_id, e.id]) || [])
        const toInsert = assessments.filter((a) => !existingMap.has(a.student_id))
        const toUpdate = assessments.filter((a) => existingMap.has(a.student_id))

        if (toInsert.length > 0) {
            const { error } = await supabase.from('assessment_theory').insert(toInsert)
            if (error) throw error
        }

        for (const assessment of toUpdate) {
            const id = existingMap.get(assessment.student_id)
            if (!id) continue
            const { error } = await supabase
                .from('assessment_theory')
                .update({
                    internal_1: assessment.internal_1,
                    internal_2: assessment.internal_2,
                    assignment_attendance: assessment.assignment_attendance,
                })
                .eq('id', id)
            if (error) throw error
        }
    }

    const applyImportedStudents = async (rows: Record<string, unknown>[]) => {
        const headers = rows.length > 0 ? Object.keys(rows[0]).map(normalizeHeader) : []
        const hasRegister = headers.some((h) =>
            ['registerno', 'registrationno', 'registernumber', 'regno', 'studentid'].includes(h)
        )
        const hasName = headers.some((h) =>
            ['nameofthecandidate', 'name', 'studentname', 'candidate'].includes(h)
        )

        if (!hasRegister || !hasName) {
            alert(
                'Invalid file format.\n\nExpected columns like SAMPLE DATA.xlsx:\n' +
                    'Register. No., Name of the Candidate, FIRST INTERNAL TEST(15), SECOND INTERNAL TEST(15), ATTENDANCE ASSIGNMENT(10), Final(40.00)\n\n' +
                    'Download the sample CSV and use that format.'
            )
            return
        }

        const uniqueStudents = mapImportedRows(rows)
        if (uniqueStudents.length === 0) {
            alert('No valid student rows found. Each row needs Register No and Name.')
            return
        }

        const defaultSection =
            selectedSection && selectedSection !== 'ALL' ? selectedSection : undefined
        const rosterOnly: ImportedStudent[] = uniqueStudents.map(
            ({ registrationno, name, section }) => ({
                registrationno,
                name,
                section: section || defaultSection,
            })
        )
        // Keep mark rows aligned with roster section defaults
        uniqueStudents.forEach((student) => {
            if (!student.section && defaultSection) student.section = defaultSection
        })

        const marksCount = uniqueStudents.filter(
            (s) =>
                s.internal_1 !== undefined ||
                s.internal_2 !== undefined ||
                s.assignment_attendance !== undefined
        ).length

        // Persist first, then update UI so marks refresh finds saved rows
        await saveRoster(rosterOnly)

        try {
            await saveImportedMarks(uniqueStudents)
            resetStudentListState()
            setHasSearched(true)
            setStudents(rosterOnly)
            setRosterLoaded(true)
            alert(
                marksCount > 0
                    ? `Imported ${uniqueStudents.length} student(s) and saved marks for ${marksCount}.`
                    : `Imported ${uniqueStudents.length} student(s).`
            )
        } catch (error: any) {
            console.error('Failed to save imported marks', error)
            resetStudentListState()
            setHasSearched(true)
            setStudents(rosterOnly)
            setRosterLoaded(true)
            alert(
                `Imported ${uniqueStudents.length} student(s), but marks could not be saved: ` +
                    (error.message || 'Unknown error')
            )
        }
    }

    const handleStudentFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (!selectedSubject) {
            alert('Please select a subject before importing students.')
            if (studentFileInputRef.current) studentFileInputRef.current.value = ''
            return
        }

        setImportingStudents(true)
        setStudentError(null)

        try {
            const lowerName = file.name.toLowerCase()
            if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
                const buffer = await file.arrayBuffer()
                const workbook = XLSX.read(buffer, { type: 'array' })
                const sheetName = workbook.SheetNames[0]
                const sheet = workbook.Sheets[sheetName]
                const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                    defval: '',
                    raw: false,
                })
                await applyImportedStudents(rows)
            } else {
                await new Promise<void>((resolve, reject) => {
                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: true,
                        complete: async (results) => {
                            try {
                                await applyImportedStudents(results.data as Record<string, unknown>[])
                                resolve()
                            } catch (err) {
                                reject(err)
                            }
                        },
                        error: (error) => reject(error),
                    })
                })
            }
        } catch (error: any) {
            alert('Error parsing file: ' + (error.message || 'Unknown error'))
        } finally {
            setImportingStudents(false)
            if (studentFileInputRef.current) studentFileInputRef.current.value = ''
        }
    }

    // Fetch marks when subject or students change
    useEffect(() => {
        if (selectedSubject && students.length > 0) {
            console.log('Fetching marks for subject:', selectedSubject, 'students:', students.length)
            fetchStudentMarks()
        } else {
            setStudentMarks(new Map())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSubject, students])

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

    const openAddStudentDialog = () => {
        if (!selectedSubject) {
            alert('Please select a subject first.')
            return
        }
        setNewStudent({
            registrationno: '',
            name: '',
            section: selectedSection !== 'ALL' ? selectedSection : '',
        })
        setAddStudentOpen(true)
    }

    const handleAddStudent = () => {
        const registrationno = newStudent.registrationno.trim()
        const name = newStudent.name.trim()
        const section = newStudent.section.trim()

        if (!registrationno || !name) {
            alert('Register number and student name are required.')
            return
        }

        if (students.some((s) => String(s.registrationno).toLowerCase() === registrationno.toLowerCase())) {
            alert('A student with this register number is already in the list.')
            return
        }

        setHasSearched(true)
        const nextStudents = [
            ...students,
            {
                registrationno,
                name,
                section: section || undefined,
            },
        ]
        setStudents(nextStudents)
        setAddStudentOpen(false)
        setNewStudent({ registrationno: '', name: '', section: '' })
        void saveRoster(nextStudents)
    }

    const handleDeleteSelectedStudents = () => {
        if (editMode) return
        if (selectedStudents.size === 0) {
            alert('Please select at least one student to delete.')
            return
        }
        if (!confirm(`Remove ${selectedStudents.size} selected student(s) from this list?`)) {
            return
        }

        setStudents((prev) => prev.filter((s) => !selectedStudents.has(s.registrationno)))
        setStudentMarks((prev) => {
            const next = new Map(prev)
            selectedStudents.forEach((regNo) => next.delete(regNo))
            return next
        })
        const nextStudents = students.filter((s) => !selectedStudents.has(s.registrationno))
        setSelectedStudents(new Set())
        void saveRoster(nextStudents)
    }

    const handleDeleteStudent = (registrationNo: string) => {
        if (editMode || isLocked) return
        if (!confirm(`Remove student ${registrationNo} from this list?`)) return

        const nextStudents = students.filter((s) => s.registrationno !== registrationNo)
        setStudents(nextStudents)
        setSelectedStudents((prev) => {
            const next = new Set(prev)
            next.delete(registrationNo)
            return next
        })
        setStudentMarks((prev) => {
            const next = new Map(prev)
            next.delete(registrationNo)
            return next
        })
        void saveRoster(nextStudents)
    }

    const handleOpenAssessmentDialog = () => {
        if (blockIfLocked()) return
        if (!selectedSubject) {
            alert('Please select a subject first')
            return
        }
        if (selectedStudents.size === 0) {
            alert('Please select at least one student')
            return
        }
        setAssessmentDialogOpen(true)
        setAssessmentForm({
            subject: selectedSubject,
            student_id: '',
            internal_1: undefined,
            internal_2: undefined,
            assignment_attendance: undefined
        })
    }

    const handleInlineMarkChange = (registrationNo: string, field: 'internal_1' | 'internal_2' | 'assignment_attendance', value: string) => {
        if (isLocked) return
        const numValue = value === '' ? undefined : parseFloat(value)
        const clampedValue = numValue !== undefined ? Math.max(0, Math.min(numValue, field === 'assignment_attendance' ? 10 : 15)) : undefined
        
        const newEditingMarks = new Map(editingMarks)
        const currentMarks = newEditingMarks.get(registrationNo) || {}
        newEditingMarks.set(registrationNo, {
            ...currentMarks,
            [field]: clampedValue
        })
        setEditingMarks(newEditingMarks)
    }

    const handleSaveInlineMarks = async () => {
        if (blockIfLocked()) return
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

            const assessments = Array.from(editingMarks.entries()).map(([regNo, marks]) => {
                // Note: 'total' is a GENERATED ALWAYS column, so we don't include it in inserts/updates
                return {
                    staff_id: user.id,
                    subject: selectedSubject,
                    student_id: regNo,
                    internal_1: marks.internal_1 !== undefined ? marks.internal_1 : null,
                    internal_2: marks.internal_2 !== undefined ? marks.internal_2 : null,
                    assignment_attendance: marks.assignment_attendance !== undefined ? marks.assignment_attendance : null
                }
            })

            // Check if assessments already exist
            const registrationNos = Array.from(editingMarks.keys())
            const { data: existing } = await supabase
                .from('assessment_theory')
                .select('id, student_id')
                .eq('staff_id', user.id)
                .eq('subject', selectedSubject)
                .in('student_id', registrationNos)

            const existingMap = new Map(existing?.map(e => [e.student_id, e.id]) || [])

            const toInsert = assessments.filter(a => !existingMap.has(a.student_id))
            const toUpdate = assessments.filter(a => existingMap.has(a.student_id))

            if (toInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('assessment_theory')
                    .insert(toInsert)
                if (insertError) throw insertError
            }

            if (toUpdate.length > 0) {
                for (const assessment of toUpdate) {
                    const id = existingMap.get(assessment.student_id)
                    if (id) {
                        // Note: 'total' is a GENERATED ALWAYS column, so we don't include it in updates
                        const { error: updateError } = await supabase
                            .from('assessment_theory')
                            .update({
                                internal_1: assessment.internal_1,
                                internal_2: assessment.internal_2,
                                assignment_attendance: assessment.assignment_attendance
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
        if (blockIfLocked()) return
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
        const initialMarks = new Map<string, { internal_1?: number, internal_2?: number, assignment_attendance?: number }>()
        selectedStudents.forEach(regNo => {
            const existingMarks = studentMarks.get(regNo)
            if (existingMarks) {
                initialMarks.set(regNo, {
                    internal_1: existingMarks.internal_1,
                    internal_2: existingMarks.internal_2,
                    assignment_attendance: existingMarks.assignment_attendance
                })
            }
        })
        setEditingMarks(initialMarks)
    }

    const handleSaveAssessment = async () => {
        if (blockIfLocked()) return
        if (!selectedSubject) {
            alert('Please select a subject')
            return
        }
        if (selectedStudents.size === 0) {
            alert('Please select at least one student')
            return
        }

        setSaving(true)
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            
            if (userError) {
                console.error('Auth error in save:', userError)
                alert(`Authentication error: ${userError.message}. Please try logging in again.`)
                setSaving(false)
                return
            }
            
            if (!user) {
                alert('No user found. Please log in again.')
                setSaving(false)
                return
            }
            // Note: 'total' is a GENERATED ALWAYS column, so we don't include it in inserts/updates
            const assessments = Array.from(selectedStudents).map(regNo => ({
                staff_id: user.id,
                subject: selectedSubject,
                student_id: regNo,
                internal_1: assessmentForm.internal_1 || null,
                internal_2: assessmentForm.internal_2 || null,
                assignment_attendance: assessmentForm.assignment_attendance || null
            }))

            // Check if assessments already exist for these students and subject
            const { data: existing } = await supabase
                .from('assessment_theory')
                .select('id, student_id')
                .eq('staff_id', user.id)
                .eq('subject', selectedSubject)
                .in('student_id', Array.from(selectedStudents))

            const existingMap = new Map(existing?.map(e => [e.student_id, e.id]) || [])

            const toInsert = assessments.filter(a => !existingMap.has(a.student_id))
            const toUpdate = assessments.filter(a => existingMap.has(a.student_id))

            if (toInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('assessment_theory')
                    .insert(toInsert)
                if (insertError) throw insertError
            }

            if (toUpdate.length > 0) {
                for (const assessment of toUpdate) {
                    const id = existingMap.get(assessment.student_id)
                    if (id) {
                        // Note: 'total' is a GENERATED ALWAYS column, so we don't include it in updates
                        const { error: updateError } = await supabase
                            .from('assessment_theory')
                            .update({
                                internal_1: assessment.internal_1 || null,
                                internal_2: assessment.internal_2 || null,
                                assignment_attendance: assessment.assignment_attendance || null
                            })
                            .eq('id', id)
                        if (updateError) throw updateError
                    }
                }
            }

            alert(`Successfully saved assessments for ${assessments.length} student(s)`)
            setAssessmentDialogOpen(false)
            setSelectedStudents(new Set())
            // Refresh marks after saving
            await fetchStudentMarks()
        } catch (error: any) {
            console.error('Error saving assessments:', error)
            alert('Error saving assessments: ' + (error.message || 'Unknown error'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Assessment Theory</h1>
                <p className="text-gray-500">Manage student assessments and theory marks.</p>
            </div>

            <LogbookLockBanner
                isLocked={isLocked}
                lockStatus={lockStatus}
                academicYear={academicYear}
                semesterType={semesterType}
                lockMessage={lockMessage}
            />

            {/* Authentication Error Display */}
            {authError && (
                <Card className="border-t-4 border-t-red-500 shadow-md">
                    <CardContent className="pt-6">
                        <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            <div>
                                <p className="font-semibold">Authentication Error</p>
                                <p>{authError}</p>
                                <p className="mt-2 text-xs">Please try refreshing the page or logging in again.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Subject / student setup — import UI only shown until a roster exists */}
            {hasStudentList && studentSource === 'import' ? (
                <Card className="border-t-4 border-t-indigo-500 shadow-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-w-[240px] max-w-2xl">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Subject</label>
                                    <Select
                                        value={selectedSubject}
                                        onValueChange={handleSubjectChange}
                                        disabled={loadingSubjects || subjects.length === 0}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={loadingSubjects ? 'Loading...' : 'Select Subject'} />
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
                                    <label className="text-sm font-medium">Section</label>
                                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Sections" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">All Sections</SelectItem>
                                            {SECTION_OPTIONS.map((sec) => (
                                                <SelectItem key={sec} value={sec}>
                                                    {sec}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500">
                                {students.length} student(s) saved for this subject
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
            <Card className="border-t-4 border-t-indigo-500 shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="w-5 h-5 text-indigo-500" />
                        Filter Students
                    </CardTitle>
                    <CardDescription>
                        {showImportSetup
                            ? 'Select subject and section, then import SAMPLE DATA Excel/CSV once. Marks and section are saved automatically.'
                            : 'Choose how to load students: university list (current) or import SAMPLE DATA Excel/CSV with internals, attendance, and section.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loadingRoster && (
                        <div className="p-3 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading saved student list...
                        </div>
                    )}

                    {filterError && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Failed to load filters: {filterError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {!hasStudentList && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Student Source</label>
                                <Select
                                    value={studentSource}
                                    onValueChange={async (value) => {
                                        const source = value as StudentSource
                                        setStudentSource(source)
                                        setStudentError(null)
                                        if (source === 'api') {
                                            setHasSearched(false)
                                            resetStudentListState()
                                        } else if (selectedSubject) {
                                            const loaded = await loadSavedRoster(selectedSubject)
                                            if (!loaded) {
                                                setHasSearched(false)
                                                resetStudentListState()
                                            }
                                        } else {
                                            setHasSearched(false)
                                            resetStudentListState()
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="api">University list (current)</SelectItem>
                                        <SelectItem value="import">Import Excel/CSV (SAMPLE DATA marks)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Subject</label>
                            <Select value={selectedSubject} onValueChange={handleSubjectChange} disabled={loadingSubjects || subjects.length === 0}>
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
                            <label className="text-sm font-medium">Section</label>
                            <Select value={selectedSection} onValueChange={setSelectedSection}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Sections</SelectItem>
                                    {SECTION_OPTIONS.map((sec) => (
                                        <SelectItem key={sec} value={sec}>
                                            {sec}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {studentSource === 'api' && (
                            <>
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
                            </>
                        )}
                    </div>

                    {studentSource === 'api' ? (
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
                    ) : showImportSetup ? (
                        <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={downloadStudentSample}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Sample File
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={openAddStudentDialog}
                                disabled={!selectedSubject || isLocked}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Student
                            </Button>
                            <Button
                                type="button"
                                onClick={handleStudentImportClick}
                                disabled={importingStudents || !selectedSubject}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {importingStudents ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import Excel / CSV
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
            )}

            <input
                ref={studentFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleStudentFileUpload}
            />

            {/* Results Table */}
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
                                    {studentSource === 'import'
                                        ? `${students.length} student(s) for ${selectedSubject || 'selected subject'}`
                                        : `Found ${students.length} students for ${selectedCourse} - Sem ${selectedSemester} (${selectedYear})`}
                                    {selectedStudents.size > 0 && ` • ${selectedStudents.size} selected`}
                                    {editMode && ' • Enter marks in the table below'}
                                </CardDescription>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {studentSource === 'import' && rosterLoaded && !editMode && !isLocked && (
                                    <Button
                                        variant="outline"
                                        onClick={handleStudentImportClick}
                                        size="sm"
                                        disabled={importingStudents}
                                    >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Re-import Excel / CSV
                                    </Button>
                                )}

                                {/* Client-side Section Filter */}
                                {students.length > 0 && (
                                    <div className="w-[200px]">
                                        <Select
                                            value={selectedSection}
                                            onValueChange={setSelectedSection}
                                            disabled={editMode || isLocked}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Filter by Section" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">All Sections</SelectItem>
                                                {Array.from(
                                                    new Set([
                                                        ...SECTION_OPTIONS,
                                                        ...students.map((s) => s.section || '').filter(Boolean),
                                                    ])
                                                ).map((sec) => (
                                                    <SelectItem key={sec} value={sec}>
                                                        Section {sec}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Add Student */}
                                {!editMode && !isLocked && selectedSubject && (
                                    <Button
                                        variant="outline"
                                        onClick={openAddStudentDialog}
                                        size="sm"
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add
                                    </Button>
                                )}

                                {/* Delete Selected */}
                                {selectedStudents.size > 0 && !editMode && !isLocked && (
                                    <Button
                                        variant="outline"
                                        onClick={handleDeleteSelectedStudents}
                                        size="sm"
                                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete ({selectedStudents.size})
                                    </Button>
                                )}

                                {/* Select All Button */}
                                {students.length > 0 && !editMode && !isLocked && (
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
                                {selectedStudents.size > 0 && selectedSubject && !editMode && !isLocked && (
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
                                {selectedStudents.size > 0 && selectedSubject && !editMode && !isLocked && (
                                    <Button
                                        onClick={handleOpenAssessmentDialog}
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
                            <div className="text-center py-10 text-gray-500 space-y-3">
                                <p>No students in the list yet.</p>
                                {!isLocked && selectedSubject && (
                                    <Button variant="outline" onClick={openAddStudentDialog}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Student
                                    </Button>
                                )}
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
                                                    disabled={editMode || isLocked}
                                                />
                                            </TableHead>
                                            <TableHead className="w-[100px]">Reg No</TableHead>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Section</TableHead>
                                            <TableHead className="text-center">Internal Test 1<br />(15)</TableHead>
                                            <TableHead className="text-center">Internal Test 2<br />(15)</TableHead>
                                            <TableHead className="text-center">Assignment &<br />Attendance (10)</TableHead>
                                            <TableHead className="text-center font-semibold">Total<br />(40)</TableHead>
                                            <TableHead className="w-[70px] text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {students
                                            .filter(student => selectedSection === 'ALL' || (student.section || 'Unknown') === selectedSection)
                                            .map((student: any, index: number) => {
                                                const marks = studentMarks.get(student.registrationno)
                                                // Debug: log first few students to check marks lookup
                                                if (index < 3 && selectedSubject) {
                                                    console.log(`Student ${student.registrationno}:`, marks ? 'Has marks' : 'No marks', marks)
                                                }
                                                // Create unique key using registration number and index to avoid duplicates
                                                const uniqueKey = `${student.registrationno || 'unknown'}-${index}`
                                                return (
                                                    <TableRow 
                                                        key={uniqueKey}
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
                                                                disabled={editMode || isLocked}
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
                                                                    value={editingMarks.get(student.registrationno)?.internal_1 ?? ''}
                                                                    onChange={(e) => handleInlineMarkChange(student.registrationno, 'internal_1', e.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            ) : marks?.internal_1 !== null && marks?.internal_1 !== undefined 
                                                                ? marks.internal_1.toFixed(2) 
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
                                                                    value={editingMarks.get(student.registrationno)?.internal_2 ?? ''}
                                                                    onChange={(e) => handleInlineMarkChange(student.registrationno, 'internal_2', e.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            ) : marks?.internal_2 !== null && marks?.internal_2 !== undefined 
                                                                ? marks.internal_2.toFixed(2) 
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
                                                                    value={editingMarks.get(student.registrationno)?.assignment_attendance ?? ''}
                                                                    onChange={(e) => handleInlineMarkChange(student.registrationno, 'assignment_attendance', e.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            ) : marks?.assignment_attendance !== null && marks?.assignment_attendance !== undefined 
                                                                ? marks.assignment_attendance.toFixed(2) 
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center font-semibold">
                                                            {loadingMarks ? (
                                                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                            ) : editMode && selectedStudents.has(student.registrationno) ? (
                                                                (() => {
                                                                    const editMarks = editingMarks.get(student.registrationno)
                                                                    const total = (editMarks?.internal_1 || 0) + (editMarks?.internal_2 || 0) + (editMarks?.assignment_attendance || 0)
                                                                    return total > 0 ? total.toFixed(2) : '-'
                                                                })()
                                                            ) : marks?.total !== null && marks?.total !== undefined 
                                                                ? marks.total.toFixed(2) 
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                disabled={editMode || isLocked}
                                                                onClick={() => handleDeleteStudent(student.registrationno)}
                                                                title="Remove student"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
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

            {/* Add Student Dialog */}
            <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Add Student</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-reg-no">Register Number</Label>
                            <Input
                                id="new-reg-no"
                                placeholder="e.g. 11199A001"
                                value={newStudent.registrationno}
                                onChange={(e) => setNewStudent({ ...newStudent, registrationno: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-student-name">Student Name</Label>
                            <Input
                                id="new-student-name"
                                placeholder="Student full name"
                                value={newStudent.name}
                                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-section">Section</Label>
                            <Select
                                value={newStudent.section || 'NONE'}
                                onValueChange={(v) =>
                                    setNewStudent({ ...newStudent, section: v === 'NONE' ? '' : v })
                                }
                            >
                                <SelectTrigger id="new-section">
                                    <SelectValue placeholder="Select section" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">—</SelectItem>
                                    {SECTION_OPTIONS.map((sec) => (
                                        <SelectItem key={sec} value={sec}>
                                            {sec}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setAddStudentOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleAddStudent} className="bg-indigo-600 hover:bg-indigo-700">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Student
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Assessment Dialog */}
            <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
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
                            <Label>Internal Test 1 (15 marks)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="15"
                                step="0.01"
                                placeholder="Enter marks (max 15)"
                                value={assessmentForm.internal_1 || ''}
                                onChange={(e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                                    const clampedValue = value !== undefined ? Math.min(Math.max(0, value), 15) : undefined;
                                    setAssessmentForm({
                                        ...assessmentForm,
                                        internal_1: clampedValue
                                    });
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Internal Test 2 (15 marks)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="15"
                                step="0.01"
                                placeholder="Enter marks (max 15)"
                                value={assessmentForm.internal_2 || ''}
                                onChange={(e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                                    const clampedValue = value !== undefined ? Math.min(Math.max(0, value), 15) : undefined;
                                    setAssessmentForm({
                                        ...assessmentForm,
                                        internal_2: clampedValue
                                    });
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Assignment & Attendance (10 marks)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.01"
                                placeholder="Enter marks (max 10)"
                                value={assessmentForm.assignment_attendance || ''}
                                onChange={(e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                                    const clampedValue = value !== undefined ? Math.min(Math.max(0, value), 10) : undefined;
                                    setAssessmentForm({
                                        ...assessmentForm,
                                        assignment_attendance: clampedValue
                                    });
                                }}
                            />
                        </div>
                        <div className="space-y-2 pt-2 border-t">
                            <Label className="text-base font-semibold">Total Marks (out of 40)</Label>
                            <Input
                                type="number"
                                value={(
                                    (assessmentForm.internal_1 || 0) +
                                    (assessmentForm.internal_2 || 0) +
                                    (assessmentForm.assignment_attendance || 0)
                                ).toFixed(2)}
                                disabled
                                className="bg-gray-100 font-semibold text-lg"
                            />
                            <p className="text-sm text-gray-500">
                                Total = Internal Test 1 + Internal Test 2 + Assignment & Attendance
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setAssessmentDialogOpen(false)}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveAssessment}
                                disabled={saving}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {saving ? (
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
