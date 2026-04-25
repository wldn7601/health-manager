import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteSet, fetchSessions, updateSet } from '../api/workouts'

const daysAgoISO = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const RANGES = [
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '최근 90일', days: 90 },
]

export default function History() {
  const [range, setRange] = useState(RANGES[1])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchSessions({ start: daysAgoISO(range.days), end: daysAgoISO(0) })
      .then(setSessions)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [range])

  const handleUpdateSet = async (id, { weight, reps }) => {
    const updated = await updateSet(id, { weight, reps })
    setSessions((prev) =>
      prev.map((sess) => ({
        ...sess,
        sets: sess.sets.map((s) =>
          s.id === id ? { ...s, weight: updated.weight, reps: updated.reps } : s,
        ),
      })),
    )
  }

  const handleDeleteSet = async (id) => {
    await deleteSet(id)
    setSessions((prev) =>
      prev.map((sess) => ({
        ...sess,
        sets: sess.sets.filter((s) => s.id !== id),
      })),
    )
  }

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">히스토리</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setRange(r)}
            className={`px-3 py-2 rounded-full text-sm border ${
              range.days === r.days
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      {loading && <p className="text-slate-400 text-sm">불러오는 중…</p>}
      {!loading && sorted.length === 0 && (
        <p className="text-slate-400 text-sm">기록이 없습니다.</p>
      )}

      <div className="space-y-4">
        {sorted.map((session) => (
          <div key={session.id} className="bg-white rounded-lg border p-4">
            <h2 className="font-semibold mb-3">{session.date}</h2>
            <SessionCard
              session={session}
              onUpdateSet={handleUpdateSet}
              onDeleteSet={handleDeleteSet}
              onError={setError}
            />
          </div>
        ))}
      </div>
    </section>
  )
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
          <input type="number" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)}
            className="w-20 px-2 py-1.5 border rounded text-sm" />
          <span className="text-xs text-slate-400">kg</span>
          <input type="number" value={reps} onChange={(e) => setReps(e.target.value)}
            className="w-16 px-2 py-1.5 border rounded text-sm" />
          <span className="text-xs text-slate-400">회</span>
          <button
            disabled={saving}
            onClick={async () => {
              const w = parseFloat(weight), r = parseInt(reps, 10)
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
    <li className="py-2 flex items-center justify-between">
      <span className="text-slate-500 text-sm">세트 {set.set_number}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm">{Number(set.weight)}kg × {set.reps}회</span>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-500 py-1 px-2">수정</button>
        <button
          onClick={async () => {
            try { await onDelete(set.id) }
            catch (e) { onError(String(e)) }
          }}
          className="text-xs text-red-400 py-1 px-2"
        >삭제</button>
      </div>
    </li>
  )
}

function SessionCard({ session, onUpdateSet, onDeleteSet, onError }) {
  const byExercise = session.sets.reduce((acc, st) => {
    const key = st.exercise
    acc[key] = acc[key] || { id: st.exercise, name: st.exercise_name, sets: [] }
    acc[key].sets.push(st)
    return acc
  }, {})

  const exercises = Object.values(byExercise).map((ex) => ({
    ...ex,
    sets: ex.sets.sort((a, b) => a.set_number - b.set_number),
  }))

  if (exercises.length === 0) {
    return <p className="text-xs text-slate-400">세트 없음</p>
  }

  return (
    <ul className="space-y-3 text-sm">
      {exercises.map((ex) => (
        <li key={ex.id}>
          <Link to={`/exercise/${ex.id}`} className="text-blue-600 font-medium block mb-1">
            {ex.name}
          </Link>
          <ul className="divide-y border rounded bg-slate-50">
            {ex.sets.map((s) => (
              <SetRow key={s.id} set={s} onUpdate={onUpdateSet} onDelete={onDeleteSet} onError={onError} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
