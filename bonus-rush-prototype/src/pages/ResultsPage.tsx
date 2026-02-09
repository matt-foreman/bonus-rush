import { Link, useParams } from 'react-router-dom'

export function ResultsPage() {
  const { puzzleId } = useParams<{ puzzleId: string }>()

  return (
    <section className="card page">
      <h2>Results</h2>
      <p>
        Puzzle <strong>{puzzleId ?? 'unknown'}</strong> complete.
      </p>

      <div className="result-grid">
        <article className="result-pill">
          <span>Score</span>
          <strong>1480</strong>
        </article>
        <article className="result-pill">
          <span>Words</span>
          <strong>23</strong>
        </article>
        <article className="result-pill">
          <span>Stars</span>
          <strong>3</strong>
        </article>
      </div>

      <Link className="primary-action" to="/">
        Back to Ladder
      </Link>
    </section>
  )
}
