import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createExercise,
  createSession,
  createSet,
  createTip,
  deleteSet,
  fetchCategories,
  fetchSessions,
  searchExercise,
  updateSet,
} from '../api/workouts'
import useDebounce from '../hooks/useDebounce'

const todayISO = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Record() {
  const [categories, setCategories] = useState([])
  const [filterCategory, setFilterCategory] = useState(null)
  const [session, setSession] = useState(null)
  const [exercise, setExercise] = useState(null)
  const [savedSets, setSavedSets] = useState([])
  const [error, setError] = useState(null)
  const date = todayISO()

  useEffect(() => {
    fetchCategories().then(setCategories).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    fetchSessions({ date })
      .then((sessions) => {
        if (sessions.length > 0) {
          const existing = sessions[0]
          setSession(existing)
          setSavedSets(existing.sets || [])
        }
      })
      .catch((e) => setError(String(e)))
  }, [date])

  const ensureSession = async () => {
    if (session) return session
    const s = await createSession({ date })
    setSession(s)
    return s
  }

  const setsOfCurrentExercise = useMemo(
    () => savedSets.filter((s) => s.exercise === exercise?.id),
    [savedSets, exercise],
  )

  const handleAddSet = async ({ weight, reps, set_type = 'normal' }) => {
    const s = await ensureSession()
    const newSet = await createSet(s.id, {
      exercise: exercise.id,
      set_number: setsOfCurrentExercise.length + 1,
      weight,
      reps,
      set_type,
    })
    setSavedSets((prev) => [...prev, newSet])
  }

  const handleUpdateSet = async (id, { weight, reps }) => {
    const updated = await updateSet(id, { weight, reps })
    setSavedSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, weight: updated.weight, reps: updated.reps } : s)),
    )
  }

  const handleDeleteSet = async (id) => {
    await deleteSet(id)
    setSavedSets((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <section>
      <h1 className="text-2xl font-bold mb-1">운동 기록</h1>
      <p className="text-sm text-slate-500 mb-4">오늘 날짜: {date}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      <CategoryFilter
        categories={categories}
        selected={filterCategory}
        onSelect={(c) => {
          setFilterCategory(c)
          setExercise(null)
        }}
      />

      {filterCategory && !exercise && (
        <ExercisePicker
          category={filterCategory}
          onPick={setExercise}
          onError={setError}
        />
      )}

      {exercise && (
        <ExerciseSetPanel
          exercise={exercise}
          sets={setsOfCurrentExercise}
          onAddSet={handleAddSet}
          onUpdateSet={handleUpdateSet}
          onDeleteSet={handleDeleteSet}
          onAddTip={async (content) => {
            const s = await ensureSession()
            await createTip(s.id, { exercise: exercise.id, content })
          }}
          onDone={() => setExercise(null)}
          onError={setError}
        />
      )}

      {savedSets.length > 0 && (
        <SessionSummary
          sets={savedSets}
          onUpdateSet={handleUpdateSet}
          onDeleteSet={handleDeleteSet}
          onError={setError}
        />
      )}
    </section>
  )
}

function CategoryFilter({ categories, selected, onSelect }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-slate-600 mb-2">
        카테고리 <span className="text-xs font-normal text-slate-400">(운동 검색 필터)</span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const active = selected?.id === c.id
          return (
            <button
              key={c.id}
              onClick={() => onSelect(active ? null : c)}
              className={`px-4 py-2 rounded-full text-sm border transition ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
              }`}
            >
              {c.name}
            </button>
          )
        })}
      </div>
      {selected && (
        <p className="mt-2 text-xs text-slate-400">
          {selected.name} 운동을 검색합니다. 다른 카테고리 운동도 같은 날 기록에 추가할 수 있어요.
        </p>
      )}
    </div>
  )
}

function ExercisePicker({ category, onPick, onError }) {
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 300)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!debounced.trim()) { setResult(null); return }
    setLoading(true)
    searchExercise({ category: category.id, query: debounced })
      .then(setResult)
      .catch((e) => onError(String(e)))
      .finally(() => setLoading(false))
  }, [debounced, category.id, onError])

  const handleRegisterNew = async () => {
    try {
      const ex = await createExercise({ category: category.id, canonical_name: query.trim() })
      onPick({ ...ex, aliases: [ex.canonical_name] })
    } catch (e) {
      onError(String(e))
    }
  }

  return (
    <div className="mb-6 bg-white rounded-lg border p-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-2">
        운동 검색 <span className="text-xs font-normal text-slate-400">({category.name})</span>
      </h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="예: 인클라인 프레스"
        className="w-full px-3 py-2 border rounded outline-none focus:border-blue-400"
      />
      {loading && <p className="mt-3 text-sm text-slate-400">검색 중…</p>}
      {result && !loading && result.matched && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-slate-700">
            이 운동 맞나요?{' '}
            <span className="font-semibold">{result.matched.canonical_name}</span>{' '}
            <span className="text-xs text-slate-500">(일치도 {Math.round(result.score)})</span>
          </p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onPick(result.matched)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded">예, 맞아요</button>
            <button onClick={handleRegisterNew} className="px-3 py-1 text-sm bg-white border border-slate-300 rounded">아니요, "{query.trim()}"로 새로 등록</button>
          </div>
        </div>
      )}
      {result && !loading && result.is_new && query.trim() && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
          <p className="text-sm text-slate-700">"<span className="font-semibold">{query.trim()}</span>" 는 처음 보는 운동이에요.</p>
          <button onClick={handleRegisterNew} className="mt-2 px-3 py-1 text-sm bg-amber-600 text-white rounded">새 운동으로 등록</button>
        </div>
      )}
    </div>
  )
}

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
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>
      {meta.label}
    </span>
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
            <button
              key={t.value}
              type="button"
              onClick={() => setSetType(t.value)}
              className={`px-2 py-0.5 rounded-full text-xs border transition ${
                setType === t.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
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

const SET_TYPES = [
  { value: 'normal', label: '일반' },
  { value: 'dropset', label: '드랍세트' },
  { value: 'superset', label: '슈퍼세트' },
  { value: 'compound', label: '컴파운드세트' },
]

function ExerciseSetPanel({ exercise, sets, onAddSet, onUpdateSet, onDeleteSet, onAddTip, onDone, onError }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [setType, setSetType] = useState('normal')
  const [saving, setSaving] = useState(false)
  const [tipContent, setTipContent] = useState('')
  const [tipSaving, setTipSaving] = useState(false)
  const [tipSaved, setTipSaved] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const w = parseFloat(weight)
    const r = parseInt(reps, 10)
    if (Number.isNaN(w) || Number.isNaN(r) || r <= 0) { onError('중량과 횟수를 올바르게 입력해주세요.'); return }
    setSaving(true)
    try { await onAddSet({ weight: w, reps: r, set_type: setType }); setWeight(''); setReps('') }
    catch (err) { onError(String(err)) }
    finally { setSaving(false) }
  }

  return (
    <div className="mb-6 bg-white rounded-lg border p-4">
      <div className="flex items-baseline justify-between mb-3">
        <Link to={`/exercise/${exercise.id}`} className="text-base font-semibold hover:text-blue-600">
          {exercise.canonical_name}
        </Link>
        <button onClick={onDone} className="text-xs text-slate-500 py-2 px-1">다른 운동 →</button>
      </div>

      {sets.length > 0 && (
        <ul className="mb-3 divide-y">
          {sets.map((s) => (
            <SetRow key={s.id} set={s} onUpdate={onUpdateSet} onDelete={onDeleteSet} onError={onError} />
          ))}
        </ul>
      )}

      <div className="mb-3 flex gap-1 flex-wrap">
        {SET_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSetType(t.value)}
            className={`px-2.5 py-1 rounded-full text-xs border transition ${
              setType === t.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">중량 (kg)</label>
          <input type="number" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)}
            className="w-full px-2 py-2 border rounded text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">횟수</label>
          <input type="number" value={reps} onChange={(e) => setReps(e.target.value)}
            className="w-full px-2 py-2 border rounded text-sm" />
        </div>
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded disabled:bg-slate-300">
          {sets.length + 1}세트 추가
        </button>
      </form>

      <div className="mt-4 pt-3 border-t">
        <label className="block text-xs text-slate-500 mb-1">팁 메모</label>
        <textarea
          value={tipContent}
          onChange={(e) => { setTipContent(e.target.value); setTipSaved(false) }}
          rows={2}
          className="w-full px-2 py-1.5 border rounded text-sm"
          placeholder="오늘 잘 된 포인트나 다음번에 신경 쓸 것"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            disabled={tipSaving || !tipContent.trim()}
            onClick={async () => {
              setTipSaving(true)
              try { await onAddTip(tipContent.trim()); setTipContent(''); setTipSaved(true) }
              catch (err) { onError(String(err)) }
              finally { setTipSaving(false) }
            }}
            className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded disabled:bg-slate-300"
          >팁 저장</button>
          {tipSaved && <span className="text-xs text-green-600">저장됨</span>}
        </div>
      </div>
    </div>
  )
}

function SessionSummary({ sets, onUpdateSet, onDeleteSet, onError }) {
  const byExercise = sets.reduce((acc, s) => {
    const key = s.exercise_name
    acc[key] = acc[key] || []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className="mt-6 bg-slate-100 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-3">
        오늘 누적 기록 ({sets.length}세트)
      </h2>
      <ul className="text-sm space-y-3">
        {Object.entries(byExercise).map(([name, ss]) => (
          <li key={name}>
            <div className="font-medium text-slate-800 mb-1">{name}</div>
            <ul className="divide-y bg-white rounded border">
              {ss
                .sort((a, b) => a.set_number - b.set_number)
                .map((s) => (
                  <SetRow key={s.id} set={s} onUpdate={onUpdateSet} onDelete={onDeleteSet} onError={onError} />
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
