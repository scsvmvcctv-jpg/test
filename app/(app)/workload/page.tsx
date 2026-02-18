
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

type DeptOption = { id: string; name: string }
const FALLBACK_DEPARTMENTS: DeptOption[] = [
    { id: '1', name: 'CSE' }, { id: '2', name: 'ECE' }, { id: '3', name: 'EEE' },
    { id: '4', name: 'MECH' }, { id: '5', name: 'CIVIL' }, { id: '6', name: 'IT' }, { id: '7', name: 'AUTO' }
]

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
    Theory?: number;
    Lab?: number;
    Practical?: number;  // Alternate API field for lab/practical hours
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
    const [academicYear, setAcademicYear] = useState<string>("2025-2026")
    const [semesterType, setSemesterType] = useState<string>("Even")

    // Course and Department Mapping
    const [filterOptions, setFilterOptions] = useState<any>(null)
    const [departmentName, setDepartmentName] = useState<string>('')
    const [departments, setDepartments] = useState<DeptOption[]>([])

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

        // Fetch filter options first (for departments + course/dept mapping)
        const filterResult = await fetchFilterOptions()
        if (filterResult.success) {
            setFilterOptions(filterResult.data)
        }

        // Build department list for "other dept" workload (same as lecture-plan)
        let deptList: DeptOption[] = []
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
            await fetchFacultyWorkload(profile.emp_id, profile.department_no, deptList)
        } else {
            console.error("Profile not found for user")
            setLoadingWorkload(false)
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

    const fetchFacultyWorkload = async (specificEmpId?: string, specificDeptId?: string, deptsOverride?: DeptOption[]) => {
        const eId = (typeof specificEmpId === 'string' ? specificEmpId : empId)
        const dId = (typeof specificDeptId === 'string' ? specificDeptId : deptId)
        const deptList = deptsOverride && deptsOverride.length ? deptsOverride : departments

        if (!eId || !dId) {
            setLoadingWorkload(false)
            return
        }

        setLoadingWorkload(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            const getDeptName = (id: string) => deptList.find(d => String(d.id) === String(id))?.name ?? id

            const fetchForDept = async (dept: string): Promise<FacultyWorkloadData[]> => {
                const res = await fetch(`/api/faculty-workload?EmpId=${eId}&Dept=${dept}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                const result = await res.json()
                if (!res.ok || result?.error) return []
                const arr = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : [])
                return arr
            }

            const merged: FacultyWorkloadData[] = []
            const seen = new Set<string>()

            const addRow = (item: FacultyWorkloadData) => {
                // Include NoofStudents, Theory, Lab/Practical, NoofPeriods so same subject with different counts shows as separate rows
                const theory = item.Theory ?? 0
                const practical = item.Practical ?? item.Lab ?? 0
                const key = `${item.SubjectCode}|${item.Subject_Name}|${item.Dept}|${item.Course}|${item.Semester}|${item.Academicyear}|${item.NoofStudents ?? 0}|${theory}|${practical}|${item.NoofPeriods ?? 0}`
                if (seen.has(key)) return
                seen.add(key)
                merged.push(item)
            }

            // 1. Own department (API may also return other-dept rows in same call)
            const ownData = await fetchForDept(dId)
            ownData.forEach((item: any) => {
                let toAdd = item
                if (item.Dept != null && String(item.Dept) !== String(dId) && !item.DepartmentName && !item.DeptName) {
                    toAdd = { ...item, DepartmentName: getDeptName(String(item.Dept)) }
                }
                addRow(toAdd)
            })

            // 2. Other departments
            const otherIds = deptList.map(d => d.id).filter(id => String(id) !== String(dId))
            for (const otherId of otherIds) {
                const otherData = await fetchForDept(otherId)
                otherData.forEach((item: any) => {
                    let toAdd = item
                    if (!item.DepartmentName && !item.DeptName) {
                        toAdd = { ...item, DepartmentName: getDeptName(String(item.Dept || otherId)) }
                    }
                    addRow(toAdd)
                })
            }

            setFacultyWorkload(merged)
        } catch (error) {
            console.error("Failed to fetch faculty workload", error)
            setFacultyWorkload([])
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

    if ((loadingSchedule && !workload.length) || loadingWorkload) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
    }

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

    // Helpers for theory and practical (API may use Theory/Lab or Theory/Practical)
    const getTheory = (item: FacultyWorkloadData): number => item.Theory ?? 0
    const getPractical = (item: FacultyWorkloadData): number => item.Practical ?? item.Lab ?? 0

    // Calculate totals for footer based on filtered data
    const totalStudents = filteredWorkload.reduce((acc, curr) => acc + (curr.NoofStudents || 0), 0)
    const totalTheory = filteredWorkload.reduce((acc, curr) => acc + getTheory(curr), 0)
    const totalPractical = filteredWorkload.reduce((acc, curr) => acc + getPractical(curr), 0)
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
                                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

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
                                <TableHead className="text-center">Practical</TableHead>
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
                                        {facultyWorkload.length > 0 ? "No subjects match the selected filters (Academic Year: " + academicYear + ", Semester: " + semesterType + ")." : "No workload data found. Please click 'Load' button to fetch workload data."}
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
                                        <TableCell className="text-center">{getTheory(item)}</TableCell>
                                        <TableCell className="text-center">{getPractical(item)}</TableCell>
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
                                    <TableCell className="text-center font-bold">{totalPractical}</TableCell>
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
