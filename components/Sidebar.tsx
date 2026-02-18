'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    LayoutDashboard,
    Calendar,
    BookOpen,
    FileText,
    ClipboardList,
    GraduationCap,
    FlaskConical,
    Search,
    LogOut,
    Users
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'

export const sidebarItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Workload', href: '/workload', icon: Calendar },
    { name: 'Lecture Plan', href: '/lecture-plan', icon: BookOpen },
    { name: 'Tests', href: '/tests', icon: FileText },
    { name: 'Assignments', href: '/assignments', icon: ClipboardList },
    { name: 'Extra Classes', href: '/extra-classes', icon: GraduationCap },
    { name: 'Theory Assessment', href: '/assessment/theory', icon: BookOpen },
    { name: 'Practical Assessment', href: '/assessment/practical', icon: FlaskConical },
    { name: 'Inspections', href: '/inspections', icon: Search },
]

export const adminSidebarItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
]

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        // Check if admin
        const adminDataStr = localStorage.getItem('adminData')
        if (adminDataStr) {
            try {
                const adminData = JSON.parse(adminDataStr)
                await logoutAction(adminData.UserId?.trim())
            } catch (e) {
                console.error('Error logging out admin:', e)
            }

            localStorage.removeItem('adminToken')
            localStorage.removeItem('adminData')
        }

        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const items = pathname.startsWith('/admin') ? adminSidebarItems : sidebarItems

    return (
        <div className="hidden md:flex flex-col h-screen w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white border-r border-blue-700 shadow-xl">
            <div className="p-6 flex flex-col items-center border-b border-blue-700/50">
                <div className="w-20 h-20 relative mb-3 bg-white rounded-full p-2 shadow-lg">
                    <img
                        src="https://kanchiuniv.ac.in/wp-content/uploads/2020/09/logo_bl.png"
                        alt="SCSVMV Logo"
                        className="object-contain w-full h-full"
                    />
                </div>
                <h1 className="text-lg font-bold text-center text-white tracking-wide">SCSVMV-LOG-BOOK</h1>
            </div>
            <nav className="flex-1 px-4 space-y-2 overflow-y-auto py-4">
                {items.map((item) => (
                    <Link key={item.href} href={item.href}>
                        <Button
                            variant="ghost"
                            className={cn(
                                "w-full justify-start gap-3 text-blue-100 hover:text-white hover:bg-white/10 transition-all duration-200",
                                pathname === item.href && "bg-white/20 text-white font-medium shadow-sm"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.name}
                        </Button>
                    </Link>
                ))}
            </nav>
            <div className="p-4 border-t border-blue-700/50 bg-blue-900/50">
                <Button variant="ghost" className="w-full justify-start gap-3 text-red-300 hover:text-red-200 hover:bg-red-900/30" onClick={handleLogout}>
                    <LogOut className="w-5 h-5" />
                    Logout
                </Button>
            </div>
        </div>
    )
}
