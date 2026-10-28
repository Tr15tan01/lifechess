import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/auth-form'
import { getSessionUser } from '@/server/auth/session'

export const metadata: Metadata = { title: 'Create account' }

export default async function RegisterPage() {
  if (await getSessionUser()) redirect('/')
  return <AuthForm mode="register" />
}
