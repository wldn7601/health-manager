import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchExerciseHistory, fetchExerciseProgress, fetchSessions } from '../api/workouts'

const PERIODS = [
  { label: '1개월', value: '1m' },
  { label: '3개월', value: '3m' },
  { label: '6개월', value: '6m' },
  { label: '전체', value: 'all' },
]

const METRICS = [
  { key: 'max_weight',    label: '최고 중량',  unit: 'kg', color: '#2563eb' },
  { key: 'avg_weight',    label: '평균 중량',  unit: 'kg', color: '#ea580c' },
  { key: 'total_volume',  label: '총 볼륨',    unit: '',   color: '#16a34a' },
  { key: 'set_count',     label: '세트 수',    unit: '세트', color: '#9333ea' },
  { key: 'max_reps',      label: '최고 횟수',  unit: '회', color: '#db2777' },
  { key: 'avg_reps',      label: '평균 횟수',  unit: '회', color: '#0891b2' },
]

export default function Progress() {
  const [exercises, setExercises] = useState([])
  const [selectedEx, setSelectedEx] = useState(null)
  const [period, setPeriod] = useState('3m')
  const [progressData, setProgressData] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSessions({ start: '2000-01-01', end: '2099-12-31' })
      .then((sessions) => {
        const exMap = {}
        sessions.forEach((s) =>
          s.sets.forEach((set) => {
            exMap[set.exercise] = set.exercise_name
          }),
        )
        const list = Object.entries(exMap).map(([id, name]) => ({
          id: Number(id),
          name,
        }))
        setExercises(list)
        if (list.length > 0) setSelectedEx(list[0])
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (!selectedEx) return
    setLoading(true)
    setError(null)
    fetchExerciseProgress(selectedEx.id, period)
      .then(setProgressData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [selectedEx, period])

  useEffect(() => {
    if (!selectedEx) return
    setHistory([])
    fetchExerciseHistory(selectedEx.id)
      .then(setHistory)
      .catch(() => {})
  }, [selectedEx])

  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">성장 추이</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      {exercises.length === 0 && !error && (
        <p className="text-slate-400 text-sm">기록된 운동이 없습니다.</p>
      )}

      {exercises.length > 0 && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-600 mb-2">운동 선택</label>
            <select
              value={selectedEx?.id ?? ''}
              onChange={(e) => {
                const found = exercises.find((x) => x.id === Number(e.target.value))
                setSelectedEx(found ?? null)
              }}
              className="w-full px-3 py-2 border rounded text-sm outline-none focus:border-blue-400"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  period === p.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {loading && <p className="text-slate-400 text-sm">불러오는 중…</p>}

          {!loading && progressData && (
            <ProgressCharts data={progressData} history={history} />
          )}
        </>
      )}
    </section>
  )
}

function ProgressCharts({ data, history }) {
  const [selectedKey, setSelectedKey] = useState('max_weight')
  const points = data.data

  const progressDates = useMemo(() => new Set(points.map((p) => p.date)), [points])
  const progressByDate = useMemo(() => {
    const map = {}
    points.forEach((p) => { map[p.date] = p })
    return map
  }, [points])
  const filteredHistory = useMemo(
    () => [...history.filter((h) => progressDates.has(h.date))].sort((a, b) => b.date.localeCompare(a.date)),
    [history, progressDates],
  )

  if (points.length === 0) {
    return <p className="text-slate-400 text-sm">선택한 기간에 기록이 없습니다.</p>
  }

  const first = points[0]
  const latest = points[points.length - 1]
  const selectedMetric = METRICS.find((m) => m.key === selectedKey)

  const periodBest = (key) => Math.max(...points.map((p) => Number(p[key])))

  return (
    <div className="space-y-4">
      {/* 지표 카드 그리드 — 누르면 해당 그래프로 전환 */}
      <div className="grid grid-cols-3 gap-2">
        {METRICS.map((m) => {
          const active = selectedKey === m.key
          const best = periodBest(m.key)
          const latestVal = Number(latest[m.key])
          const firstVal = Number(first[m.key])
          const rawDelta = latestVal - firstVal
          const delta = parseFloat(rawDelta.toFixed(1))
          const isPersonalBest = latestVal === best
          return (
            <button
              key={m.key}
              onClick={() => setSelectedKey(m.key)}
              className={`rounded-xl border p-3 text-left transition ${
                active ? 'border-2 bg-white' : 'bg-white border-slate-200'
              }`}
              style={active ? { borderColor: m.color } : {}}
            >
              <p className="text-xs text-slate-400 mb-0.5 truncate">{m.label}</p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-bold leading-tight" style={{ color: m.color }}>{best}</span>
                <span className="text-xs font-normal text-slate-400">{m.unit}</span>
                {isPersonalBest && <span className="text-xs ml-0.5">🏆</span>}
              </div>
              {points.length > 1 && (
                <p className="text-xs text-slate-400 mt-0.5 leading-none">
                  최근 {latestVal}
                  {delta !== 0 && (
                    <span className={delta > 0 ? ' text-green-500 font-medium' : ' text-red-400 font-medium'}>
                      {' '}{delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* 선택된 지표 그래프 */}
      <ChartCard
        title={selectedMetric.label}
        dataKey={selectedMetric.key}
        points={points}
        unit={selectedMetric.unit}
        color={selectedMetric.color}
      />

      {filteredHistory.length > 0 && (
        <ExerciseHistoryList sessions={filteredHistory} progressByDate={progressByDate} />
      )}
    </div>
  )
}

const SET_TYPE_BADGE = {
  dropset:  { label: '드랍',      color: 'bg-orange-100 text-orange-600' },
  superset: { label: '슈퍼',      color: 'bg-purple-100 text-purple-600' },
  compound: { label: '컴파운드',  color: 'bg-green-100 text-green-700' },
}

function ExerciseHistoryList({ sessions, progressByDate }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-600">날짜별 세트 기록</h3>
      {sessions.map((sess) => (
        <ExerciseSessionRow key={sess.session_id} session={sess} stats={progressByDate[sess.date]} />
      ))}
    </div>
  )
}

function ExerciseSessionRow({ session, stats }) {
  const [open, setOpen] = useState(false)

  const ungrouped = session.sets.filter((s) => s.group_id == null)
  const groupedMap = {}
  session.sets.filter((s) => s.group_id != null).forEach((s) => {
    groupedMap[s.group_id] = groupedMap[s.group_id] || []
    groupedMap[s.group_id].push(s)
  })
  const items = []
  ungrouped.forEach((s) => items.push({ type: 'single', key: s.id, minSetNum: s.set_number, data: s }))
  Object.keys(groupedMap).forEach((gid) => {
    const gs = [...groupedMap[gid]].sort((a, b) => a.set_number - b.set_number)
    items.push({ type: 'group', key: gid, minSetNum: gs[0].set_number, data: gs })
  })
  items.sort((a, b) => a.minSetNum - b.minSetNum)

  const logicalCount = ungrouped.length + Object.keys(groupedMap).length

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-50"
      >
        <span className="font-semibold text-slate-800 text-sm">{session.date}</span>
        <div className="flex items-center gap-3 shrink-0">
          {stats && (
            <span className="text-xs text-slate-400">
              최고 {stats.max_weight}kg · 볼륨 {stats.total_volume}
            </span>
          )}
          <span className="text-xs text-slate-400">{logicalCount}세트</span>
          <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="border-t px-4 py-3">
          <ul className="space-y-1.5 text-sm">
            {items.map((item) =>
              item.type === 'single' ? (
                <li key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-xs">세트 {item.data.set_number}</span>
                    {SET_TYPE_BADGE[item.data.set_type] && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SET_TYPE_BADGE[item.data.set_type].color}`}>
                        {SET_TYPE_BADGE[item.data.set_type].label}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-700">{Number(item.data.weight)}kg × {item.data.reps}회</span>
                </li>
              ) : (
                <li key={item.key} className="py-0.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-slate-400 text-xs">세트 {item.data[0].set_number}</span>
                    {SET_TYPE_BADGE[item.data[0].set_type] && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SET_TYPE_BADGE[item.data[0].set_type].color}`}>
                        {SET_TYPE_BADGE[item.data[0].set_type].label}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 ml-2">
                    {item.data.map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{i + 1}번째</span>
                        <span className="text-slate-700">{Number(s.weight)}kg × {s.reps}회</span>
                      </div>
                    ))}
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, dataKey, points, unit, color }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-4">
        {title}{unit && <span className="text-xs font-normal text-slate-400 ml-1">({unit})</span>}
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
          <Tooltip
            formatter={(v) => [`${v}${unit}`, title]}
            labelFormatter={(l) => l}
            contentStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
