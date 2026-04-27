import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchExerciseProgress, fetchSessions } from '../api/workouts'

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
            <ProgressCharts data={progressData} />
          )}
        </>
      )}
    </section>
  )
}

function ProgressCharts({ data }) {
  const [selectedKey, setSelectedKey] = useState('max_weight')
  const points = data.data

  if (points.length === 0) {
    return <p className="text-slate-400 text-sm">선택한 기간에 기록이 없습니다.</p>
  }

  const latest = points[points.length - 1]
  const selectedMetric = METRICS.find((m) => m.key === selectedKey)

  return (
    <div className="space-y-4">
      {/* 지표 카드 그리드 — 누르면 해당 그래프로 전환 */}
      <div className="grid grid-cols-3 gap-2">
        {METRICS.map((m) => {
          const active = selectedKey === m.key
          return (
            <button
              key={m.key}
              onClick={() => setSelectedKey(m.key)}
              className={`rounded-xl border p-3 text-left transition ${
                active ? 'border-2 bg-white' : 'bg-white border-slate-200'
              }`}
              style={active ? { borderColor: m.color } : {}}
            >
              <p className="text-xs text-slate-400 mb-1 truncate">{m.label}</p>
              <p className="text-base font-bold leading-tight" style={{ color: m.color }}>
                {latest[m.key]}
                <span className="text-xs font-normal ml-0.5">{m.unit}</span>
              </p>
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
