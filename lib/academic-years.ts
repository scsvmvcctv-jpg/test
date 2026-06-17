export const DEFAULT_ACADEMIC_YEAR = '2026-2027'
export const DEFAULT_SEMESTER_TYPE = 'Odd'

const DEFAULT_ACADEMIC_YEARS = ['2026-2027', '2025-2026', '2024-2025', '2023-2024', '2022-2023']

export type WorkloadSubjectRow = {
    SubjectCode?: string
    Subject_Name?: string
    Semester?: string | number
    Academicyear?: string
}

export function getAcademicYearOptions(
    filterOptions: unknown,
    extraYears: string[] = []
): string[] {
    const raw = filterOptions as Record<string, unknown> | null | undefined
    const fromApi = raw?.academicYears ?? raw?.AcademicYear ?? raw?.academicYear

    const years = new Set<string>()

    if (Array.isArray(fromApi)) {
        fromApi.forEach((year) => {
            const value = String(year ?? '').trim()
            if (value) years.add(value)
        })
    }

    extraYears.forEach((year) => {
        const value = String(year ?? '').trim()
        if (value) years.add(value)
    })

    if (years.size === 0) {
        DEFAULT_ACADEMIC_YEARS.forEach((year) => years.add(year))
    }

    years.add(DEFAULT_ACADEMIC_YEAR)

    return [...years].sort((a, b) => b.localeCompare(a))
}

export function resolveAcademicYear(
    years: string[],
    preferred: string = DEFAULT_ACADEMIC_YEAR
): string {
    if (preferred && years.includes(preferred)) return preferred
    return years[0] || DEFAULT_ACADEMIC_YEAR
}

export function filterWorkloadByPeriod<T extends WorkloadSubjectRow>(
    items: T[],
    academicYear: string = DEFAULT_ACADEMIC_YEAR,
    semesterType: string = DEFAULT_SEMESTER_TYPE
): T[] {
    return items.filter((item) => {
        if (academicYear && item.Academicyear !== academicYear) return false

        const sem = Number(item.Semester)
        if (semesterType === 'Odd' && sem % 2 === 0) return false
        if (semesterType === 'Even' && sem % 2 !== 0) return false

        return true
    })
}

export function matchesWorkloadSubject(
    subject: string | null | undefined,
    workloadItems: WorkloadSubjectRow[]
): boolean {
    const value = (subject || '').trim().toLowerCase()
    if (!value || workloadItems.length === 0) return false

    return workloadItems.some((item) => {
        const name = (item.Subject_Name || '').trim().toLowerCase()
        const code = (item.SubjectCode || '').trim().toLowerCase()
        return value === name || value === code
    })
}
