import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PrimaryButton, SecondaryButton, StarsRow } from '../components'
import { bonusRushLevels } from '../data/bonusRush'
import { getProgress } from '../state/storage'

export function Results() {
  const navigate = useNavigate()
  const { puzzleId } = useParams<{ puzzleId: string }>()
  const levelId = Number(puzzleId)
  const level = useMemo(() => bonusRushLevels.find((entry) => entry.id === levelId), [levelId])

  if (!level) {
    return (
      <section className="card page">
        <h2>Results unavailable</h2>
        <SecondaryButton onClick={() => navigate('/')}>Back to Ladder</SecondaryButton>
      </section>
    )
  }

  const progress = getProgress()[level.id] ?? { bestFound: 0, bestStars: 0 }
  const nextLevel = bonusRushLevels.find((entry) => entry.id === level.id + 1)

  return (
    <section className="results-page card page">
      <header className="results-header">
        <h2>{level.name} Results</h2>
      </header>
      <div className="results-stars" aria-label={`${progress.bestStars} stars`}>
        <StarsRow stars={progress.bestStars} />
      </div>

      <div className="result-grid">
        <article className="result-pill">
          <span>Found</span>
          <strong>{progress.bestFound}</strong>
        </article>
        <article className="result-pill">
          <span>Total</span>
          <strong>{level.totalWords}</strong>
        </article>
      </div>

      <div className="results-actions">
        <PrimaryButton onClick={() => navigate(`/puzzle/${level.id}`)}>Replay</PrimaryButton>
        <PrimaryButton onClick={() => navigate(nextLevel ? `/puzzle/${nextLevel.id}` : '/')}>Next Level</PrimaryButton>
      </div>
    </section>
  )
}

