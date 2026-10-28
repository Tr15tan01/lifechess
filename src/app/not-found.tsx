import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="display-lg">That square is empty</h1>
        <p className="mt-3 text-ink-2">The page you were looking for does not exist.</p>
        <Button asChild className="mt-8">
          <Link href="/">Back to the board</Link>
        </Button>
      </div>
    </main>
  )
}
