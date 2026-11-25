import { useState } from 'react'
import { useAction, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { ROLE_LABEL } from '@/domain/roles'
import { PasswordInput } from '@/components/password-input'
import { Field, SubmitButton } from '@/components/form-kit'
import { InfoList, PageShell, Section } from '@/components/woms'

export function Profile() {
  const me = useMe()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [tried, setTried] = useState(false)
  const m = useAction(api.changePassword, { success: 'Đã đổi mật khẩu', onDone: () => (setCur(''), setNext(''), setAgain(''), setTried(false)) })
  const errs = {
    cur: !cur && 'Nhập mật khẩu hiện tại.',
    next: (next.length < 8 || !/\d/.test(next) || !/[a-zA-Z]/.test(next)) && 'Tối thiểu 8 ký tự, có cả chữ và số.',
    again: next !== again && 'Mật khẩu nhập lại không khớp.',
  }
  return (
    <PageShell title='Tài khoản của tôi'>
      <div className='grid max-w-3xl gap-6'>
        <Section title='Thông tin'>
          <InfoList rows={[['Họ tên', me.name], ['Tên đăng nhập', me.username], ['Vai trò', ROLE_LABEL[me.role]], ['Điện thoại', me.phone]]} />
          <p className='text-muted-foreground mt-3 text-sm'>Muốn đổi vai trò hoặc thông tin, liên hệ quản lý.</p>
        </Section>
        <Section title='Đổi mật khẩu'>
          <form
            noValidate
            className='grid max-w-sm gap-4'
            onSubmit={(e) => {
              e.preventDefault()
              setTried(true)
              if (!Object.values(errs).some(Boolean)) m.mutate([me, cur, next])
            }}
          >
            <Field label='Mật khẩu hiện tại' required error={tried && errs.cur}>
              {(id) => <PasswordInput id={id} autoComplete='current-password' value={cur} onChange={(e) => setCur(e.target.value)} />}
            </Field>
            <Field label='Mật khẩu mới' required error={tried && errs.next} hint='Tối thiểu 8 ký tự, có cả chữ và số.'>
              {(id) => <PasswordInput id={id} autoComplete='new-password' value={next} onChange={(e) => setNext(e.target.value)} />}
            </Field>
            <Field label='Nhập lại mật khẩu mới' required error={tried && errs.again}>
              {(id) => <PasswordInput id={id} autoComplete='new-password' value={again} onChange={(e) => setAgain(e.target.value)} />}
            </Field>
            <SubmitButton type='submit' pending={m.isPending} className='justify-self-start'>
              Đổi mật khẩu
            </SubmitButton>
          </form>
        </Section>
      </div>
    </PageShell>
  )
}
