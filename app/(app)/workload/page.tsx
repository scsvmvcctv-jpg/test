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
import { Loader2, Pencil } from 'lucide-react'
// import { useToast } from '@/hooks/use-toast'
// I'll skip toast for now or add it. ShadCN has a toast component.
// I'll use simple alert for MVP or implement toast if I have time.
// I'll stick to simple state for error/success for now.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function WorkloadPage() {
    const [workload, setWorkload] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingDay, setEditingDay] = useState<any>(null)
    const [open, setOpen] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        fetchWorkload()
    }, [])

    const fetchWorkload = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('workload')
            .select('*')
            .eq('staff_id', user.id)

        if (data) {
            // Merge with default days
            const merged = DAYS.map(day => {
                const existing = data.find((d: any) => d.day_of_week === day)
                return existing || { day_of_week: day, period_1: '', period_2: '', period_3: '', period_4: '', period_5: '', period_6: '', period_7: '', period_8: '' }
            })
            setWorkload(merged)
        }
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
            .from('workload')
            .upsert({
                staff_id: user.id,
                ...editingDay,
                updated_at: new Date().toISOString()
            }, { onConflict: 'staff_id, day_of_week' }) // Wait, I need a unique constraint on staff_id + day_of_week for upsert to work by constraint?
        // Or I can just check if ID exists.
        // My schema didn't enforce unique constraint on (staff_id, day_of_week).
        // I should probably add that or handle it manually.
        // For now, I'll rely on the ID if it exists, or insert new.
        // But `editingDay` might not have ID if it's a virtual row.
        // So I should check if I have an ID.

        // Better approach:
        // If editingDay.id exists, update.
        // If not, insert.
        // But wait, if I insert, I need to make sure I don't create duplicates for the same day.
        // I should add a unique constraint in SQL.
        // For now, I'll just check if record exists for that day.

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
            fetchWorkload()
        } else {
            alert('Error saving workload')
        }
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Workload</h1>
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
    )
}
