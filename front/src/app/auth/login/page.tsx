'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi } from '@/lib/api'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import { cn } from '@/lib/utils'

function LoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    const response = await authApi.sessionLogin(data.email, data.password)

    if (!response.success) {
      setError('root', {
        message: response.message || 'Login failed',
      })
      return
    }

    router.replace(next)
  }

  return (
    <div className='w-full max-w-md rounded-xl border border-border bg-surface p-6'>
      <h1 className='mb-2 text-2xl font-semibold text-foreground'>Sign in</h1>
      <p className='mb-6 text-sm text-text-secondary'>
        Use your BugLess account to access dashboard session.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
        {errors.root?.message && (
          <div className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {errors.root.message}
          </div>
        )}

        <div className='space-y-2'>
          <label htmlFor='email' className='text-sm font-medium'>
            Email
          </label>
          <Input
            id='email'
            type='email'
            placeholder='you@example.com'
            autoComplete='email'
            disabled={isSubmitting}
            className={cn(errors.email && 'border-destructive')}
            {...register('email')}
          />
          {errors.email && (
            <p className='text-xs text-destructive'>{errors.email.message}</p>
          )}
        </div>

        <div className='space-y-2'>
          <label htmlFor='password' className='text-sm font-medium'>
            Password
          </label>
          <Input
            id='password'
            type='password'
            placeholder='********'
            autoComplete='current-password'
            disabled={isSubmitting}
            className={cn(errors.password && 'border-destructive')}
            {...register('password')}
          />
          {errors.password && (
            <p className='text-xs text-destructive'>{errors.password.message}</p>
          )}
        </div>

        <Button type='submit' className='w-full' disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className='mt-5 text-center text-sm text-text-secondary'>
        Don&apos;t have an account?{' '}
        <Link href='/auth/register' className='text-primary hover:underline'>
          Create account
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md p-6">Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}
