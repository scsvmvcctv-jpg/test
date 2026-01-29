'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        if (data) setProfile(data)
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: profile.full_name,
                mobile_no: profile.mobile_no,
                updated_at: new Date().toISOString()
            })
            .eq('id', profile.id)

        setSaving(false)
        if (error) alert('Error saving profile')
        else alert('Profile saved!')
    }

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold">Profile</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={profile?.email || ''} disabled />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="emp_id">Employee ID</Label>
                            <Input id="emp_id" value={profile?.emp_id || ''} disabled />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="full_name">Full Name</Label>
                            <Input id="full_name" value={profile?.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="department">Department</Label>
                            <Input id="department" value={profile?.department_name || profile?.department || ''} disabled />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="designation">Designation</Label>
                            <Input id="designation" value={profile?.designation_name || profile?.designation || ''} disabled />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="mobile_no">Mobile Number</Label>
                            <Input id="mobile_no" value={profile?.mobile_no || ''} onChange={e => setProfile({ ...profile, mobile_no: e.target.value })} />
                        </div>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
