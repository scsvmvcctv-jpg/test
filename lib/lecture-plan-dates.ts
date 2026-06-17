import { addDaysToDateOnly, compareDateOnly, formatInAppTz, getTodayInAppTz } from '@/lib/datetime'

export function getMaxActualDate(proposedDate: string): string {
    return addDaysToDateOnly(proposedDate, 1)
}

/** Latest actual date the user may pick (T+1, but not in the future). */
export function getSelectableMaxActualDate(proposedDate: string): string {
    const max = getMaxActualDate(proposedDate)
    const today = getTodayInAppTz('yyyy-MM-dd')
    return compareDateOnly(today, max) < 0 ? today : max
}

export function validateLecturePlanDates(
    proposedDate: string | null | undefined,
    actualDate: string | null | undefined
): string | null {
    if (!proposedDate) return 'Proposed date is required.'
    if (!actualDate) return null

    if (compareDateOnly(proposedDate, actualDate) > 0) {
        return 'Proposed date cannot be after Actual date.'
    }

    const maxActual = getMaxActualDate(proposedDate)
    if (compareDateOnly(actualDate, maxActual) > 0) {
        return 'Actual date cannot be later than one day after the Proposed date (T+1).'
    }

    const today = getTodayInAppTz('yyyy-MM-dd')
    if (compareDateOnly(actualDate, today) > 0) {
        return 'Actual date cannot be in the future.'
    }

    return null
}

export type LecturePlanEditState = {
    canEdit: boolean
    canComplete: boolean
    isLocked: boolean
    lockReason?: string
}

export function getLecturePlanEditState(
    proposedDate: string | null | undefined,
    actualDate: string | null | undefined
): LecturePlanEditState {
    if (!proposedDate) {
        return { canEdit: true, canComplete: false, isLocked: false }
    }

    const today = getTodayInAppTz('yyyy-MM-dd')
    const tPlus1 = getMaxActualDate(proposedDate)
    const proposedLabel = formatInAppTz(proposedDate, 'dd/MM/yyyy')
    const tPlus1Label = formatInAppTz(tPlus1, 'dd/MM/yyyy')

    if (actualDate) {
        return {
            canEdit: false,
            canComplete: false,
            isLocked: true,
            lockReason: 'This entry is completed and cannot be edited.',
        }
    }

    if (compareDateOnly(today, proposedDate) < 0) {
        return {
            canEdit: true,
            canComplete: false,
            isLocked: false,
            lockReason: `Completion is allowed from ${proposedLabel} (proposed date) through ${tPlus1Label} (T+1).`,
        }
    }

    if (compareDateOnly(today, tPlus1) > 0) {
        return {
            canEdit: false,
            canComplete: false,
            isLocked: true,
            lockReason: `The completion window (${proposedLabel} to ${tPlus1Label}) has passed.`,
        }
    }

    return {
        canEdit: true,
        canComplete: true,
        isLocked: false,
    }
}
