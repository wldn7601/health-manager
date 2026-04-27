import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

export default function MyPage() {
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/auth/me/').then((r) => setMe(r.data)).catch((e) => setError(String(e)))
  }, [])

  if (error) return (
    <section>
      <h1 className="text-2xl font-bold mb-4">마이페이지</h1>
      <p className="text-red-500 text-sm">{error}</p>
    </section>
  )
  if (!me) return (
    <section>
      <h1 className="text-2xl font-bold mb-4">마이페이지</h1>
      <p className="text-slate-400 text-sm">불러오는 중…</p>
    </section>
  )

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">마이페이지</h1>

      <ProfileSection me={me} onUpdate={(updated) => setMe((prev) => ({ ...prev, ...updated }))} />
      <StatsSection me={me} />
      <ChangePasswordSection />
      <DeleteAccountSection />
    </section>
  )
}

function ProfileSection({ me, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft])

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const handleCancel = () => {
    setEditing(false)
    setCodeSent(false)
    setCode('')
    setError(null)
    setEmail('')
    setSecondsLeft(0)
  }

  const handleSendCode = async () => {
    setSending(true)
    setError(null)
    try {
      await client.post('/auth/email/send-code/', { email })
      setCodeSent(true)
      setSecondsLeft(180)
      setCode('')
    } catch (e) {
      setError(e.response?.data?.error ?? '코드 발송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setError(null)
    try {
      const { data } = await client.post('/auth/email/verify/', { email, code })
      onUpdate({ email: data.email })
      setSuccess(true)
      handleCancel()
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e.response?.data?.error ?? '인증에 실패했습니다.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-600">프로필</h2>

      <div>
        <p className="text-xs text-slate-400 mb-0.5">아이디</p>
        <p className="text-sm font-medium text-slate-800">{me.username}</p>
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-0.5">이메일</p>

        {!editing ? (
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-800">{me.email || '—'}</p>
            <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:underline">
              {me.email ? '변경' : '등록'}
            </button>
            {success && <span className="text-xs text-green-600">저장됐습니다.</span>}
          </div>
        ) : !codeSent ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                className="flex-1 px-3 py-1.5 border rounded text-sm outline-none focus:border-blue-400"
              />
              <button
                disabled={sending || !email.trim()}
                onClick={handleSendCode}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:bg-slate-300 whitespace-nowrap"
              >
                {sending ? '발송 중…' : '인증 코드 발송'}
              </button>
            </div>
            <button onClick={handleCancel} className="text-xs text-slate-400 hover:underline">취소</button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{email}</span>으로 코드를 발송했습니다.
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6자리 코드"
                maxLength={6}
                className="flex-1 px-3 py-1.5 border rounded text-sm outline-none focus:border-blue-400 tracking-widest"
              />
              <span className={`text-xs font-medium shrink-0 w-10 text-right ${secondsLeft <= 30 ? 'text-red-500' : 'text-slate-400'}`}>
                {secondsLeft > 0 ? fmt(secondsLeft) : '만료'}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                disabled={verifying || code.length !== 6 || secondsLeft === 0}
                onClick={handleVerify}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:bg-slate-300"
              >
                {verifying ? '확인 중…' : '인증 완료'}
              </button>
              <button
                disabled={sending}
                onClick={handleSendCode}
                className="px-3 py-1.5 text-sm border rounded text-slate-600 disabled:opacity-50"
              >
                {sending ? '발송 중…' : '재발송'}
              </button>
              <button onClick={handleCancel} className="px-3 py-1.5 text-sm border rounded text-slate-400">
                취소
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-0.5">가입일</p>
        <p className="text-sm text-slate-800">{me.date_joined}</p>
      </div>
    </div>
  )
}

function StatsSection({ me }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-3">내 운동 통계</h2>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-slate-400">총 세션</p>
          <p className="text-xl font-bold text-blue-600">{me.session_count}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">총 세트</p>
          <p className="text-xl font-bold text-blue-600">{me.set_count}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">첫 운동</p>
          <p className="text-sm font-semibold text-slate-700">{me.first_session ?? '—'}</p>
        </div>
      </div>
    </div>
  )
}

function ChangePasswordSection() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (next !== confirm) { setError('새 비밀번호가 일치하지 않습니다.'); return }
    setSaving(true)
    try {
      await client.post('/auth/me/password/', { current_password: current, new_password: next })
      setSuccess(true)
      setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => { setSuccess(false); setOpen(false) }, 1500)
    } catch (e) {
      setError(e.response?.data?.error ?? '변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-600">비밀번호 변경</span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 border-t pt-3 space-y-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-green-600">비밀번호가 변경됐습니다.</p>}
          <div>
            <label className="block text-xs text-slate-500 mb-1">현재 비밀번호</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">새 비밀번호</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded text-sm outline-none focus:border-blue-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 bg-blue-600 text-white rounded text-sm disabled:bg-slate-300"
          >
            {saving ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      )}
    </div>
  )
}

function DeleteAccountSection() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const handleDelete = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await client.post('/auth/me/delete/', { password })
      localStorage.removeItem('access')
      localStorage.removeItem('refresh')
      navigate('/login', { replace: true })
    } catch (e) {
      setError(e.response?.data?.error ?? '탈퇴에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-red-500">회원 탈퇴</span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form onSubmit={handleDelete} className="px-4 pb-4 border-t pt-3 space-y-3">
          <p className="text-xs text-slate-500">
            탈퇴하면 모든 운동 기록과 데이터가 <span className="font-semibold text-red-500">영구 삭제</span>됩니다.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div>
            <label className="block text-xs text-slate-500 mb-1">비밀번호 확인</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="비밀번호를 입력해 탈퇴 확인"
              className="w-full px-3 py-2 border border-red-200 rounded text-sm outline-none focus:border-red-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 bg-red-500 text-white rounded text-sm disabled:bg-slate-300"
          >
            {saving ? '처리 중…' : '회원 탈퇴'}
          </button>
        </form>
      )}
    </div>
  )
}
