import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Login() {
  const [tab, setTab] = useState('login')

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2">헬스 매니저</h1>
        <p className="text-center text-slate-500 text-sm mb-8">운동 기록 & 성장 추이 분석</p>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-3 text-sm font-medium ${
                tab === 'login'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-3 text-sm font-medium ${
                tab === 'register'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500'
              }`}
            >
              회원가입
            </button>
          </div>

          <div className="p-6">
            {tab === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
        </div>
      </div>
    </div>
  )
}

const redirectAfterLogin = (token, navigate) => {
  try {
    const { is_staff } = JSON.parse(atob(token.split('.')[1]))
    navigate(is_staff ? '/admin-panel' : '/record', { replace: true })
  } catch {
    navigate('/record', { replace: true })
  }
}

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/token/', { username, password })
      localStorage.setItem('access', data.access)
      localStorage.setItem('refresh', data.refresh)
      redirectAfterLogin(data.access, navigate)
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</p>
      )}
      <div>
        <label className="block text-sm text-slate-600 mb-1">아이디</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded outline-none focus:border-blue-400"
        />
      </div>
      <div>
        <label className="block text-sm text-slate-600 mb-1">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded outline-none focus:border-blue-400"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
      >
        {loading ? '로그인 중…' : '로그인'}
      </button>
    </form>
  )
}

function RegisterForm() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft])

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const handleSendCode = async (e) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    setSending(true)
    try {
      await axios.post('/api/auth/register/send-code/', { username, email })
      setCodeSent(true)
      setSecondsLeft(180)
      setCode('')
    } catch (err) {
      setError(err.response?.data?.error ?? '코드 발송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/register/', { username, password, email, code })
      localStorage.setItem('access', data.access)
      localStorage.setItem('refresh', data.refresh)
      navigate('/record', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error ?? '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</p>
      )}

      {!codeSent ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded outline-none focus:border-blue-400"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
          >
            {sending ? '발송 중…' : '인증 코드 발송'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{email}</span>로 인증 코드를 발송했습니다.
          </p>
          <p className="text-xs text-slate-400">메일이 보이지 않으면 스팸함을 확인해주세요.</p>
          <div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6자리 코드"
                maxLength={6}
                className="flex-1 px-3 py-2 border rounded outline-none focus:border-blue-400 tracking-widest"
              />
              <span className={`text-xs font-medium shrink-0 w-10 text-right ${secondsLeft <= 30 ? 'text-red-500' : 'text-slate-400'}`}>
                {secondsLeft > 0 ? fmt(secondsLeft) : '만료'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || code.length !== 6 || secondsLeft === 0}
              className="flex-1 py-2 bg-blue-600 text-white rounded disabled:bg-slate-300"
            >
              {loading ? '가입 중…' : '가입 완료'}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={handleSendCode}
              className="px-4 py-2 border rounded text-slate-600 text-sm disabled:opacity-50"
            >
              {sending ? '발송 중…' : '재발송'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setCodeSent(false); setError(null) }}
            className="text-xs text-slate-400 hover:underline"
          >
            뒤로
          </button>
        </form>
      )}
    </div>
  )
}
