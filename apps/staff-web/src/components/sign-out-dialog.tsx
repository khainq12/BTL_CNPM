import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useMe } from '@/api/hooks'
import { logAudit } from '@/api/service'
import { useAuthStore } from '@/stores/auth-store'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const signOut = useAuthStore((s) => s.signOut)
  const me = useMe()
  const qc = useQueryClient()

  const handleSignOut = () => {
    logAudit(me, 'Đăng xuất')
    signOut()
    qc.clear()
    navigate({ to: '/sign-in', replace: true })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Đăng xuất'
      desc='Kết thúc phiên làm việc trên máy này. Muốn làm việc với vai trò khác, đăng nhập lại bằng tài khoản của vai trò đó.'
      confirmText='Đăng xuất'
      cancelBtnText='Ở lại'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
