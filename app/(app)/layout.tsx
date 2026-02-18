import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6 bg-secondary/10">
                    {children}
                </main>
            </div>
        </div>
    )
}
