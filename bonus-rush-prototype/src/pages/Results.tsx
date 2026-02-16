import { useEffect, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PrimaryButton, SecondaryButton, StarsRow } from '../components'
import { bonusRushLevels } from '../data/bonusRush'
import { getProgress, recordRun } from '../state/storage'

function thresholdCount(total: number, pct: number): number {
  return Math.max(0, Math.min(total, Math.ceil(total * pct)))
}

function starsForFound(found: number, total: number, thresholdsPct: { oneStar: number; twoStar: number; threeStar: number }): number {
  const one = thresholdCount(total, thresholdsPct.oneStar)
  const two = thresholdCount(total, thresholdsPct.twoStar)
  const three = thresholdCount(total, thresholdsPct.threeStar)
  if (found >= three) {
    return 3
  }
  if (found >= two) {
    return 2
  }
  if (found >= one) {
    return 1
  }
  return 0
}

export function Results() {
  const navigate = useNavigate()
  const { puzzleId } = useParams<{ puzzleId: string }>()
  const [searchParams] = useSearchParams()
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

  const bestProgress = getProgress()[level.id] ?? { bestFound: 0, bestStars: 0 }
  const foundFromQuery = Number(searchParams.get('found'))
  const runFound = Number.isFinite(foundFromQuery)
    ? Math.max(0, Math.min(level.totalWords, Math.floor(foundFromQuery)))
    : bestProgress.bestFound
  const runStars = starsForFound(runFound, level.totalWords, level.starThresholdsPct)
  useEffect(() => {
    recordRun(level.id, runFound, runStars)
  }, [level.id, runFound, runStars])
  const progress = getProgress()[level.id] ?? bestProgress
  const nextLevel = bonusRushLevels.find((entry) => entry.id === level.id + 1)

  return (
    <section className="results-page card page">
      <header className="results-header">
        <h2>{level.title} Results</h2>
      </header>
      <div className="results-stars" aria-label={`${runStars} stars`}>
        <StarsRow stars={runStars} />
      </div>

      <div className="result-grid">
        <article className="result-pill">
          <span>Found This Run</span>
          <strong>{runFound}</strong>
        </article>
        <article className="result-pill">
          <span>Total</span>
          <strong>{level.totalWords}</strong>
        </article>
        <article className="result-pill">
          <span>Best Stars</span>
          <strong>{progress.bestStars}</strong>
        </article>
      </div>

      <div className="results-actions">
        <PrimaryButton onClick={() => navigate(`/puzzle/${level.id}`)}>Replay</PrimaryButton>
        <PrimaryButton onClick={() => navigate(nextLevel ? `/puzzle/${nextLevel.id}` : '/')}>Next Level</PrimaryButton>
      </div>
    </section>
  )
}
