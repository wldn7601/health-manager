import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSessions } from '../api/workouts'

function groupByExercise(sets) {
  const map = {}
  for (const set of sets) {
    if (!map[set.exercise_name]) map[set.exercise_name] = []
    map[set.exercise_name].push(set)
  }
  return Object.entries(map)
}

export default function Home() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
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
                <div className="flex flex-wrap gap-1.5">
                  {sets.map((set) => (
                    <span
                      key={set.id}
                      className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full"
                    >
                      {set.weight}kg × {set.reps}회
                    </span>
                  ))}
                </div>
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
