export const LOGBOOK_LOCK_STATUSES = ['Submitted', 'HOD Approved', 'Dean Approved'] as const

export type LogbookLockStatus = (typeof LOGBOOK_LOCK_STATUSES)[number]

export type InspectionLockRecord = {
    status?: string | null
    academic_year?: string | null
    semester_type?: string | null
}

export function isLogbookLocked(inspections: InspectionLockRecord[] | null | undefined): boolean {
    return (inspections || []).some((inspection) => {
        const status = (inspection.status || '').trim()
        return LOGBOOK_LOCK_STATUSES.includes(status as LogbookLockStatus)
    })
}

export function isLogbookLockedForPeriod(
    inspections: InspectionLockRecord[] | null | undefined,
    academicYear: string,
    semesterType: string
): boolean {
    if (!academicYear || !semesterType || semesterType === 'All') return false

    return (inspections || []).some((inspection) => {
        const status = (inspection.status || '').trim()
        if (!LOGBOOK_LOCK_STATUSES.includes(status as LogbookLockStatus)) return false

        const year = (inspection.academic_year || '').trim()
        const sem = (inspection.semester_type || '').trim()

        // Legacy rows without period do not lock a specific year/semester
        if (!year || !sem) return false

        return year === academicYear && sem === semesterType
    })
}

export function getLogbookLockStatus(
    inspections: InspectionLockRecord[] | null | undefined,
    academicYear?: string,
    semesterType?: string
): string | null {
    const locked = (inspections || []).find((inspection) => {
        const status = (inspection.status || '').trim()
        if (!LOGBOOK_LOCK_STATUSES.includes(status as LogbookLockStatus)) return false

        if (academicYear && semesterType && semesterType !== 'All') {
            const year = (inspection.academic_year || '').trim()
            const sem = (inspection.semester_type || '').trim()
            if (!year || !sem) return false
            return year === academicYear && sem === semesterType
        }

        return true
    })
    return locked?.status?.trim() || null
}

export function getLogbookLockMessage(academicYear?: string, semesterType?: string): string {
    if (academicYear && semesterType && semesterType !== 'All') {
        return `Logbook is locked for Academic Year ${academicYear}, ${semesterType} semester. Lecture plan, tests, assignments, extra classes, and assessments cannot be modified for this period.`
    }
    return 'Your inspection has been submitted. Lecture plan, tests, assignments, extra classes, and assessments are locked and cannot be modified.'
}
