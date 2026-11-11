import type { ReactNode } from 'react'
import { NAV, ROLES, type Role } from '../config/roles'

interface Props {
  role: Role
  onRoleChange: (r: Role) => void
  path: string
  children: ReactNode
}

export function Layout({ role, onRoleChange, path, children }: Props) {
  const items = NAV.filter((n) => n.roles.includes(role))
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          WOMS
          <small>Không gian nhân viên</small>
        </div>
        <nav className="nav" aria-label="Điều hướng chính">
          {items.map((n) => (
            <a key={n.path} href={`#${n.path}`} aria-current={path.startsWith(n.path) ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="who">
          <label htmlFor="role">Xem với vai trò (chỉ có trong prototype)</label>
          <select id="role" value={role} onChange={(e) => onRoleChange(e.target.value as Role)}>
            {(Object.keys(ROLES) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLES[r]}
              </option>
            ))}
          </select>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
