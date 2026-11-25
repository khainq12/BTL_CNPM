import { useNavigate, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundError() {
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center'>
        <p className='text-muted-foreground text-sm font-medium'>Mã lỗi 404</p>
        <h1 className='text-2xl font-semibold'>Không tìm thấy trang</h1>
        <p className='text-muted-foreground max-w-md'>Đường dẫn không tồn tại hoặc nội dung đã bị xóa.</p>
        <div className='mt-6 flex gap-3'>
          <Button variant='outline' onClick={() => history.go(-1)}>Quay lại</Button>
          <Button onClick={() => navigate({ to: '/' })}>Về hộp việc</Button>
        </div>
      </div>
    </div>
  )
}
