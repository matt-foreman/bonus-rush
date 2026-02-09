import { Link, useParams } from 'react-router-dom'

export function PuzzlePage() {
  const { puzzleId } = useParams<{ puzzleId: string }>()

  return (
    <section className="card page">
      <h2>Puzzle</h2>
      <p>
        Active puzzle: <strong>{puzzleId ?? 'unknown'}</strong>
      </p>

      <div className="tile-row" aria-label="wood-style letter tiles">
        {['B', 'O', 'N', 'U', 'S'].map((letter) => (
          <button key={letter} className="wood-tile" type="button">
            {letter}
          </button>
        ))}
      </div>

      <Link className="primary-action" to={`/results/${puzzleId ?? ''}`}>
        Finish Puzzle
      </Link>
    </section>
  )
}
