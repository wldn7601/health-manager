import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchExercise,
  fetchExerciseHistory,
  fetchExerciseTips,
} from '../api/workouts'

export default function ExerciseDetail() {
  const { id } = useParams()
  const [exercise, setExercise] = useState(null)
  const [history, setHistory] = useState([])
  const [tips, setTips] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      fetchExercise(id),
      fetchExerciseHistory(id),
      fetchExerciseTips(id),
    ])
      .then(([ex, hist, t]) => {
        setExercise(ex)
        setHistory(hist)
        setTips(t)
      })
      .catch((e) => setError(String(e)))
  }, [id])

  if (error) {
    return (
      <section>
        <p className="text-red-600 text-sm">{error}</p>
      </section>
    )
  }

  if (!exercise) {
    return <p className="text-slate-400 text-sm">불러오는 중…</p>
  }

  return (
    <section>
      <Link
        to="/history"
        className="text-sm text-slate-500 hover:text-slate-800"
      >
        ← 히스토리로
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{exercise.canonical_name}</h1>
      {exercise.aliases?.length > 1 && (
        <p className="text-xs text-slate-400 mb-4">
          별칭: {exercise.aliases.filter((a) => a !== exercise.canonical_name).join(', ')}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">
            기록 히스토리
          </h2>
          {history.length === 0 ? (
            <p className="text-slate-400 text-sm">아직 기록이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.session_id}
                  className="bg-white rounded-lg border p-3"
                >
                  <div className="text-xs text-slate-500 mb-1">{h.date}</div>
                  <div className="text-sm text-slate-700">
                    {h.sets
                      .map((s) => `${Number(s.weight)}kg × ${s.reps}`)
                      .join(' / ')}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    최대{' '}
                    {Math.max(...h.sets.map((s) => Number(s.weight)))}kg ·
                    {' '}총 볼륨{' '}
                    {h.sets.reduce(
                      (sum, s) => sum + Number(s.weight) * s.reps,
                      0,
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">
            팁 메모
          </h2>
          {tips.length === 0 ? (
            <p className="text-slate-400 text-sm">아직 팁이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {tips.map((t) => (
                <li
                  key={t.id}
                  className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                >
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {t.content}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(t.created_at).toLocaleString('ko-KR')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
