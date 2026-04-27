import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDropToGroup, createExercise, deleteSet, expandToDropset, expandToPaired, fetchCategories, fetchSessions, searchExercise, updateSet } from '../api/workouts'
import useDebounce from '../hooks/useDebounce'

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
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

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

  const handleExpandToDropset = async (id, drops) => {
    const result = await expandToDropset(id, { drops })
    setSessions((prev) =>
      prev.map((sess) => ({
        ...sess,
        sets: [...sess.sets.filter((s) => s.id !== id), ...result.sets],
      })),
    )
  }

  const handleExpandToPaired = async (id, data) => {
    const result = await expandToPaired(id, data)
    setSessions((prev) =>
      prev.map((sess) => ({
        ...sess,
        sets: [...sess.sets.filter((s) => s.id !== id), ...result.sets],
      })),
    )
  }

  const handleAddToGroup = async (id, { weight, reps }) => {
    const newSet = await addDropToGroup(id, { weight, reps })
    setSessions((prev) =>
      prev.map((sess) => ({
        ...sess,
        sets: sess.sets.some((s) => s.id === id) ? [...sess.sets, newSet] : sess.sets,
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

      <div className="space-y-3">
        {sorted.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            onUpdateSet={handleUpdateSet}
            onDeleteSet={handleDeleteSet}
            onExpandSet={handleExpandToDropset}
            onExpandPairedSet={handleExpandToPaired}
            onAddToGroup={handleAddToGroup}
            categories={categories}
            onError={setError}
          />
        ))}
      </div>
    </section>
  )
}

const CATEGORY_COLORS = {
  '하체': 'bg-blue-100 text-blue-700',
  '가슴': 'bg-red-100 text-red-700',
  '등': 'bg-green-100 text-green-700',
  '팔': 'bg-orange-100 text-orange-700',
  '어깨': 'bg-purple-100 text-purple-700',
}

function CategoryBadge({ name }) {
  const cls = CATEGORY_COLORS[name] || 'bg-slate-100 text-slate-600'
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{name}</span>
}

function SessionRow({ session, onUpdateSet, onDeleteSet, onExpandSet, onExpandPairedSet, onAddToGroup, categories, onError }) {
  const [open, setOpen] = useState(false)

  const usedCategories = [...new Set(session.sets.map((s) => s.category_name).filter(Boolean))]
  const ungroupedCount = session.sets.filter((s) => s.group_id == null).length
  const groupIds = new Set(session.sets.filter((s) => s.group_id != null).map((s) => s.group_id))
  const logicalSetCount = ungroupedCount + groupIds.size

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-50"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800">{session.date}</span>
          <div className="flex gap-1 flex-wrap">
            {usedCategories.map((cat) => <CategoryBadge key={cat} name={cat} />)}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-slate-400">{logicalSetCount}세트</span>
          <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t pt-3">
          <SessionCard
            session={session}
            onUpdateSet={onUpdateSet}
            onDeleteSet={onDeleteSet}
            onExpandSet={onExpandSet}
            onExpandPairedSet={onExpandPairedSet}
            onAddToGroup={onAddToGroup}
            categories={categories}
            onError={onError}
          />
        </div>
      )}
    </div>
  )
}

function MiniExercisePicker({ categories, excludeId, onPick, onError }) {
  const [selectedCat, setSelectedCat] = useState(null)
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 300)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (categories.length > 0 && !selectedCat) setSelectedCat(categories[0])
  }, [categories, selectedCat])

  useEffect(() => {
    if (!debounced.trim() || !selectedCat) { setResult(null); return }
    setLoading(true)
    searchExercise({ category: selectedCat.id, query: debounced })
      .then(setResult).catch((e) => onError(String(e))).finally(() => setLoading(false))
  }, [debounced, selectedCat?.id, onError])

  const handleRegisterNew = async () => {
    try {
      const ex = await createExercise({ category: selectedCat.id, canonical_name: query.trim() })
      onPick({ ...ex, aliases: [ex.canonical_name] })
    } catch (e) { onError(String(e)) }
  }

  return (
    <div className="bg-slate-50 rounded border p-2 space-y-2">
      <div className="flex flex-wrap gap-1">
        {categories.map((c) => (
          <button key={c.id} type="button" onClick={() => { setSelectedCat(c); setResult(null) }}
            className={`px-2 py-0.5 rounded text-xs border transition ${
              selectedCat?.id === c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
            }`}>{c.name}</button>
        ))}
      </div>
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="운동 검색" className="w-full px-2 py-1.5 border rounded text-sm bg-white" />
      {loading && <p className="text-xs text-slate-400">검색 중…</p>}
      {result && !loading && result.matched && result.matched.id !== excludeId && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs text-slate-700"><span className="font-semibold">{result.matched.canonical_name}</span></p>
          <div className="flex gap-1 mt-1">
            <button type="button" onClick={() => onPick(result.matched)}
              className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">선택</button>
            <button type="button" onClick={handleRegisterNew}
              className="px-2 py-0.5 text-xs border rounded text-slate-600">"{query.trim()}"으로 새로 등록</button>
          </div>
        </div>
      )}
      {result && !loading && result.is_new && query.trim() && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded">
          <p className="text-xs text-slate-700">새 운동 "<span className="font-semibold">{query.trim()}</span>"</p>
          <button type="button" onClick={handleRegisterNew}
            className="mt-1 px-2 py-0.5 text-xs bg-amber-600 text-white rounded">새 운동으로 등록</button>
        </div>
      )}
    </div>
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

function SetRow({ set, onUpdate, onDelete, onExpand, onExpandPaired, categories, onError }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(Number(set.weight)))
  const [reps, setReps] = useState(String(set.reps))
  const [setType, setSetType] = useState(set.set_type || 'normal')
  const [dropRows, setDropRows] = useState([
    { weight: String(Number(set.weight)), reps: String(set.reps) },
    { weight: '', reps: '' },
  ])
  const [ex2, setEx2] = useState(null)
  const [weight1, setWeight1] = useState(String(Number(set.weight)))
  const [reps1, setReps1] = useState(String(set.reps))
  const [weight2, setWeight2] = useState('')
  const [reps2, setReps2] = useState('')
  const [saving, setSaving] = useState(false)

  const handleTypeChange = (type) => {
    setSetType(type)
    if (type === 'dropset') {
      setDropRows([
        { weight: String(Number(set.weight)), reps: String(set.reps) },
        { weight: '', reps: '' },
      ])
    } else if (type === 'superset' || type === 'compound') {
      setEx2(null)
      setWeight1(String(Number(set.weight))); setReps1(String(set.reps))
      setWeight2(''); setReps2('')
    }
  }

  if (editing) {
    if (setType === 'dropset' && onExpand) {
      return (
        <li className="py-2">
          <div className="flex gap-1 flex-wrap mb-2">
            {SET_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                className={`px-2 py-0.5 rounded-full text-xs border transition ${
                  setType === t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
                }`}>{t.label}</button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-2">드랍 순서대로 입력 (무거운 것 → 가벼운 것)</p>
          <div className="space-y-1.5 mb-2">
            {dropRows.map((row, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <span className="text-xs text-slate-400 w-12 shrink-0">{i + 1}번째</span>
                <input type="number" step="0.5" value={row.weight}
                  onChange={(e) => setDropRows(dropRows.map((r, j) => j === i ? { ...r, weight: e.target.value } : r))}
                  className="flex-1 px-2 py-1 border rounded text-sm min-w-0" />
                <span className="text-xs text-slate-400 shrink-0">kg</span>
                <input type="number" value={row.reps}
                  onChange={(e) => setDropRows(dropRows.map((r, j) => j === i ? { ...r, reps: e.target.value } : r))}
                  className="w-14 px-2 py-1 border rounded text-sm" />
                <span className="text-xs text-slate-400 shrink-0">회</span>
                {dropRows.length > 2 && (
                  <button type="button" onClick={() => setDropRows(dropRows.filter((_, j) => j !== i))}
                    className="text-red-400 text-sm px-1 shrink-0">×</button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button"
              onClick={() => setDropRows([...dropRows, { weight: '', reps: '' }])}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600">+ 드랍 추가</button>
            <button disabled={saving}
              onClick={async () => {
                const parsed = dropRows.map((r) => ({ weight: parseFloat(r.weight), reps: parseInt(r.reps, 10) }))
                if (parsed.some((r) => Number.isNaN(r.weight) || Number.isNaN(r.reps) || r.reps <= 0)) {
                  onError('모든 드랍의 중량과 횟수를 입력해주세요.'); return
                }
                setSaving(true)
                try { await onExpand(set.id, parsed); setEditing(false) }
                catch (e) { onError(String(e)) }
                finally { setSaving(false) }
              }}
              className="px-4 py-1.5 text-sm bg-orange-500 text-white rounded disabled:bg-slate-300">드랍세트로 저장</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs border rounded text-slate-600">취소</button>
          </div>
        </li>
      )
    }

    if ((setType === 'superset' || setType === 'compound') && onExpandPaired && categories) {
      const typeLabel = SET_TYPES.find((t) => t.value === setType)?.label
      return (
        <li className="py-2">
          <div className="flex gap-1 flex-wrap mb-3">
            {SET_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                className={`px-2 py-0.5 rounded-full text-xs border transition ${
                  setType === t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
                }`}>{t.label}</button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5">① {set.exercise_name}</p>
              <div className="flex gap-2 flex-wrap">
                <input type="number" step="0.5" value={weight1} onChange={(e) => setWeight1(e.target.value)}
                  placeholder="중량" className="w-20 px-2 py-1.5 border rounded text-sm" />
                <span className="text-xs text-slate-400 self-center">kg</span>
                <input type="number" value={reps1} onChange={(e) => setReps1(e.target.value)}
                  placeholder="횟수" className="w-16 px-2 py-1.5 border rounded text-sm" />
                <span className="text-xs text-slate-400 self-center">회</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5">② 두 번째 운동</p>
              {!ex2 ? (
                <MiniExercisePicker categories={categories} excludeId={set.exercise} onPick={setEx2} onError={onError} />
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium text-slate-700">{ex2.canonical_name}</span>
                    <button type="button" onClick={() => setEx2(null)} className="text-xs text-slate-400 underline">변경</button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <input type="number" step="0.5" value={weight2} onChange={(e) => setWeight2(e.target.value)}
                      placeholder="중량" className="w-20 px-2 py-1.5 border rounded text-sm" />
                    <span className="text-xs text-slate-400 self-center">kg</span>
                    <input type="number" value={reps2} onChange={(e) => setReps2(e.target.value)}
                      placeholder="횟수" className="w-16 px-2 py-1.5 border rounded text-sm" />
                    <span className="text-xs text-slate-400 self-center">회</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {ex2 && (
              <button disabled={saving}
                onClick={async () => {
                  const w1 = parseFloat(weight1), r1 = parseInt(reps1, 10)
                  const w2 = parseFloat(weight2), r2 = parseInt(reps2, 10)
                  if ([w1, r1, w2, r2].some(Number.isNaN) || r1 <= 0 || r2 <= 0) {
                    onError('중량과 횟수를 올바르게 입력해주세요.'); return
                  }
                  setSaving(true)
                  try {
                    await onExpandPaired(set.id, { group_type: setType, weight1: w1, reps1: r1, exercise2: ex2.id, weight2: w2, reps2: r2 })
                    setEditing(false)
                  }
                  catch (e) { onError(String(e)) }
                  finally { setSaving(false) }
                }}
                className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded disabled:bg-slate-300"
              >{typeLabel}로 저장</button>
            )}
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs border rounded text-slate-600">취소</button>
          </div>
        </li>
      )
    }

    return (
      <li className="py-2">
        <div className="flex gap-1 flex-wrap mb-2">
          {SET_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
              className={`px-2 py-0.5 rounded-full text-xs border transition ${
                setType === t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
              }`}>{t.label}</button>
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
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:bg-slate-300">저장</button>
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

function DropRow({ set, index, onUpdate, onDelete, onError }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(Number(set.weight)))
  const [reps, setReps] = useState(String(set.reps))
  const [saving, setSaving] = useState(false)

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <span className="text-xs text-slate-400 w-10 shrink-0">{index + 1}번째</span>
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
        {set.set_type !== 'dropset' && (
          <span className="text-xs text-slate-500 font-medium mr-1">{set.exercise_name}</span>
        )}
        {Number(set.weight)}kg × {set.reps}회
      </span>
      <div className="flex gap-1">
        <button onClick={() => setEditing(true)} className="text-xs text-blue-500 py-0.5 px-2">수정</button>
        <button onClick={async () => { try { await onDelete(set.id) } catch (e) { onError(String(e)) } }}
          className="text-xs text-red-400 py-0.5 px-2">삭제</button>
      </div>
    </div>
  )
}

function DropsetGroupRow({ sets, onUpdate, onDelete, onAddToGroup, onError }) {
  const [addingDrop, setAddingDrop] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [newReps, setNewReps] = useState('')
  const [saving, setSaving] = useState(false)

  const meta = SET_TYPE_LABELS[sets[0].set_type]
  const isDropset = sets[0].set_type === 'dropset'

  return (
    <li className="py-2 px-1">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-slate-500 text-sm">세트 {sets[0].set_number}</span>
        {meta && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>{meta.label}</span>}
      </div>
      <div className="space-y-1">
        {sets.map((s, i) => (
          <DropRow key={s.id} set={s} index={i} onUpdate={onUpdate} onDelete={onDelete} onError={onError} />
        ))}
      </div>
      {isDropset && onAddToGroup && (
        addingDrop ? (
          <div className="mt-1.5 flex gap-1.5 items-center flex-wrap">
            <input type="number" step="0.5" value={newWeight} onChange={(e) => setNewWeight(e.target.value)}
              placeholder="중량" className="w-20 px-2 py-1 border rounded text-sm" />
            <span className="text-xs text-slate-400">kg</span>
            <input type="number" value={newReps} onChange={(e) => setNewReps(e.target.value)}
              placeholder="횟수" className="w-14 px-2 py-1 border rounded text-sm" />
            <span className="text-xs text-slate-400">회</span>
            <button disabled={saving}
              onClick={async () => {
                const w = parseFloat(newWeight), r = parseInt(newReps, 10)
                if (Number.isNaN(w) || Number.isNaN(r) || r <= 0) { onError('올바른 값을 입력해주세요.'); return }
                setSaving(true)
                try { await onAddToGroup(sets[0].id, { weight: w, reps: r }); setNewWeight(''); setNewReps(''); setAddingDrop(false) }
                catch (e) { onError(String(e)) }
                finally { setSaving(false) }
              }}
              className="text-xs bg-orange-500 text-white px-2 py-1 rounded disabled:bg-slate-300">추가</button>
            <button onClick={() => { setAddingDrop(false); setNewWeight(''); setNewReps('') }}
              className="text-xs border px-2 py-1 rounded text-slate-600">취소</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingDrop(true)}
            className="mt-1 text-xs text-orange-600 border border-orange-300 px-2 py-0.5 rounded">
            + 드랍 추가
          </button>
        )
      )}
    </li>
  )
}

function ExerciseSetList({ sets, onUpdate, onDelete, onExpand, onExpandPaired, onAddToGroup, categories, onError }) {
  const ungrouped = sets.filter((s) => s.group_id == null)
  const groupedMap = {}
  sets.filter((s) => s.group_id != null).forEach((s) => {
    groupedMap[s.group_id] = groupedMap[s.group_id] || []
    groupedMap[s.group_id].push(s)
  })
  const items = []
  ungrouped.forEach((s) => items.push({ type: 'single', key: s.id, minSetNum: s.set_number, data: s }))
  Object.keys(groupedMap).forEach((gid) => {
    const groupSets = [...groupedMap[gid]].sort((a, b) => a.set_number - b.set_number)
    items.push({ type: 'group', key: gid, minSetNum: groupSets[0].set_number, data: groupSets })
  })
  items.sort((a, b) => a.minSetNum - b.minSetNum)
  return (
    <ul className="divide-y border rounded bg-slate-50">
      {items.map((item) =>
        item.type === 'single' ? (
          <SetRow key={item.key} set={item.data} onUpdate={onUpdate} onDelete={onDelete} onExpand={onExpand} onExpandPaired={onExpandPaired} categories={categories} onError={onError} />
        ) : (
          <DropsetGroupRow key={item.key} sets={item.data} onUpdate={onUpdate} onDelete={onDelete} onAddToGroup={onAddToGroup} onError={onError} />
        )
      )}
    </ul>
  )
}

function SessionCard({ session, onUpdateSet, onDeleteSet, onExpandSet, onExpandPairedSet, onAddToGroup, categories, onError }) {
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
            onExpand={onExpandSet}
            onExpandPaired={onExpandPairedSet}
            onAddToGroup={onAddToGroup}
            categories={categories}
            onError={onError}
          />
        </li>
      ))}
    </ul>
  )
}
