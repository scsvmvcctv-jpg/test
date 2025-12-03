'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { sidebarItems, adminSidebarItems } from './Sidebar'
import { logoutAction } from '@/app/actions/auth'

export function Header() {
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()
    const [user, setUser] = useState<any>(null)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const items = pathname.startsWith('/admin') ? adminSidebarItems : sidebarItems

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()
    }, [])

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

    return (
        <header className="flex items-center justify-between h-16 px-6 border-b bg-white shadow-sm sticky top-0 z-10">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    <Menu className="w-6 h-6 text-blue-900" />
                </Button>
                <h2 className="text-xl font-bold text-blue-900 tracking-tight">Faculty Dashboard</h2>
            </div>

            <div className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src="/avatars/01.png" alt="@shadcn" />
                                <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">Faculty</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/profile')}>
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogout}>
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                    <div className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white shadow-xl p-4 flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-lg font-bold">Menu</span>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <nav className="flex-1 space-y-2 overflow-y-auto">
                            {items.map((item) => (
                                <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-3 text-blue-100 hover:text-white hover:bg-white/10",
                                            pathname === item.href && "bg-white/20 text-white font-medium"
                                        )}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        {item.name}
                                    </Button>
                                </Link>
                            ))}
                        </nav>
                        <div className="mt-4 pt-4 border-t border-blue-700/50">
                            <Button variant="ghost" className="w-full justify-start gap-3 text-red-300 hover:text-red-200 hover:bg-red-900/30" onClick={handleLogout}>
                                <LogOut className="w-5 h-5" />
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    )
}
