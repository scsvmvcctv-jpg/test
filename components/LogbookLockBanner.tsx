'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Lock } from 'lucide-react'
import { getLogbookLockMessage } from '@/lib/inspection-lock'

type LogbookLockBannerProps = {
    isLocked: boolean
    lockStatus?: string | null
    academicYear?: string
    semesterType?: string
    lockMessage?: string
}

export function LogbookLockBanner({
    isLocked,
    lockStatus,
    academicYear,
    semesterType,
    lockMessage,
}: LogbookLockBannerProps) {
    if (!isLocked) return null

    const message = lockMessage || getLogbookLockMessage(academicYear, semesterType)

    return (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <Lock className="h-4 w-4" />
            <AlertTitle>Logbook locked for this period</AlertTitle>
            <AlertDescription>
                {message}
                {lockStatus ? ` Current inspection status: ${lockStatus}.` : ''}
            </AlertDescription>
        </Alert>
    )
}
