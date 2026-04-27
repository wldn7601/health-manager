import { useEffect, useState } from 'react'
import { fetchAdminExercises, fetchAdminStats, fetchAdminUsers } from '../api/admin'

const TABS = ['개요', '사용자', '운동']

export default function Admin() {
  const [tab, setTab] = useState('개요')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState(null)
  const [exercises, setExercises] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (tab === '개요' && !stats) load(fetchAdminStats, setStats)
    if (tab === '사용자' && !users) load(fetchAdminUsers, setUsers)
    if (tab === '운동' && !exercises) load(fetchAdminExercises, setExercises)
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
      {!loading && !error && tab === '운동' && exercises && <ExercisesTab exercises={exercises} />}
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

function ExercisesTab({ exercises }) {
  const [search, setSearch] = useState('')
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
      </div>

      {filtered.map((ex) => (
        <div key={ex.id} className="bg-white rounded-xl border px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-800">{ex.canonical_name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[ex.category] || 'bg-slate-100 text-slate-600'}`}>
                {ex.category}
              </span>
            </div>
            <span className="text-xs text-slate-400 shrink-0">사용 {ex.usage_count}회</span>
          </div>
          {ex.aliases.length > 0 && (
            <p className="text-xs text-slate-400">별칭: {ex.aliases.join(', ')}</p>
          )}
          <p className="text-xs text-slate-300 mt-1">등록 {ex.created_at}</p>
        </div>
      ))}
    </div>
  )
}
