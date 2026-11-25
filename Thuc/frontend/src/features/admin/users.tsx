import { useState } from 'react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { ROLE_LABEL } from '@/domain/roles'
import type { Role, User } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CancelButton, Field, FormDialog, NativeSelect, SubmitButton } from '@/components/form-kit'
import { Guard, PageShell, Pill } from '@/components/woms'

// S-95 Tài khoản và phân quyền (FR-15, UC-19). Mỗi tài khoản một vai trò.
export function Users() {
  return (
    <Guard page='users'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const me = useMe()
  const [edit, setEdit] = useState<Partial<User> | null>(null)
  const reset = useAction(api.resetPassword, { success: 'Đã đặt lại mật khẩu về mật khẩu mặc định' })
  return (
    <PageShell
      title='Tài khoản và phân quyền'
      description='Quyền xem và thao tác theo vai trò tuân theo ma trận phân quyền. Khóa tài khoản thay vì xóa để giữ lịch sử.'
      actions={<Button onClick={() => setEdit({ role: 'TN', active: true })}>Tạo tài khoản</Button>}
    >
      <div className='bg-card overflow-x-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Tên đăng nhập</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Tình trạng</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className='font-medium'>{u.name}</TableCell>
                <TableCell className='font-mono text-xs'>{u.username}</TableCell>
                <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                <TableCell>{u.phone}</TableCell>
                <TableCell>{u.active ? <Pill tone='done'>Đang hoạt động</Pill> : <Pill>Đã khóa</Pill>}</TableCell>
                <TableCell className='space-x-2 text-right whitespace-nowrap'>
                  <Button size='sm' variant='outline' onClick={() => setEdit(u)}>
                    Sửa
                  </Button>
                  <Button size='sm' variant='ghost' disabled={reset.isPending} onClick={() => confirm(`Đặt lại mật khẩu cho ${u.name}?`) && reset.mutate([me, u.id])}>
                    Đặt lại mật khẩu
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {edit && <EditUser u={edit} onClose={() => setEdit(null)} />}
    </PageShell>
  )
}

function EditUser({ u, onClose }: { u: Partial<User>; onClose: () => void }) {
  const me = useMe()
  const [name, setName] = useState(u.name ?? '')
  const [username, setUsername] = useState(u.username ?? '')
  const [role, setRole] = useState<Role>(u.role ?? 'TN')
  const [phone, setPhone] = useState(u.phone ?? '')
  const [active, setActive] = useState(u.active ?? true)
  const [tried, setTried] = useState(false)
  const m = useAction(api.saveUser, { success: 'Đã lưu tài khoản', onDone: onClose })
  const errs = { name: !name.trim() && 'Nhập họ tên.', username: !/^[a-z0-9.]{3,}$/.test(username) && 'Tối thiểu 3 ký tự: chữ thường, số, dấu chấm.' }
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={u.id ? `Sửa tài khoản ${u.username}` : 'Tạo tài khoản'}
      description={u.id ? 'Đổi vai trò có hiệu lực từ lần đăng nhập sau.' : 'Tài khoản mới dùng mật khẩu mặc định, nhân viên đổi sau khi đăng nhập.'}
      onSubmit={() => {
        setTried(true)
        if (errs.name || errs.username) return
        m.mutate([me, { id: u.id, name, username, role, phone, active }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Lưu</SubmitButton>
        </>
      }
    >
      <Field label='Họ tên' required error={tried && errs.name}>
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label='Tên đăng nhập' required error={tried && errs.username}>
        {(id) => <Input id={id} value={username} disabled={!!u.id} onChange={(e) => setUsername(e.target.value.toLowerCase())} />}
      </Field>
      <Field label='Vai trò'>
        {(id) => (
          <NativeSelect id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label='Điện thoại'>{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      <label className='flex items-center gap-2 text-sm'>
        <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} /> Đang hoạt động
      </label>
    </FormDialog>
  )
}
