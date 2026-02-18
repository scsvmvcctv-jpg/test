'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react'
import { forgotPasswordAction } from '@/app/actions/auth'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [userType, setUserType] = useState('Staff')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [sentEmail, setSentEmail] = useState<string | null>(null)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)
        setSentEmail(null)

        if (!email) {
            setError('Please enter your User ID or Email')
            setLoading(false)
            return
        }

        try {
            const formData = new FormData()
            formData.append('email', email)
            formData.append('userType', userType)

            const result = await forgotPasswordAction(null, formData)

            if (result.error) {
                setError(result.error)
            } else {
                setSuccess(true)
                if (result.email) {
                    setSentEmail(result.email)
                }
                setTimeout(() => {
                    router.push('/login')
                }, 5000) // Increased timeout to let user read the email
            }
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-purple-500 to-pink-500 p-4">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]" />

            <Card className="w-full max-w-md border-white/20 shadow-2xl bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 relative z-10 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                <CardHeader className="space-y-4 flex flex-col items-center text-center pt-8">
                    <div className="w-20 h-20 relative mb-2 p-4 bg-white rounded-full shadow-lg ring-4 ring-purple-100">
                        <Mail className="w-10 h-10 text-indigo-600 mx-auto" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Forgot Password
                        </CardTitle>
                        <CardDescription className="text-gray-600 font-medium text-center">
                            Enter your User ID or Email to receive your credentials
                        </CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-5">
                        {error && (
                            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="flex flex-col gap-2 p-3 text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Credentials sent successfully!</span>
                                </div>
                                {sentEmail && (
                                    <div className="ml-6 text-xs text-gray-600">
                                        Check your inbox at: <span className="font-semibold text-indigo-600">{sentEmail}</span>
                                    </div>
                                )}
                                <div className="ml-6 text-xs">Redirecting to login...</div>
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
                            <Label htmlFor="email" className="text-gray-700 font-semibold">
                                {userType === 'Staff' ? 'User ID or Email' : 'User ID'}
                            </Label>
                            <Input
                                id="email"
                                type="text"
                                placeholder={userType === 'Staff' ? "Enter your User ID or Email" : "Enter your User ID"}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading || success}
                                className="h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50"
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
                            disabled={loading || success}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Sending...
                                </span>
                            ) : success ? (
                                'Email Sent!'
                            ) : (
                                'Send Credentials'
                            )}
                        </Button>
                        <Link href="/login" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">
                            Back to Login
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
