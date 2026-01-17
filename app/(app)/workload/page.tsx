
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Pencil, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { fetchFilterOptions } from '@/app/actions/assessment'
// import { useToast } from '@/hooks/use-toast'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface FacultyWorkloadData {
    Course: string;
    CourseName?: string; // May be included in API response
    Dept: string;
    DepartmentName?: string; // May be included in API response
    Mode: string;
    SubjectCode: string;
    Subject_Name: string;
    Semester: string | number;
    NoofStudents: number;
    Theory: number;
    Lab: number;
    Academicyear: string;
    NoofPeriods: number;
}

export default function WorkloadPage() {
    // Schedule State
    const [workload, setWorkload] = useState<any[]>([])
    const [loadingSchedule, setLoadingSchedule] = useState(true)
    const [editingDay, setEditingDay] = useState<any>(null)
    const [open, setOpen] = useState(false)

    // Faculty Subj Workload State
    const [facultyWorkload, setFacultyWorkload] = useState<FacultyWorkloadData[]>([])
    const [loadingWorkload, setLoadingWorkload] = useState(false)

    // Search Params
    // Search Params
    const [empId, setEmpId] = useState('')
    const [deptId, setDeptId] = useState('')

    // Filters
    const [academicYear, setAcademicYear] = useState<string>("2024-2025")
    const [semesterType, setSemesterType] = useState<string>("Odd")

    // Course and Department Mapping
    const [filterOptions, setFilterOptions] = useState<any>(null)
    const [departmentName, setDepartmentName] = useState<string>('')

    const supabase = createClient()

    // Helper function to get course name from ID
    const getCourseName = (item: FacultyWorkloadData): string => {
        // If API already provides CourseName, use it
        if (item.CourseName) return item.CourseName
        
        const courseId = item.Course
        if (!filterOptions?.courses || !courseId) return courseId
        
        // Try different matching strategies
        const course = filterOptions.courses.find((c: any) => {
            // Match by CourseID, CourseNo, or CourseName
            return c.CourseID === courseId || 
                   c.CourseNo === courseId || 
                   c.CourseName === courseId ||
                   String(c.CourseID) === String(courseId) ||
                   String(c.CourseNo) === String(courseId)
        })
        
        // If found, return the CourseName
        if (course?.CourseName) return course.CourseName
        
        // Fallback: Common course mappings (can be expanded)
        const courseMap: { [key: string]: string } = {
            '1': 'BE',
            '2': 'ME',
            '3': 'M.Tech',
            '4': 'MBA',
            '5': 'BE [CSE]',
            '6': 'BE [ECE]',
            '7': 'BE [EEE]',
            '8': 'BE [MECH]',
            '9': 'BE [CIVIL]',
        }
        
        return courseMap[courseId] || courseId
    }

    // Helper function to get department name
    const getDepartmentName = (item: FacultyWorkloadData): string => {
        // If API already provides DepartmentName, use it
        if (item.DepartmentName) return item.DepartmentName
        
        const deptId = item.Dept
        
        // If this is the current user's department, use the stored name
        if (deptId === deptId && departmentName) {
            return departmentName
        }
        
        // Try to get from filterOptions if available
        if (filterOptions?.departments) {
            const dept = filterOptions.departments.find((d: any) => 
                d.DeptID === deptId || 
                d.DeptNo === deptId || 
                d.DepartmentNo === deptId ||
                String(d.DeptID) === String(deptId) ||
                String(d.DeptNo) === String(deptId)
            )
            if (dept?.DepartmentName || dept?.DeptName) {
                return dept.DepartmentName || dept.DeptName
            }
        }
        
        // Fallback: Common department mappings
        const deptMap: { [key: string]: string } = {
            '1': 'CSE',
            '2': 'ECE',
            '3': 'EEE',
            '4': 'MECH',
            '5': 'CIVIL',
            '6': 'IT',
            '7': 'AUTO',
        }
        
        return deptMap[deptId] || deptId
    }

    useEffect(() => {
        initializePage()
    }, [])

    const initializePage = async () => {
        setLoadingSchedule(true)
        setLoadingWorkload(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setLoadingSchedule(false)
            setLoadingWorkload(false)
            return
        }

        // Fetch Profile for EmpId/Dept
        const { data: profile } = await supabase
            .from('profiles')
            .select('emp_id, department_no, department_name')
            .eq('id', user.id)
            .single()

        if (profile) {
            setEmpId(profile.emp_id)
            setDeptId(profile.department_no)
            if (profile.department_name) {
                setDepartmentName(profile.department_name)
            }

            // Fetch workload with these values
            fetchFacultyWorkload(profile.emp_id, profile.department_no)
        } else {
            console.error("Profile not found for user")
            setLoadingWorkload(false)
        }

        // Fetch filter options for course/department mapping
        const filterResult = await fetchFilterOptions()
        if (filterResult.success) {
            setFilterOptions(filterResult.data)
        }

        await reloadSchedule(user.id)
    }

    const reloadSchedule = async (userId?: string) => {
        setLoadingSchedule(true)
        // If userId not passed, get it
        let uid = userId
        if (!uid) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoadingSchedule(false)
                return
            }
            uid = user.id
        }

        const { data } = await supabase
            .from('workload')
            .select('*')
            .eq('staff_id', uid)

        if (data) {
            const merged = DAYS.map(day => {
                const existing = data.find((d: any) => d.day_of_week === day)
                return existing || { day_of_week: day, period_1: '', period_2: '', period_3: '', period_4: '', period_5: '', period_6: '', period_7: '', period_8: '' }
            })
            setWorkload(merged)
        }
        setLoadingSchedule(false)
    }

    const fetchFacultyWorkload = async (specificEmpId?: string, specificDeptId?: string) => {
        // Ensure arguments are strings (handle case where event might still be passed incorrectly or to be safe)
        const eId = (typeof specificEmpId === 'string' ? specificEmpId : empId);
        const dId = (typeof specificDeptId === 'string' ? specificDeptId : deptId);

        if (!eId || !dId) {
            setLoadingWorkload(false)
            return;
        }

        setLoadingWorkload(true)
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch(`/api/faculty-workload?EmpId=${eId}&Dept=${dId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            const data = await res.json()
            if (data.data) {
                setFacultyWorkload(data.data)
            } else {
                setFacultyWorkload([])
            }
        } catch (error) {
            console.error("Failed to fetch faculty workload", error)
        } finally {
            setLoadingWorkload(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        let operation
        if (editingDay.id) {
            operation = supabase.from('workload').update(editingDay).eq('id', editingDay.id)
        } else {
            // Check if exists first (race condition possible but unlikely for single user)
            const { data: existing } = await supabase.from('workload').select('id').eq('staff_id', user.id).eq('day_of_week', editingDay.day_of_week).single()
            if (existing) {
                operation = supabase.from('workload').update(editingDay).eq('id', existing.id)
            } else {
                operation = supabase.from('workload').insert({ ...editingDay, staff_id: user.id })
            }
        }

        const { error: opError } = await operation

        if (!opError) {
            setOpen(false)
            reloadSchedule()
        } else {
            alert('Error saving workload')
        }
    }

    if (loadingSchedule && !workload.length) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    // Filter Logic
    const filteredWorkload = facultyWorkload.filter(item => {
        // Filter by Academic Year if selected
        if (academicYear && item.Academicyear !== academicYear) return false;

        // Filter by Semester Type
        const sem = Number(item.Semester);
        if (semesterType === "Odd" && sem % 2 === 0) return false;
        if (semesterType === "Even" && sem % 2 !== 0) return false;

        return true;
    });

    // Calculate totals for footer based on filtered data
    const totalStudents = filteredWorkload.reduce((acc, curr) => acc + (curr.NoofStudents || 0), 0)
    const totalTheory = filteredWorkload.reduce((acc, curr) => acc + (curr.Theory || 0), 0)
    const totalLab = filteredWorkload.reduce((acc, curr) => acc + (curr.Lab || 0), 0)
    const totalPeriods = filteredWorkload.reduce((acc, curr) => acc + (curr.NoofPeriods || 0), 0)

    // Get unique academic years for dropdown
    const availableYears = Array.from(new Set(facultyWorkload.map(item => item.Academicyear))).filter(Boolean).sort().reverse();
    // Ensure default is available or use what's there if not in list (though we default to 2024-2025)
    // If availableYears lacks the default, maybe switch? But user starts with 2024-2025.

    return (
        <div className="space-y-8 p-4">

            {/* Faculty Workload Section */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold tracking-tight">Faculty Subject Workload</h2>
                    <div className="flex flex-wrap items-end gap-4 bg-muted/30 p-2 rounded-lg">

                        {/* Filters */}
                        <div className="grid gap-2">
                            <Label>Academic Year</Label>
                            <Select value={academicYear} onValueChange={setAcademicYear}>
                                <SelectTrigger className="w-[140px] h-8 bg-background">
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                                    {availableYears.filter(y => y !== "2024-2025" && y !== "2025-2026").map(y => (
                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

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

                        {/* Search Inputs */}
                        <div className="flex items-center gap-2 pl-4 border-l">
                            <div className="grid gap-2">
                                <Label htmlFor="empId">EmpID</Label>
                                <Input
                                    id="empId"
                                    value={empId}
                                    disabled
                                    readOnly
                                    className="w-[100px] h-8"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="deptId">Dept</Label>
                                <Input
                                    id="deptId"
                                    value={deptId}
                                    disabled
                                    readOnly
                                    className="w-[60px] h-8"
                                />
                            </div>
                            <Button size="sm" onClick={() => fetchFacultyWorkload()} disabled={loadingWorkload} className="h-8 mb-0.5">
                                {loadingWorkload ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                <span className="ml-2">Load</span>
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[50px]">Sl.No</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Dept</TableHead>
                                <TableHead>Mode</TableHead>
                                <TableHead>SubjectCode</TableHead>
                                <TableHead>Subject Name</TableHead>
                                <TableHead className="text-center">Semester</TableHead>
                                <TableHead className="text-center">NoofStudents</TableHead>
                                <TableHead className="text-center">Theory</TableHead>
                                <TableHead className="text-center">Lab</TableHead>
                                <TableHead className="text-center">NoofPeriods</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingWorkload ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredWorkload.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                                        {facultyWorkload.length > 0 ? "No subjects match the selected filters." : "No workload data found."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredWorkload.map((item, index) => (
                                    <TableRow key={`${item.SubjectCode}-${index}`}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{getCourseName(item)}</TableCell>
                                        <TableCell>{getDepartmentName(item)}</TableCell>
                                        <TableCell>{item.Mode}</TableCell>
                                        <TableCell>{item.SubjectCode}</TableCell>
                                        <TableCell>{item.Subject_Name}</TableCell>
                                        <TableCell className="text-center">{item.Semester}</TableCell>
                                        <TableCell className="text-center">{item.NoofStudents}</TableCell>
                                        <TableCell className="text-center">{item.Theory}</TableCell>
                                        <TableCell className="text-center">{item.Lab}</TableCell>
                                        <TableCell className="text-center">{item.NoofPeriods}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {/* Footer for Totals */}
                        {!loadingWorkload && filteredWorkload.length > 0 && (
                            <TableHeader className="bg-primary/5 font-bold">
                                <TableRow>
                                    <TableCell colSpan={7} className="text-right font-bold">Total</TableCell>
                                    <TableCell className="text-center font-bold">{totalStudents}</TableCell>
                                    <TableCell className="text-center font-bold">{totalTheory}</TableCell>
                                    <TableCell className="text-center font-bold">{totalLab}</TableCell>
                                    <TableCell className="text-center font-bold">{totalPeriods}</TableCell>
                                </TableRow>
                            </TableHeader>
                        )}
                    </Table>
                </div>
            </div>

            {/* Existing Weekly Schedule Section */}
            <div className="space-y-4 pt-8 border-t">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Weekly Schedule</h1>
                </div>

                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Day</TableHead>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                                    <TableHead key={p}>Period {p}</TableHead>
                                ))}
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workload.map((day) => (
                                <TableRow key={day.day_of_week}>
                                    <TableCell className="font-medium">{day.day_of_week}</TableCell>
                                    <TableCell>{day.period_1}</TableCell>
                                    <TableCell>{day.period_2}</TableCell>
                                    <TableCell>{day.period_3}</TableCell>
                                    <TableCell>{day.period_4}</TableCell>
                                    <TableCell>{day.period_5}</TableCell>
                                    <TableCell>{day.period_6}</TableCell>
                                    <TableCell>{day.period_7}</TableCell>
                                    <TableCell>{day.period_8}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingDay(day); setOpen(true); }}>
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Edit Workload - {editingDay?.day_of_week}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSave} className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                                    <div key={p} className="grid gap-2">
                                        <Label htmlFor={`period_${p}`}>Period {p}</Label>
                                        <Input
                                            id={`period_${p}`}
                                            value={editingDay?.[`period_${p}`] || ''}
                                            onChange={(e) => setEditingDay({ ...editingDay, [`period_${p}`]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit">Save Changes</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
