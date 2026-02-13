import { Route, Routes } from 'react-router-dom'
import { Ladder } from './pages/Ladder'
import { Puzzle } from './pages/Puzzle'
import { Results } from './pages/Results'
import './styles/bonusRushTheme.css'
import './styles/ladderMap.css'
import './styles/theme.css'

export default function App() {
  return (
    <div className="app-shell phone-frame-layout">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Ladder />} />
          <Route path="/puzzle/:puzzleId" element={<Puzzle />} />
          <Route path="/results/:puzzleId" element={<Results />} />
        </Routes>
      </main>
    </div>
  )
}
