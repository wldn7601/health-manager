import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteSet, fetchSessions, updateSet } from '../api/workouts'

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

function groupByExercise(sets) {
  const map = {}
  for (const set of sets) {
    if (!map[set.exercise_name]) map[set.exercise_name] = []
    map[set.exercise_name].push(set)
  }
  return Object.entries(map)
}

function DropRow({ set, index, onUpdate, onDelete, onError }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(Number(set.weight)))
  const [reps, setReps] = useState(String(set.reps))
  const [saving, setSaving] = useState(false)

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        {index > 0 && <span className="text-slate-400 text-xs">↓</span>}
        <input type="number" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)}
          className="w-20 px-2 py-1 border rounded text-sm" />
        <span className="text-slate-400 text-xs">kg</span>
        <input type="number" value={reps} onChange={(e) => setReps(e.target.value)}
          className="w-14 px-2 py-1 border rounded text-sm" />
        <span className="text-slate-400 text-xs">회</span>
        <button disabled={saving}
          onClick={async () => {
            const w = parseFloat(weight), r = parseInt(reps, 10)
            if (Number.isNaN(w) || Number.isNaN(r) || r <= 0) { onError('올바른 값을 입력해주세요.'); return }
            setSaving(true)
            try { await onUpdate(set.id, { weight: w, reps: r, set_type: set.set_type }); setEditing(false) }
            catch (e) { onError(String(e)) }
            finally { setSaving(false) }
          }}
          className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:bg-slate-300">저장</button>
        <button onClick={() => setEditing(false)} className="text-xs border px-2 py-1 rounded text-slate-600">취소</button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">
        {index > 0 && <span className="text-slate-400 mr-1 text-xs">↓</span>}
        {Number(set.weight)}kg × {set.reps}회
      </span>
      <div className="flex gap-1">
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50">수정</button>
        <button onClick={() => onDelete(set.id)} className="text-xs text-red-500 px-2 py-0.5 rounded hover:bg-red-50">삭제</button>
      </div>
    </div>
  )
}

function DropsetGroupRow({ sets, onUpdate, onDelete, onError }) {
  const meta = SET_TYPE_LABELS[sets[0].set_type]
  return (
    <li className="py-1.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-sm text-slate-500">세트 {sets[0].set_number}</span>
        {meta && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{meta.label}</span>}
      </div>
      <div className="space-y-1">
        {sets.map((s, i) => (
          <DropRow key={s.id} set={s} index={i} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
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
    <ul className="divide-y divide-slate-100">
      {ungrouped.sort((a, b) => a.set_number - b.set_number).map((set) => (
        <SetRow key={set.id} set={set} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
      ))}
      {sortedGroupKeys.map((gid) => {
        const groupSets = [...groupedMap[gid]].sort((a, b) => a.set_number - b.set_number)
        return <DropsetGroupRow key={gid} sets={groupSets} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
      })}
    </ul>
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
              const w = parseFloat(weight)
              const r = parseInt(reps, 10)
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
    <li className="py-1.5 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-slate-700">세트 {set.set_number} — {Number(set.weight)}kg × {set.reps}회</span>
        <SetTypeBadge type={set.set_type} />
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 px-2 py-1 rounded hover:bg-blue-50">수정</button>
        <button onClick={() => onDelete(set.id)} className="text-xs text-red-500 px-2 py-1 rounded hover:bg-red-50">삭제</button>
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

  const handleUpdateSet = async (id, { weight, reps, set_type }) => {
    const updated = await updateSet(id, { weight, reps, set_type })
    setSession((prev) => ({
      ...prev,
      sets: prev.sets.map((s) => (s.id === id ? { ...s, ...updated } : s)),
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
                <ExerciseSetList
                  sets={sets}
                  onUpdate={handleUpdateSet}
                  onDelete={handleDeleteSet}
                  onError={setError}
                />
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
