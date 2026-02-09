import { Route, Routes } from 'react-router-dom'
import { Ladder } from './pages/Ladder'
import { Puzzle } from './pages/Puzzle'
import { ResultsPage } from './pages/ResultsPage'

export default function App() {
  return (
    <div className="app-shell">
      <main>
        <Routes>
          <Route path="/" element={<Ladder />} />
          <Route path="/puzzle/:puzzleId" element={<Puzzle />} />
          <Route path="/results/:puzzleId" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  )
}
