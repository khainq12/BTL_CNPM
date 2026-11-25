import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { describeError } from '@/api/hooks'
import { isHttp } from '@/api/mode'
import { login } from '@/api/service'
import { resetDb } from '@/mock/db'
import { useAuthStore } from '@/stores/auth-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { AuthLayout } from '../auth-layout'

const schema = z.object({
  username: z.string().trim().min(1, 'Nhập tên đăng nhập.'),
  password: z.string().min(1, 'Nhập mật khẩu.'),
})

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const navigate = useNavigate()
  const signIn = useAuthStore((s) => s.signIn)
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } })

  async function onSubmit(v: z.infer<typeof schema>) {
    setError(null)
    setLoading(true)
    try {
      const u = await login(v.username, v.password)
      signIn(u)
      qc.clear()
      navigate({ to: redirect && redirect.startsWith('/') ? redirect : '/', replace: true })
    } catch (e) {
      setError(describeError(e))
      form.setValue('password', '')
      form.setFocus('password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Đăng nhập</CardTitle>
          <CardDescription>Dùng tài khoản nhân viên do quản lý cấp. Mỗi tài khoản gắn với một vai trò.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='grid gap-4' noValidate>
              {error && (
                <Alert variant='destructive'>
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên đăng nhập</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete='username' autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mật khẩu</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} autoComplete='current-password' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type='submit' disabled={loading}>
                {loading && <Loader2 className='animate-spin' />}
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      {isHttp ? (
        <p className='text-muted-foreground text-xs'>Kết nối máy chủ WOMS. Quên mật khẩu thì liên hệ quản lý để đặt lại.</p>
      ) : (
        <p className='text-muted-foreground text-xs'>
          Bản chạy thử với dữ liệu giả trong trình duyệt. Danh sách tài khoản mẫu xem trong README của apps/staff-web.{' '}
          <button
            type='button'
            className='hover:text-foreground underline underline-offset-2'
            onClick={() => {
              if (confirm('Xóa mọi thay đổi và khôi phục dữ liệu mẫu ban đầu?')) {
                resetDb()
                qc.clear()
              }
            }}
          >
            Khôi phục dữ liệu mẫu
          </button>
        </p>
      )}
    </AuthLayout>
  )
}
