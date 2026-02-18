'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AdminLoginPage() {
    const [userId, setUserId] = useState('')
    const [password, setPassword] = useState('')
    const [userType, setUserType] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/admin-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ UserId: userId, password, UserType: userType }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Login failed')
            }

            // Store token and admin data
            localStorage.setItem('adminToken', data.token)
            localStorage.setItem('adminData', JSON.stringify(data.admin))

            // Redirect to admin dashboard (adjust path as needed)
            router.push('/admin')
            router.refresh()

        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
            <Card className="w-full max-w-md border-none shadow-2xl bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <CardHeader className="space-y-4 flex flex-col items-center text-center">
                    <div className="w-24 h-24 relative mb-2">
                        <img
                            src="https://kanchiuniv.ac.in/wp-content/uploads/2020/09/logo_bl.png"
                            alt="SCSVMV Logo"
                            className="object-contain w-full h-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Admin Portal</CardTitle>
                        <CardDescription className="text-gray-600/80">Secure Access for Administrators</CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-50 rounded-md dark:bg-red-900/20">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="userId">User ID</Label>
                            <Input
                                id="userId"
                                type="text"
                                placeholder="Enter Admin User ID"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="userType">User Type</Label>
                            <Select onValueChange={setUserType} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select User Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                    <SelectItem value="SuperAdmin">Super Admin</SelectItem>
                                    {/* Add other roles as needed based on your DB */}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full bg-gray-900 hover:bg-gray-800" disabled={loading}>
                            {loading ? 'Authenticating...' : 'Login to Dashboard'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
