'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { loginAction } from '@/app/actions/auth'

export default function LoginPage() {
    const [email, setEmail] = useState('') // This will hold UserID
    const [password, setPassword] = useState('')
    const [userType, setUserType] = useState('Staff')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const formData = new FormData()
        formData.append('email', email)
        formData.append('password', password)
        formData.append('userType', userType)

        try {
            const result = await loginAction(null, formData)
            console.log('Login result:', result)

            if (result.error) {
                console.error('Login error:', result.error)
                setError(result.error)
            } else {
                console.log('Login success, role:', result.role)
                if (result.role === 'Supervisor') {
                    // Store admin token and data
                    localStorage.setItem('adminToken', result.token)
                    localStorage.setItem('adminData', JSON.stringify(result.admin))
                    console.log('Redirecting to /admin')
                    router.push('/admin')
                } else {
                    console.log('Redirecting to /dashboard')
                    router.push('/dashboard')
                }
                // router.refresh() - Removing to see if it fixes redirect
            }
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-purple-500 to-pink-500">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]" />

            <Card className="w-full max-w-md border-white/20 shadow-2xl bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 relative z-10 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                <CardHeader className="space-y-4 flex flex-col items-center text-center pt-8">
                    <div className="w-28 h-28 relative mb-2 p-4 bg-white rounded-full shadow-lg ring-4 ring-purple-100">
                        <img
                            src="https://kanchiuniv.ac.in/wp-content/uploads/2020/09/logo_bl.png"
                            alt="SCSVMV Logo"
                            className="object-contain w-full h-full"
                        />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            SCSVMV LOG BOOK
                        </CardTitle>
                        <CardDescription className="text-gray-600 font-medium">
                            Faculty & Staff Portal
                        </CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-5">
                        {error && (
                            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex p-1.5 bg-gray-100/80 rounded-xl border border-gray-200">
                            <button
                                type="button"
                                onClick={() => setUserType('Staff')}
                                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${userType === 'Staff'
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                                    }`}
                            >
                                Staff
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserType('Supervisor')}
                                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${userType === 'Supervisor'
                                    ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                                    }`}
                            >
                                Supervisor
                            </button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-700 font-semibold">User ID</Label>
                            <Input
                                id="email"
                                type="text"
                                placeholder="Enter your University ID"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-700 font-semibold">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-11 border-gray-200 focus:border-purple-500 focus:ring-purple-500 bg-white/50"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4 pb-8">
                        <Button
                            type="submit"
                            className={`w-full h-11 text-lg font-medium shadow-lg transition-all duration-300 ${userType === 'Staff'
                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-200'
                                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-purple-200'
                                }`}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </span>
                            ) : 'Sign In'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
