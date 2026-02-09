import { Route, Routes } from 'react-router-dom'
import { Ladder } from './pages/Ladder'
import { PuzzlePage } from './pages/PuzzlePage'
import { ResultsPage } from './pages/ResultsPage'

export default function App() {
  return (
    <div className="app-shell">
      <main>
        <Routes>
          <Route path="/" element={<Ladder />} />
          <Route path="/puzzle/:puzzleId" element={<PuzzlePage />} />
          <Route path="/results/:puzzleId" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  )
}
