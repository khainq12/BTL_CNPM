import { useLayout } from '@/context/layout-provider'
import { useMe } from '@/api/hooks'
import { canSee } from '@/domain/roles'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { BrandMark } from '@/components/brand-mark'
import { APP, NAV } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { useNavCounts } from './nav-counts'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const me = useMe()
  const counts = useNavCounts()
  const groups = NAV.map((g) => ({
    title: g.title,
    items: g.items
      .filter((i) => canSee(me.role, i.page))
      .map((i) => ({ title: i.title, url: i.url, icon: i.icon, badge: i.badgeKey && counts[i.badgeKey] ? String(counts[i.badgeKey]) : undefined })),
  })).filter((g) => g.items.length > 0)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' className='pointer-events-none'>
              <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg'>
                <BrandMark className='size-5' />
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold tracking-wide text-white'>{APP.name}</span>
                <span className='text-sidebar-foreground/80 truncate text-xs'>{APP.subtitle}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <NavGroup key={g.title} {...g} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
