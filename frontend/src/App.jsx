import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Record from './pages/Record'
import History from './pages/History'
import ExerciseDetail from './pages/ExerciseDetail'
import Progress from './pages/Progress'
import Admin from './pages/Admin'
import MyPage from './pages/MyPage'

const isLoggedIn = () => !!localStorage.getItem('access')

const isAdmin = () => {
  const token = localStorage.getItem('access')
  if (!token) return false
  try {
    return !!JSON.parse(atob(token.split('.')[1])).is_staff
  } catch {
    return false
  }
}

function RequireAuth({ children }) {
  if (!isLoggedIn()) return <Navigate to="/" replace />
  return children
}

const TABS = [
  {
    to: '/home',
    label: '홈',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: '/record',
    label: '기록',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  {
    to: '/history',
    label: '히스토리',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: '/progress',
    label: '추이',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
]

function TopNav() {
  return (
    <nav className="hidden md:flex items-center gap-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'text-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`
          }
        >
          <span className="[&_svg]:w-4 [&_svg]:h-4">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex max-w-2xl mx-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`
            }
            style={{ minHeight: '56px' }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function AppShell() {
  const navigate = useNavigate()
  const admin = isAdmin()

  const handleLogout = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    navigate('/login', { replace: true })
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-base font-bold">헬스 매니저</span>
          <div className="flex items-center gap-2">
            {admin ? (
              <NavLink
                to="/admin-panel"
                className={({ isActive }) =>
                  `text-sm py-1.5 px-3 rounded-lg transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                관리
              </NavLink>
            ) : (
              <TopNav />
            )}
            {!admin && (
              <NavLink
                to="/mypage"
                className={({ isActive }) =>
                  `p-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`
                }
                title="마이페이지"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </NavLink>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-slate-700 py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 pb-24 md:pb-8">
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/record" element={<Record />} />
          <Route path="/history" element={<History />} />
          <Route path="/exercise/:id" element={<ExerciseDetail />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/admin-panel" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!admin && <BottomNav />}
    </div>
  )
}

function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-bold mb-2">404</h1>
      <p className="text-slate-500">페이지를 찾을 수 없습니다.</p>
    </section>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={isLoggedIn() ? <Navigate to={isAdmin() ? '/admin-panel' : '/record'} replace /> : <Login />}
        />
        <Route
          path="/login"
          element={isLoggedIn() ? <Navigate to={isAdmin() ? '/admin-panel' : '/record'} replace /> : <Login />}
        />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
