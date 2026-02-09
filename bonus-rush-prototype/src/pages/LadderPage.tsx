import { Link } from 'react-router-dom'

const samplePuzzles = ['alpha', 'breeze', 'cedar', 'dune', 'ember']

export function LadderPage() {
  return (
    <section className="card page">
      <h2>Ladder</h2>
      <p>Pick your next rung and keep the streak alive.</p>

      <ul className="ladder-list">
        {samplePuzzles.map((id, index) => (
          <li key={id} className="ladder-item">
            <span className="rung">{index + 1}</span>
            <span className="name">{id}</span>
            <Link className="play-link" to={`/puzzle/${id}`}>
              Play
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
