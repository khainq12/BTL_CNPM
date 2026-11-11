// Router tối giản dựa trên hash, đủ cho prototype. Thay bằng React Router khi dựng app thật.
import { useEffect, useState } from 'react'

export function useHashPath() {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [path, setPath] = useState(read)
  useEffect(() => {
    const onChange = () => setPath(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}

export const go = (path: string) => {
  window.location.hash = path
}
