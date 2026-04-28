import { useEffect, useState } from 'react'
import { actionExerciseRequest, createAdminExercise, fetchAdminExerciseRequests, fetchAdminExercises, fetchAdminStats, fetchAdminUsers, updateAdminExercise } from '../api/admin'
import { fetchCategories } from '../api/workouts'

const TABS = ['개요', '사용자', '운동', '요청']

export default function Admin() {
  const [tab, setTab] = useState('개요')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState(null)
  const [exercises, setExercises] = useState(null)
  const [categories, setCategories] = useState([])
  const [requests, setRequests] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === '개요' && !stats) load(fetchAdminStats, setStats)
    if (tab === '사용자' && !users) load(fetchAdminUsers, setUsers)
    if (tab === '운동' && !exercises) load(fetchAdminExercises, setExercises)
    if (tab === '요청') load(() => fetchAdminExerciseRequests('pending'), setRequests)
  }, [tab])

  const load = (fetcher, setter) => {
    setLoading(true)
    setError(null)
    fetcher()
      .then(setter)
      .catch((e) => {
        if (e.response?.status === 403) setError('관리자 권한이 필요합니다.')
        else setError(String(e))
      })
      .finally(() => setLoading(false))
  }

  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">관리자 대시보드</h1>

      <div className="flex gap-1 mb-5 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      {loading && <p className="text-slate-400 text-sm">불러오는 중…</p>}

      {!loading && !error && tab === '개요' && stats && <StatsTab stats={stats} />}
      {!loading && !error && tab === '사용자' && users && <UsersTab users={users} />}
      {!loading && !error && tab === '운동' && exercises && <ExercisesTab exercises={exercises} setExercises={setExercises} categories={categories} />}
      {!loading && !error && tab === '요청' && requests && <RequestsTab requests={requests} setRequests={setRequests} />}
    </section>
  )
}

function StatCard({ label, value, sub, color = 'text-slate-800' }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatsTab({ stats }) {
  const { users, sessions, sets, exercises, tips, top_exercises, recent_sessions } = stats

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">사용자</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="전체 사용자" value={users.total} />
          <StatCard label="7일 활성" value={users.active_7d} color="text-blue-600" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">운동 기록</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="총 세션" value={sessions.total} sub={`7일 +${sessions.last_7d} / 30일 +${sessions.last_30d}`} />
          <StatCard label="총 세트" value={sets.total.toLocaleString()} />
          <StatCard label="총 볼륨" value={`${Math.round(sets.total_volume / 1000)}t`} sub={`${sets.total_volume.toLocaleString()}kg`} />
          <StatCard label="운동 팁" value={tips.total} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">운동 종목 DB</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="등록 운동" value={exercises.total} />
          <StatCard label="총 별칭" value={exercises.aliases} />
        </div>
      </div>

      {top_exercises.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-3">인기 운동 TOP {top_exercises.length}</h2>
          <div className="bg-white rounded-xl border divide-y">
            {top_exercises.map((ex, i) => (
              <div key={ex.canonical_name} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-5">{i + 1}</span>
                  <span className="text-sm text-slate-800">{ex.canonical_name}</span>
                </div>
                <span className="text-xs text-slate-500">{ex.usage}회</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent_sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-3">최근 세션</h2>
          <div className="bg-white rounded-xl border divide-y">
            {recent_sessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-slate-800">{s.user__username}</span>
                <span className="text-xs text-slate-400">{s.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UsersTab({ users }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 mb-3">총 {users.length}명</p>
      {users.map((u) => (
        <div key={u.id} className="bg-white rounded-xl border px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm text-slate-800">{u.username}</span>
            <span className="text-xs text-slate-400">가입 {u.date_joined}</span>
          </div>
          {u.email && <p className="text-xs text-slate-400 mb-2">{u.email}</p>}
          <div className="flex gap-4 text-xs text-slate-500">
            <span>세션 <b className="text-slate-700">{u.session_count}</b></span>
            <span>세트 <b className="text-slate-700">{u.set_count}</b></span>
            {u.last_session && <span>마지막 운동 <b className="text-slate-700">{u.last_session}</b></span>}
            {u.last_login && <span>마지막 로그인 <b className="text-slate-700">{u.last_login}</b></span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function ExercisesTab({ exercises: initialExercises, setExercises: setExercisesOuter, categories }) {
  const [exercises, setExercises] = useState(initialExercises)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newBodyweight, setNewBodyweight] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    if (categories.length > 0 && !newCat) setNewCat(String(categories[0].id))
  }, [categories, newCat])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) { setFormError('운동명을 입력해주세요.'); return }
    setSaving(true); setFormError(null)
    try {
      const ex = await createAdminExercise({ category: Number(newCat), canonical_name: newName.trim(), is_bodyweight: newBodyweight })
      const cat = categories.find((c) => c.id === Number(newCat))
      const newEntry = { id: ex.id, canonical_name: ex.canonical_name, category: cat?.name ?? '', aliases: [], usage_count: 0, is_bodyweight: ex.is_bodyweight, created_at: new Date().toISOString().slice(0, 10) }
      setExercises((prev) => [newEntry, ...prev])
      setExercisesOuter((prev) => [newEntry, ...prev])
      setNewName(''); setNewBodyweight(false); setShowForm(false)
    } catch (e) {
      setFormError(e.response?.data?.detail || String(e))
    } finally {
      setSaving(false)
    }
  }
  const filtered = search.trim()
    ? exercises.filter(
        (ex) =>
          ex.canonical_name.includes(search) ||
          ex.aliases.some((a) => a.includes(search)) ||
          ex.category.includes(search),
      )
    : exercises

  const CATEGORY_COLORS = {
    하체: 'bg-blue-100 text-blue-700',
    가슴: 'bg-red-100 text-red-700',
    등: 'bg-green-100 text-green-700',
    팔: 'bg-orange-100 text-orange-700',
    어깨: 'bg-purple-100 text-purple-700',
  }

  const handleToggleBodyweight = async (ex) => {
    const updated = await updateAdminExercise(ex.id, { is_bodyweight: !ex.is_bodyweight })
    setExercises((prev) => prev.map((e) => e.id === ex.id ? { ...e, is_bodyweight: updated.is_bodyweight } : e))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="운동명 / 카테고리 검색"
          className="flex-1 px-3 py-2 border rounded text-sm outline-none focus:border-blue-400"
        />
        <span className="text-xs text-slate-400 shrink-0">{filtered.length}개</span>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
          className="shrink-0 px-3 py-2 text-sm bg-blue-600 text-white rounded"
        >
          {showForm ? '취소' : '+ 추가'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">새 운동 등록</p>
          <div className="flex gap-2">
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="px-2 py-2 border rounded text-sm outline-none focus:border-blue-400"
            >
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="운동명"
              className="flex-1 px-3 py-2 border rounded text-sm outline-none focus:border-blue-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={newBodyweight} onChange={(e) => setNewBodyweight(e.target.checked)} />
            맨몸 운동
          </label>
          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:bg-slate-300">
            등록
          </button>
        </form>
      )}

      {filtered.map((ex) => (
        <div key={ex.id} className="bg-white rounded-xl border px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-800">{ex.canonical_name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[ex.category] || 'bg-slate-100 text-slate-600'}`}>
                {ex.category}
              </span>
              {ex.is_bodyweight && (
                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-teal-100 text-teal-700">맨몸</span>
              )}
            </div>
            <span className="text-xs text-slate-400 shrink-0">사용 {ex.usage_count}회</span>
          </div>
          {ex.aliases.length > 0 && (
            <p className="text-xs text-slate-400">별칭: {ex.aliases.join(', ')}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-300">등록 {ex.created_at}</p>
            <button
              onClick={() => handleToggleBodyweight(ex)}
              className={`text-xs px-2.5 py-1 rounded border transition ${
                ex.is_bodyweight
                  ? 'border-teal-400 text-teal-600 bg-teal-50'
                  : 'border-slate-300 text-slate-500'
              }`}
            >
              {ex.is_bodyweight ? '맨몸 ✓' : '맨몸 설정'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function RequestsTab({ requests, setRequests }) {
  const [acting, setActing] = useState(null)

  const handleAction = async (req, action) => {
    setActing(req.id)
    try {
      await actionExerciseRequest(req.id, action)
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
    } finally {
      setActing(null)
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-slate-400">대기 중인 요청이 없습니다.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">{requests.length}건 대기 중</p>
      {requests.map((req) => (
        <div key={req.id} className="bg-white rounded-xl border px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="font-semibold text-sm text-slate-800">{req.canonical_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">{req.category}</span>
                {req.is_bodyweight && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">맨몸</span>
                )}
                <span className="text-xs text-slate-400">요청자: {req.user}</span>
              </div>
            </div>
            <span className="text-xs text-slate-300 shrink-0">{req.created_at}</span>
          </div>
          <div className="flex gap-2">
            <button
              disabled={acting === req.id}
              onClick={() => handleAction(req, 'approve')}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:bg-slate-300"
            >
              승인
            </button>
            <button
              disabled={acting === req.id}
              onClick={() => handleAction(req, 'reject')}
              className="px-3 py-1.5 text-xs bg-white border border-red-300 text-red-500 rounded disabled:bg-slate-100"
            >
              거절
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
