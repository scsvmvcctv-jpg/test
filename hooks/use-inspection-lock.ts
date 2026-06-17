'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    getLogbookLockMessage,
    getLogbookLockStatus,
    isLogbookLockedForPeriod,
} from '@/lib/inspection-lock'

export function useInspectionLock(academicYear?: string, semesterType?: string) {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [isLocked, setIsLocked] = useState(false)
    const [lockStatus, setLockStatus] = useState<string | null>(null)

    const lockMessage = getLogbookLockMessage(academicYear, semesterType)

    useEffect(() => {
        let active = true

        const checkLock = async () => {
            setLoading(true)
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) {
                if (active) {
                    setIsLocked(false)
                    setLockStatus(null)
                    setLoading(false)
                }
                return
            }

            const { data } = await supabase
                .from('inspections')
                .select('status, academic_year, semester_type')
                .eq('staff_id', user.id)

            if (!active) return

            const locked = academicYear && semesterType && semesterType !== 'All'
                ? isLogbookLockedForPeriod(data, academicYear, semesterType)
                : false

            setIsLocked(locked)
            setLockStatus(
                locked ? getLogbookLockStatus(data, academicYear, semesterType) : null
            )
            setLoading(false)
        }

        checkLock()

        return () => {
            active = false
        }
    }, [supabase, academicYear, semesterType])

    return {
        loading,
        isLocked,
        lockStatus,
        lockMessage,
        blockIfLocked: () => {
            if (isLocked) {
                alert(lockMessage)
                return true
            }
            return false
        },
    }
}
