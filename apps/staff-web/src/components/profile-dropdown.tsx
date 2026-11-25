import { Link } from '@tanstack/react-router'
import useDialogState from '@/hooks/use-dialog-state'
import { useMe } from '@/api/hooks'
import { initials } from '@/domain/format'
import { ROLE_LABEL } from '@/domain/roles'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const me = useMe()

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full' aria-label='Tài khoản'>
            <Avatar className='h-8 w-8'>
              <AvatarFallback>{initials(me.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-60' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <p className='text-sm font-medium'>{me.name}</p>
            <p className='text-muted-foreground text-xs'>{ROLE_LABEL[me.role]}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to='/ca-nhan'>Tài khoản và mật khẩu</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
