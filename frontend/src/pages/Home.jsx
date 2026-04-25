import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteSet, fetchSessions, updateSet } from '../api/workouts'

function groupByExercise(sets) {
  const map = {}
  for (const set of sets) {
    if (!map[set.exercise_name]) map[set.exercise_name] = []
    map[set.exercise_name].push(set)
  }
  return Object.entries(map)
}

function SetRow({ set, onUpdate, onDelete, onError }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(Number(set.weight)))
  const [reps, setReps] = useState(String(set.reps))
  const [saving, setSaving] = useState(false)

  if (editing) {
    return (
      <li className="py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 text-sm shrink-0">세트 {set.set_number}</span>
          <input
            type="number" step="0.5" value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-20 px-2 py-1.5 border rounded text-sm"
          />
          <span className="text-xs text-slate-400">kg</span>
          <input
            type="number" value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-16 px-2 py-1.5 border rounded text-sm"
          />
          <span className="text-xs text-slate-400">회</span>
          <button
            disabled={saving}
            onClick={async () => {
              const w = parseFloat(weight)
              const r = parseInt(reps, 10)
              if (Number.isNaN(w) || Number.isNaN(r) || r <= 0) { onError('올바른 값을 입력해주세요.'); return }
              setSaving(true)
              try { await onUpdate(set.id, { weight: w, reps: r }); setEditing(false) }
              catch (e) { onError(String(e)) }
              finally { setSaving(false) }
            }}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:bg-slate-300"
          >저장</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs border rounded text-slate-600">취소</button>
        </div>
      </li>
    )
  }

  return (
    <li className="py-1.5 flex items-center justify-between">
      <span className="text-sm text-slate-700">
        세트 {set.set_number} — {Number(set.weight)}kg × {set.reps}회
      </span>
      <div className="flex gap-1.5">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 px-2 py-1 rounded hover:bg-blue-50"
        >수정</button>
        <button
          onClick={() => onDelete(set.id)}
          className="text-xs text-red-500 px-2 py-1 rounded hover:bg-red-50"
        >삭제</button>
      </div>
    </li>
  )
}

export default function Home() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const today = new Date().toISOString().split('T')[0]
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  useEffect(() => {
    fetchSessions({ date: today })
      .then((data) => setSession(data.length > 0 ? data[0] : null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [today])

  const handleUpdateSet = async (id, { weight, reps }) => {
    const updated = await updateSet(id, { weight, reps })
    setSession((prev) => ({
      ...prev,
      sets: prev.sets.map((s) =>
        s.id === id ? { ...s, weight: updated.weight, reps: updated.reps } : s,
      ),
    }))
  }

  const handleDeleteSet = async (id) => {
    await deleteSet(id)
    setSession((prev) => ({
      ...prev,
      sets: prev.sets.filter((s) => s.id !== id),
    }))
  }

  const grouped = session ? groupByExercise(session.sets) : []
  const totalSets = session?.sets?.length ?? 0

  if (loading) {
    return (
      <section>
        <div className="mb-6">
          <p className="text-sm text-slate-400">{dateStr}</p>
          <h1 className="text-2xl font-bold mt-0.5">오늘 운동</h1>
        </div>
        <div className="text-slate-400 text-sm text-center py-16">불러오는 중...</div>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm text-slate-400">{dateStr}</p>
        <h1 className="text-2xl font-bold mt-0.5">오늘 운동</h1>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</p>
      )}

      {!session || session.sets.length === 0 ? (
        <div className="bg-white rounded-2xl border p-10 text-center">
          <p className="text-slate-500 mb-5">오늘 운동 기록이 없어요</p>
          <button
            onClick={() => navigate('/record')}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold active:bg-blue-700 transition-colors"
          >
            기록 시작하기
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-2xl border p-4">
              <p className="text-xs text-slate-400 mb-1">운동 종목</p>
              <p className="text-3xl font-bold text-blue-600">{grouped.length}</p>
            </div>
            <div className="bg-white rounded-2xl border p-4">
              <p className="text-xs text-slate-400 mb-1">총 세트</p>
              <p className="text-3xl font-bold text-blue-600">{totalSets}</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {grouped.map(([name, sets]) => (
              <div key={name} className="bg-white rounded-2xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{name}</span>
                  <span className="text-xs text-slate-400">{sets.length}세트</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {sets.map((set) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      onUpdate={handleUpdateSet}
                      onDelete={handleDeleteSet}
                      onError={setError}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/record')}
            className="w-full bg-blue-600 text-white py-3 rounded-2xl font-semibold text-sm active:bg-blue-700 transition-colors"
          >
            + 운동 추가
          </button>
        </>
      )}
    </section>
  )
}
