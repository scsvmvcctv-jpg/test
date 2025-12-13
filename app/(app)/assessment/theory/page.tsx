'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertCircle, Loader2, Search } from 'lucide-react'
import { fetchFilterOptions, fetchStudentData } from '@/app/actions/assessment'

export default function AssessmentTheoryPage() {
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

    // Initial Load - Fetch Filter Options
    useEffect(() => {
        async function loadFilters() {
            setLoadingFilters(true)
            const result = await fetchFilterOptions()
            if (result.success) {
                setFilterOptions(result.data)
                // Auto-select defaults if available? For now, let user select.
            } else {
                setFilterError(result.error)
            }
            setLoadingFilters(false)
        }
        loadFilters()
    }, [])

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

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Assessment Theory</h1>
                <p className="text-gray-500">Manage student assessments and theory marks.</p>
            </div>

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
                                </CardDescription>
                            </div>

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
                                            <TableHead className="w-[100px]">Reg No</TableHead>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Section</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {students
                                            .filter(student => selectedSection === 'ALL' || (student.section || 'Unknown') === selectedSection)
                                            .map((student: any, index: number) => (
                                                <TableRow key={student.registrationno || index}>
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
        </div>
    )
}
