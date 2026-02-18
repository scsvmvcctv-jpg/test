import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-background text-foreground">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 md:px-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold">
          Faculty Log Book
        </h1>
        <p className="mt-3 text-xl md:text-2xl text-muted-foreground">
          Digital Management System
        </p>
        <div className="flex mt-6">
          <Link href="/login">
            <Button size="lg">Login</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
