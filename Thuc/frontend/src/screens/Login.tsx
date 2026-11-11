import { Note } from '../components/bits'
import { go } from '../lib/router'

// S-01 Đăng nhập. Prototype không xác thực thật.
export function Login() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form
        className="panel stack"
        style={{ width: '100%', maxWidth: 380, padding: 24 }}
        onSubmit={(e) => {
          e.preventDefault()
          go('/hop-viec')
        }}
      >
        <div>
          <h1>Đăng nhập WOMS</h1>
          <p className="muted">Dành cho nhân viên trung tâm bảo hành</p>
        </div>
        <div className="field">
          <label htmlFor="u">Tên đăng nhập</label>
          <input id="u" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="p">Mật khẩu</label>
          <input id="p" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn primary" type="submit">
          Đăng nhập
        </button>
        <Note who="TV2">nếu một người kiêm nhiều vai trò: cho chọn vai trò sau khi đăng nhập, hay gộp quyền vào một menu.</Note>
      </form>
    </div>
  )
}
