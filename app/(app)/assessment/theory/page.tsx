'use client'

import { useState, useEffect } from 'react'
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
import { AlertCircle, Loader2, Search, Save, CheckSquare } from 'lucide-react'
import { fetchFilterOptions, fetchStudentData } from '@/app/actions/assessment'

type SubjectItem = {
    code: string
    name: string
    displayName: string
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

    // Filter State
    const [filterOptions, setFilterOptions] = useState<any>(null)
    const [loadingFilters, setLoadingFilters] = useState(true)
    const [filterError, setFilterError] = useState<string | null>(null)

    // Selection State
    const [selectedYear, setSelectedYear] = useState('')
    const [selectedCourse, setSelectedCourse] = useState('')
    const [selectedSemester, setSelectedSemester] = useState('')
    const [selectedMode, setSelectedMode] = useState('')
    const [selectedSection, setSelectedSection] = useState('ALL')

    // Data State
    const [students, setStudents] = useState<any[]>([])
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [studentError, setStudentError] = useState<string | null>(null)
    const [hasSearched, setHasSearched] = useState(false)

    // Subject Selection State
    const [subjects, setSubjects] = useState<SubjectItem[]>([])
    const [selectedSubject, setSelectedSubject] = useState<string>("")
    const [loadingSubjects, setLoadingSubjects] = useState(false)
    const [academicYear, setAcademicYear] = useState<string>("2024-2025")
    const [semesterType, setSemesterType] = useState<string>("Odd")
    const [userProfile, setUserProfile] = useState<{ emp_id: string; department_no: string } | null>(null)

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

    // Initial Load - Fetch Filter Options and User Profile
    useEffect(() => {
        async function loadFilters() {
            setLoadingFilters(true)
            const result = await fetchFilterOptions()
            if (result.success) {
                setFilterOptions(result.data)
            } else {
                setFilterError(result.error)
            }
            setLoadingFilters(false)
        }

        async function loadUserProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('emp_id, department_no')
                .eq('id', user.id)
                .single()

            if (profile?.emp_id && profile?.department_no) {
                setUserProfile({ emp_id: profile.emp_id, department_no: profile.department_no })
                await fetchSubjects(profile.emp_id, profile.department_no, academicYear, semesterType)
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

    const handleSearch = async () => {
        if (!selectedYear || !selectedCourse || !selectedSemester) {
            setStudentError('Please select Academic Year, Course, and Semester.')
            return
        }

        setLoadingStudents(true)
        setStudentError(null)
        setHasSearched(true)
        setStudents([])
        setSelectedSection('ALL')

        const result = await fetchStudentData({
            academicYear: selectedYear,
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
        const newSelected = new Set(selectedStudents)
        if (newSelected.has(registrationNo)) {
            newSelected.delete(registrationNo)
        } else {
            newSelected.add(registrationNo)
        }
        setSelectedStudents(newSelected)
    }

    const handleSelectAll = () => {
        const filteredStudents = students.filter(
            student => selectedSection === 'ALL' || (student.section || 'Unknown') === selectedSection
        )
        if (selectedStudents.size === filteredStudents.length) {
            setSelectedStudents(new Set())
        } else {
            setSelectedStudents(new Set(filteredStudents.map(s => s.registrationno)))
        }
    }

    const handleOpenAssessmentDialog = () => {
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

    const handleSaveAssessment = async () => {
        if (!selectedSubject) {
            alert('Please select a subject')
            return
        }
        if (selectedStudents.size === 0) {
            alert('Please select at least one student')
            return
        }

        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setSaving(false)
            return
        }

        try {
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

            {/* Subject Selection Card */}
            <Card className="border-t-4 border-t-blue-500 shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CheckSquare className="w-5 h-5 text-blue-500" />
                        Select Subject
                    </CardTitle>
                    <CardDescription>Choose subject for theory assessment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Academic Year Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Academic Year</label>
                            <Select value={academicYear} onValueChange={setAcademicYear} disabled={loadingSubjects}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                                    <SelectItem value="2023-2024">2023-2024</SelectItem>
                                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Semester Type Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Semester Type</label>
                            <Select value={semesterType} onValueChange={setSemesterType} disabled={loadingSubjects}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Semester" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Odd">Odd (1, 3, 5, 7)</SelectItem>
                                    <SelectItem value="Even">Even (2, 4, 6, 8)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Subject Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Subject</label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={loadingSubjects || subjects.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingSubjects ? "Loading..." : subjects.length === 0 ? "No subjects available" : "Select Subject"} />
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
                    </div>
                </CardContent>
            </Card>

            {/* Filters Card */}
            <Card className="border-t-4 border-t-indigo-500 shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="w-5 h-5 text-indigo-500" />
                        Filter Students
                    </CardTitle>
                    <CardDescription>Select criteria to fetch student list.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {filterError && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Failed to load filters: {filterError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Academic Year */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Academic Year
                            </label>
                            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={loadingFilters}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filterOptions?.academicYears?.map((year: any, idx: number) => (
                                        <SelectItem key={idx} value={year.AcademicYear || year}>
                                            {year.AcademicYear || year}
                                        </SelectItem>
                                    ))}
                                    {/* Fallback if map fails or empty */}
                                    {!filterOptions?.academicYears && <SelectItem value="2024-2025">2024-2025 (Fallback)</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Course */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Course
                            </label>
                            <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={loadingFilters}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Course" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filterOptions?.courses?.map((course: any, idx: number) => (
                                        <SelectItem key={idx} value={course.CourseName || course}>
                                            {course.CourseName || course}
                                        </SelectItem>
                                    ))}
                                    {!filterOptions?.courses && <SelectItem value="BE [CSE]">BE [CSE] (Fallback)</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Semester */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Semester
                            </label>
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

                        {/* Mode */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Mode
                            </label>
                            <Select value={selectedMode} onValueChange={setSelectedMode} disabled={loadingFilters}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filterOptions?.modes?.map((mode: any, idx: number) => (
                                        <SelectItem key={idx} value={mode.ModeName || mode}>
                                            {mode.ModeName || mode}
                                        </SelectItem>
                                    ))}
                                    {!filterOptions?.modes && <SelectItem value="Regular">Regular (Fallback)</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleSearch}
                            disabled={loadingStudents || loadingFilters}
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

            {/* Results Table */}
            {hasSearched && (
                <Card className="shadow-md">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle>Student List</CardTitle>
                                <CardDescription>
                                    Found {students.length} students for {selectedCourse} - Sem {selectedSemester} ({selectedYear})
                                    {selectedStudents.size > 0 && ` • ${selectedStudents.size} selected`}
                                </CardDescription>
                            </div>

                            <div className="flex gap-2">
                                {/* Client-side Section Filter */}
                                {students.length > 0 && (
                                    <div className="w-[200px]">
                                        <Select
                                            value={selectedSection}
                                            onValueChange={setSelectedSection}
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
                                {students.length > 0 && (
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

                                {/* Save Assessment Button */}
                                {selectedStudents.size > 0 && selectedSubject && (
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
                                                />
                                            </TableHead>
                                            <TableHead className="w-[100px]">Reg No</TableHead>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Section</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {students
                                            .filter(student => selectedSection === 'ALL' || (student.section || 'Unknown') === selectedSection)
                                            .map((student: any, index: number) => (
                                                <TableRow 
                                                    key={student.registrationno || index}
                                                    className={selectedStudents.has(student.registrationno) ? 'bg-blue-50' : ''}
                                                >
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedStudents.has(student.registrationno)}
                                                            onCheckedChange={() => handleStudentToggle(student.registrationno)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{student.registrationno}</TableCell>
                                                    <TableCell>{student.name}</TableCell>
                                                    <TableCell>{student.section || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

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
                            <Label>Internal 1</Label>
                            <Input
                                type="number"
                                placeholder="Enter marks"
                                value={assessmentForm.internal_1 || ''}
                                onChange={(e) => setAssessmentForm({
                                    ...assessmentForm,
                                    internal_1: e.target.value ? parseFloat(e.target.value) : undefined
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Internal 2</Label>
                            <Input
                                type="number"
                                placeholder="Enter marks"
                                value={assessmentForm.internal_2 || ''}
                                onChange={(e) => setAssessmentForm({
                                    ...assessmentForm,
                                    internal_2: e.target.value ? parseFloat(e.target.value) : undefined
                                })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Assignment & Attendance</Label>
                            <Input
                                type="number"
                                placeholder="Enter marks"
                                value={assessmentForm.assignment_attendance || ''}
                                onChange={(e) => setAssessmentForm({
                                    ...assessmentForm,
                                    assignment_attendance: e.target.value ? parseFloat(e.target.value) : undefined
                                })}
                            />
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
