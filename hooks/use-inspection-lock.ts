'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    getLogbookLockStatus,
    isLogbookLocked,
    LOGBOOK_LOCK_MESSAGE,
} from '@/lib/inspection-lock'

export function useInspectionLock() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [isLocked, setIsLocked] = useState(false)
    const [lockStatus, setLockStatus] = useState<string | null>(null)

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
                .select('status')
                .eq('staff_id', user.id)

            if (!active) return

            setIsLocked(isLogbookLocked(data))
            setLockStatus(getLogbookLockStatus(data))
            setLoading(false)
        }

        checkLock()

        return () => {
            active = false
        }
    }, [supabase])

    return {
        loading,
        isLocked,
        lockStatus,
        lockMessage: LOGBOOK_LOCK_MESSAGE,
        blockIfLocked: () => {
            if (isLocked) {
                alert(LOGBOOK_LOCK_MESSAGE)
                return true
            }
            return false
        },
    }
}
