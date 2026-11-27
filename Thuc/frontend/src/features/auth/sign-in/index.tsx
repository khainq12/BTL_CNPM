import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { describeError } from '@/api/hooks'
import { login } from '@/api/service'
import { resetDb } from '@/mock/db'
import { useAuthStore } from '@/stores/auth-store'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
  const [confirmReset, setConfirmReset] = useState(false)
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

  function handleConfirmReset() {
    resetDb()
    qc.clear()
    setError(null)
    setConfirmReset(false)
    toast.success('Đã khôi phục dữ liệu mẫu')
  }

  return (
    <AuthLayout>
      <Card className='border-border/80 gap-5 overflow-hidden pt-0 pb-6 shadow-[0_1px_2px_rgb(19_33_46/0.04),0_14px_34px_-16px_rgb(19_33_46/0.14)] dark:shadow-[0_16px_36px_-14px_rgb(0_0_0/0.5)]'>
        <div className='bg-primary h-1 w-full' aria-hidden />
        <CardHeader className='pt-1'>
          <CardTitle className='text-xl tracking-tight'>Đăng nhập</CardTitle>
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
                      <Input {...field} className='h-10' placeholder='VD: tiepnhan' autoComplete='username' autoFocus />
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
                      <PasswordInput {...field} className='[&_input]:h-10' placeholder='Nhập mật khẩu' autoComplete='current-password' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type='submit' disabled={loading} className='mt-1 h-10 w-full font-medium shadow-xs'>
                {loading && <Loader2 className='animate-spin' />}
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className='border-border/70 bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-xs leading-relaxed'>
        <p>Bản chạy thử với dữ liệu giả, chưa nối backend. Danh sách tài khoản mẫu xem trong README.txt của thư mục frontend.</p>
        <button
          type='button'
          className='text-foreground/85 hover:text-foreground mt-2 inline-flex items-center gap-1.5 font-medium underline underline-offset-4'
          onClick={() => setConfirmReset(true)}
        >
          <RotateCcw className='size-3.5' aria-hidden />
          Khôi phục dữ liệu mẫu
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title='Khôi phục dữ liệu mẫu'
        desc='Xóa mọi thay đổi hiện tại trong trình duyệt và khôi phục dữ liệu mẫu ban đầu?'
        cancelBtnText='Hủy'
        confirmText='Khôi phục'
        destructive
        handleConfirm={handleConfirmReset}
      />
    </AuthLayout>
  )
}
