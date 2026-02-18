'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react'

export default function OfficerLoginPage() {
    const [userId, setUserId] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [captchaAnswer, setCaptchaAnswer] = useState<number>(0)
    const [captchaQuestion, setCaptchaQuestion] = useState<string>('')
    const [captchaInput, setCaptchaInput] = useState<string>('')
    const router = useRouter()

    const generateCaptcha = () => {
        const num1 = Math.floor(Math.random() * 10) + 1
        const num2 = Math.floor(Math.random() * 10) + 1
        const operators = ['+', '-', '×']
        const operator = operators[Math.floor(Math.random() * operators.length)]

        let answer: number
        let question: string

        switch (operator) {
            case '+':
                answer = num1 + num2
                question = `${num1} + ${num2}`
                break
            case '-':
                const larger = Math.max(num1, num2)
                const smaller = Math.min(num1, num2)
                answer = larger - smaller
                question = `${larger} - ${smaller}`
                break
            case '×':
                answer = num1 * num2
                question = `${num1} × ${num2}`
                break
            default:
                answer = num1 + num2
                question = `${num1} + ${num2}`
        }

        setCaptchaQuestion(question)
        setCaptchaAnswer(answer)
        setCaptchaInput('')
    }

    useEffect(() => {
        generateCaptcha()
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const userAnswer = parseInt(captchaInput.trim())
        if (isNaN(userAnswer) || userAnswer !== captchaAnswer) {
            setError('Incorrect security check. Please try again.')
            generateCaptcha()
            setLoading(false)
            return
        }

        try {
            const response = await fetch('/api/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    UserId: userId.trim(),
                    password,
                    UserType: 'Officers',
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Login failed')
            }

            localStorage.setItem('adminToken', data.token)
            localStorage.setItem('adminData', JSON.stringify(data.admin))
            router.push('/admin')
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-teal-400 via-cyan-500 to-blue-600 p-4">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]" />

            <Card className="w-full max-w-md border-white/20 shadow-2xl bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 relative z-10 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600" />

                <CardHeader className="space-y-4 flex flex-col items-center text-center pt-8">
                    <div className="w-28 h-28 relative mb-2 p-4 bg-white rounded-full shadow-lg ring-4 ring-cyan-100">
                        <img
                            src="https://kanchiuniv.ac.in/wp-content/uploads/2020/09/logo_bl.png"
                            alt="SCSVMV Logo"
                            className="object-contain w-full h-full"
                        />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                            SCSVMV LOG BOOK
                        </CardTitle>
                        <CardDescription className="text-gray-600 font-medium">
                            Officers Portal
                        </CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-5">
                        {error && (
                            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="userId" className="text-gray-700 font-semibold">User ID</Label>
                            <Input
                                id="userId"
                                type="text"
                                placeholder="Officer User ID"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                required
                                className="h-11 border-gray-200 focus:border-cyan-500 focus:ring-cyan-500 bg-white/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-700 font-semibold">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-11 border-gray-200 focus:border-cyan-500 focus:ring-cyan-500 bg-white/50 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="captcha" className="text-gray-700 font-semibold">Security Check</Label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                                    <span className="text-lg font-bold text-gray-700">{captchaQuestion} =</span>
                                    <Input
                                        id="captcha"
                                        type="number"
                                        placeholder="?"
                                        value={captchaInput}
                                        onChange={(e) => setCaptchaInput(e.target.value)}
                                        required
                                        className="h-9 w-20 border-gray-200 focus:border-cyan-500 focus:ring-cyan-500 bg-white text-center font-semibold"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={generateCaptcha}
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    aria-label="Refresh captcha"
                                    title="Refresh captcha"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4 pb-8">
                        <Button
                            type="submit"
                            className="w-full h-11 text-lg font-medium shadow-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 shadow-teal-200 transition-all duration-300"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                        <Link
                            href="/login"
                            className="text-sm text-gray-600 hover:text-cyan-600 transition-colors text-center"
                        >
                            Faculty or Staff? Sign in here
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
