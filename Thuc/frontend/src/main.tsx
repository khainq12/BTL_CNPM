import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import './styles.css'
import { Layout } from './components/Layout'
import type { Role } from './config/roles'
import { useHashPath } from './lib/router'
import { CaseDetail } from './screens/CaseDetail'
import { CaseList } from './screens/CaseList'
import { Inbox } from './screens/Inbox'
import { Login } from './screens/Login'

function App() {
  const path = useHashPath()
  const [role, setRole] = useState<Role>('TN')

  if (path === '/' || path === '/dang-nhap') return <Login />

  let screen
  if (path === '/hop-viec') screen = <Inbox role={role} />
  else if (path === '/case') screen = <CaseList />
  else if (path.startsWith('/case/')) screen = <CaseDetail id={decodeURIComponent(path.slice(6))} role={role} />
  else screen = <div className="panel empty">Màn hình này chưa có wireframe.</div>

  return (
    <Layout role={role} onRoleChange={setRole} path={path}>
      {screen}
    </Layout>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
