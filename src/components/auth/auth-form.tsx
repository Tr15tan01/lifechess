'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { api, ApiError } from '@/lib/api-client'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const reg = mode === 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api(`/api/auth/${mode}`, { body: reg ? { name, email, password } : { email, password } })
      router.replace('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="display-md">{reg ? 'Save your progress' : 'Welcome back'}</h1>
      <p className="mt-2 text-sm text-ink-2">{reg ? 'An account is optional. It keeps your finished games and unlocks your charts.' : 'Sign in to keep your games and see your charts.'}</p>
      {error && <p role="alert" className="mt-5 rounded-[10px] border border-bad/40 bg-bad/10 px-3.5 py-2.5 text-sm text-ink">{error}</p>}
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {reg && <Field label="Name">{(p) => <Input {...p} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />}</Field>}
        <Field label="Email">{(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password" hint={reg ? 'At least 10 characters, mixing letters with numbers or symbols.' : undefined}>
          {(p) => <Input {...p} type="password" autoComplete={reg ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" loading={loading}>{reg ? 'Create account' : 'Sign in'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        {reg ? 'Already have an account? ' : 'New here? '}
        <Link href={reg ? '/login' : '/register'} className="text-gold hover:underline">{reg ? 'Sign in' : 'Create one'}</Link>
        {' · '}
        <Link href="/" className="text-gold hover:underline">Keep playing as a guest</Link>
      </p>
    </div>
  )
}
