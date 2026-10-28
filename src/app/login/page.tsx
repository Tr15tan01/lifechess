import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/auth-form'
import { getSessionUser } from '@/server/auth/session'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/')
  return <AuthForm mode="login" />
}
