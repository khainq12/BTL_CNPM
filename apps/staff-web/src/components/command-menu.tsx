import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, FileText, Laptop, Moon, Sun } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import { useDb, useMe } from '@/api/hooks'
import { canSee } from '@/domain/roles'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { NAV } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

// Ctrl+K: chuyển trang và mở nhanh phiếu theo mã phiếu, SĐT hoặc tên khách (không tìm bằng serial).
export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const me = useMe()
  const db = useDb()
  const run = React.useCallback(
    (fn: () => unknown) => {
      setOpen(false)
      fn()
    },
    [setOpen]
  )
  const cases = canSee(me.role, 'cases') ? db.cases.slice(0, 60) : []

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Gõ tên trang, mã phiếu, SĐT hoặc tên khách...' />
      <CommandList>
        <ScrollArea type='hover' className='h-80 pe-1'>
          <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>
          {NAV.map((g) => {
            const items = g.items.filter((i) => canSee(me.role, i.page))
            if (!items.length) return null
            return (
              <CommandGroup key={g.title} heading={g.title}>
                {items.map((i) => (
                  <CommandItem key={i.url} value={i.title} onSelect={() => run(() => navigate({ to: i.url }))}>
                    <ArrowRight className='text-muted-foreground/80 size-3' />
                    {i.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )
          })}
          {cases.length > 0 && (
            <CommandGroup heading='Phiếu'>
              {cases.map((c) => {
                const cu = db.customers.find((x) => x.id === c.customerId)
                return (
                  <CommandItem key={c.id} value={`${c.code} ${cu?.phone} ${cu?.name}`} onSelect={() => run(() => navigate({ to: '/phieu/$id', params: { id: c.id } }))}>
                    <FileText className='text-muted-foreground size-3.5' />
                    <span className='font-medium'>{c.code}</span>
                    <span className='text-muted-foreground truncate'>{cu?.name}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading='Giao diện'>
            <CommandItem onSelect={() => run(() => setTheme('light'))}>
              <Sun /> <span>Sáng</span>
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Tối</span>
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme('system'))}>
              <Laptop />
              <span>Theo hệ thống</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
