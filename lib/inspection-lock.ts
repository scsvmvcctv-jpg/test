export const LOGBOOK_LOCK_STATUSES = ['Submitted', 'HOD Approved', 'Dean Approved'] as const

export type LogbookLockStatus = (typeof LOGBOOK_LOCK_STATUSES)[number]

export function isLogbookLocked(inspections: { status?: string | null }[] | null | undefined): boolean {
    return (inspections || []).some((inspection) => {
        const status = (inspection.status || '').trim()
        return LOGBOOK_LOCK_STATUSES.includes(status as LogbookLockStatus)
    })
}

export function getLogbookLockStatus(inspections: { status?: string | null }[] | null | undefined): string | null {
    const locked = (inspections || []).find((inspection) => {
        const status = (inspection.status || '').trim()
        return LOGBOOK_LOCK_STATUSES.includes(status as LogbookLockStatus)
    })
    return locked?.status?.trim() || null
}

export const LOGBOOK_LOCK_MESSAGE =
    'Your inspection has been submitted. Lecture plan, tests, assignments, extra classes, and assessments are locked and cannot be modified.'
