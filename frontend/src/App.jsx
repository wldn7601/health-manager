import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-full bg-slate-50 text-slate-900">
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
          <nav className="max-w-2xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-lg font-bold">헬스 매니저</Link>
            <div className="flex gap-4 text-sm">
              <Link to="/record" className="hover:text-blue-600">기록</Link>
              <Link to="/history" className="hover:text-blue-600">히스토리</Link>
              <Link to="/progress" className="hover:text-blue-600">추이</Link>
            </div>
          </nav>
        </header>
        <main className="max-w-2xl mx-auto p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/record" element={<Placeholder title="운동 기록" />} />
            <Route path="/history" element={<Placeholder title="히스토리" />} />
            <Route path="/progress" element={<Placeholder title="성장 추이" />} />
            <Route path="*" element={<Placeholder title="404" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function Placeholder({ title }) {
  return (
    <section>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-slate-500">Phase 1에서 구현 예정</p>
    </section>
  )
}

export default App
