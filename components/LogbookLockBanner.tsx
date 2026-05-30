'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Lock } from 'lucide-react'
import { LOGBOOK_LOCK_MESSAGE } from '@/lib/inspection-lock'

type LogbookLockBannerProps = {
    isLocked: boolean
    lockStatus?: string | null
}

export function LogbookLockBanner({ isLocked, lockStatus }: LogbookLockBannerProps) {
    if (!isLocked) return null

    return (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <Lock className="h-4 w-4" />
            <AlertTitle>Logbook locked</AlertTitle>
            <AlertDescription>
                {LOGBOOK_LOCK_MESSAGE}
                {lockStatus ? ` Current inspection status: ${lockStatus}.` : ''}
            </AlertDescription>
        </Alert>
    )
}
