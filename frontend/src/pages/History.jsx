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

  const handleUpdateSet = async (id, { weight, reps, set_type }) => {
    const updated = await updateSet(id, { weight, reps, set_type })
    setSessions((prev) =>
      prev.map((sess) => ({
        ...sess,
        sets: sess.sets.map((s) => (s.id === id ? { ...s, ...updated } : s)),
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

const SET_TYPES = [
  { value: 'normal', label: '일반' },
  { value: 'dropset', label: '드랍세트' },
  { value: 'superset', label: '슈퍼세트' },
  { value: 'compound', label: '컴파운드세트' },
]

const SET_TYPE_LABELS = {
  normal: null,
  dropset: { label: '드랍', color: 'bg-orange-100 text-orange-600' },
  superset: { label: '슈퍼', color: 'bg-purple-100 text-purple-600' },
  compound: { label: '컴파운드', color: 'bg-green-100 text-green-700' },
}

function SetTypeBadge({ type }) {
  const meta = SET_TYPE_LABELS[type]
  if (!meta) return null
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{meta.label}</span>
  )
}

function SetRow({ set, onUpdate, onDelete, onError }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(Number(set.weight)))
  const [reps, setReps] = useState(String(set.reps))
  const [setType, setSetType] = useState(set.set_type || 'normal')
  const [saving, setSaving] = useState(false)

  if (editing) {
    return (
      <li className="py-2">
        <div className="flex gap-1 flex-wrap mb-2">
          {SET_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setSetType(t.value)}
              className={`px-2 py-0.5 rounded-full text-xs border transition ${
                setType === t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
              }`}
            >{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 text-sm shrink-0">세트 {set.set_number}</span>
          <input type="number" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)}
            className="w-20 px-2 py-1.5 border rounded text-sm" />
          <span className="text-xs text-slate-400">kg</span>
          <input type="number" value={reps} onChange={(e) => setReps(e.target.value)}
            className="w-16 px-2 py-1.5 border rounded text-sm" />
          <span className="text-xs text-slate-400">회</span>
          <button disabled={saving}
            onClick={async () => {
              const w = parseFloat(weight), r = parseInt(reps, 10)
              if (Number.isNaN(w) || Number.isNaN(r) || r <= 0) { onError('올바른 값을 입력해주세요.'); return }
              setSaving(true)
              try { await onUpdate(set.id, { weight: w, reps: r, set_type: setType }); setEditing(false) }
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
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 text-sm">세트 {set.set_number}</span>
        <SetTypeBadge type={set.set_type} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm">{Number(set.weight)}kg × {set.reps}회</span>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-500 py-1 px-2">수정</button>
        <button onClick={async () => { try { await onDelete(set.id) } catch (e) { onError(String(e)) } }}
          className="text-xs text-red-400 py-1 px-2">삭제</button>
      </div>
    </li>
  )
}

function DropsetGroupRow({ sets, onDelete, onError }) {
  const meta = SET_TYPE_LABELS[sets[0].set_type]
  return (
    <li className="py-2 px-1">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-slate-500 text-sm">세트 {sets[0].set_number}</span>
        {meta && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{meta.label}</span>}
      </div>
      <div className="space-y-0.5">
        {sets.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {i > 0 && <span className="text-slate-400 mr-1 text-xs">↓</span>}
              {Number(s.weight)}kg × {s.reps}회
            </span>
            <button
              onClick={async () => { try { await onDelete(s.id) } catch (e) { onError(String(e)) } }}
              className="text-xs text-red-400 py-0.5 px-2"
            >삭제</button>
          </div>
        ))}
      </div>
    </li>
  )
}

function ExerciseSetList({ sets, onUpdate, onDelete, onError }) {
  const ungrouped = sets.filter((s) => s.group_id == null)
  const groupedMap = {}
  sets.filter((s) => s.group_id != null).forEach((s) => {
    groupedMap[s.group_id] = groupedMap[s.group_id] || []
    groupedMap[s.group_id].push(s)
  })
  const sortedGroupKeys = Object.keys(groupedMap).sort((a, b) => {
    const minA = Math.min(...groupedMap[a].map((s) => s.set_number))
    const minB = Math.min(...groupedMap[b].map((s) => s.set_number))
    return minA - minB
  })
  return (
    <ul className="divide-y border rounded bg-slate-50">
      {ungrouped.sort((a, b) => a.set_number - b.set_number).map((s) => (
        <SetRow key={s.id} set={s} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
      ))}
      {sortedGroupKeys.map((gid) => {
        const groupSets = [...groupedMap[gid]].sort((a, b) => a.set_number - b.set_number)
        return <DropsetGroupRow key={gid} sets={groupSets} onDelete={onDelete} onError={onError} />
      })}
    </ul>
  )
}

function SessionCard({ session, onUpdateSet, onDeleteSet, onError }) {
  const byExercise = session.sets.reduce((acc, st) => {
    const key = st.exercise
    acc[key] = acc[key] || { id: st.exercise, name: st.exercise_name, sets: [] }
    acc[key].sets.push(st)
    return acc
  }, {})

  const exercises = Object.values(byExercise)

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
          <ExerciseSetList
            sets={ex.sets}
            onUpdate={onUpdateSet}
            onDelete={onDeleteSet}
            onError={onError}
          />
        </li>
      ))}
    </ul>
  )
}
