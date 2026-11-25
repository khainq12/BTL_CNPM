import { useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function UnauthorisedError() {
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center'>
        <p className='text-muted-foreground text-sm font-medium'>Mã lỗi 401</p>
        <h1 className='text-2xl font-semibold'>Phiên đăng nhập đã hết hạn</h1>
        <p className='text-muted-foreground max-w-md'>Đăng nhập lại để tiếp tục làm việc.</p>
        <div className='mt-6 flex gap-3'>
          <Button variant='outline' onClick={() => history.go(-1)}>Quay lại</Button>
          <Button onClick={() => navigate({ to: '/' })}>Về hộp việc</Button>
        </div>
      </div>
    </div>
  )
}
