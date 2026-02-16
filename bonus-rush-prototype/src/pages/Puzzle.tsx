import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BonusCounter,
  CrosswordGrid,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  TimeExpiredModal,
  WordWheel,
} from '../components'
import { bonusRushLevels } from '../data/bonusRush'
import { getInventory, getProgress, recordRun, resetAllProgress, type Inventory, updateInventory } from '../state/storage'
import { canPlaceWord, getSlots, placeWord, type CrosswordSlot } from '../utils/crossword'
import { normalizeWord } from '../utils/wordGame'

const START_TIME_SECONDS = 60
const INVALID_WORD_ANIMATION_MS = 620
const TIMER_STORAGE_PREFIX = 'bonusRush.timerEndsAt'
const COIN_COST = 75
const DEBUG_AVAILABLE = import.meta.env.DEV
const ONE_STAR_PCT = 0.4
const TWO_STAR_PCT = 0.7

function buildRunGrid(grid: string[][]): string[][] {
  return grid.map((row) => row.map((cell) => (cell === '#' ? '#' : '')))
}

function formatTimer(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function thresholdCount(total: number, pct: number): number {
  return Math.max(0, Math.min(total, Math.ceil(total * pct)))
}

function starsForFound(found: number, total: number): number {
  const one = thresholdCount(total, ONE_STAR_PCT)
  const two = thresholdCount(total, TWO_STAR_PCT)
  const three = total
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

function buildResultsUrl(levelId: number, found: number): string {
  const params = new URLSearchParams({
    found: String(found),
    run: String(Date.now()),
  })
  return `/results/${levelId}?${params.toString()}`
}

function rewardsForStars(stars: number): { coins?: number; hints?: number; wildlifeTokens?: number } {
  if (stars === 3) {
    return { coins: 200, hints: 1, wildlifeTokens: 1 }
  }
  return {}
}

function rewardRows(rewards: { coins?: number; hints?: number; wildlifeTokens?: number }): string[] {
  const rows: string[] = []
  if (rewards.coins) {
    rows.push(`+${rewards.coins} coins`)
  }
  if (rewards.hints) {
    rows.push(`+${rewards.hints} hint${rewards.hints > 1 ? 's' : ''}`)
  }
  if (rewards.wildlifeTokens) {
    rows.push(`+${rewards.wildlifeTokens} wildlife token`)
  }
  return rows
}

function timerStorageKey(levelId: number): string {
  return `${TIMER_STORAGE_PREFIX}.${levelId}`
}

function readStoredTimerSeconds(levelId: number): number | null {
  const raw = window.localStorage.getItem(timerStorageKey(levelId))
  if (!raw) {
    return null
  }
  const endsAt = Number(raw)
  if (!Number.isFinite(endsAt) || endsAt <= 0) {
    window.localStorage.removeItem(timerStorageKey(levelId))
    return null
  }
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  if (remaining === 0) {
    window.localStorage.removeItem(timerStorageKey(levelId))
  }
  return remaining
}

function writeStoredTimerSeconds(levelId: number, remainingSeconds: number): void {
  const key = timerStorageKey(levelId)
  if (remainingSeconds <= 0) {
    window.localStorage.removeItem(key)
    return
  }
  window.localStorage.setItem(key, String(Date.now() + remainingSeconds * 1000))
}

function getInitialStoredTimerSeconds(levelId: number): number {
  const current = readStoredTimerSeconds(levelId)
  if (current !== null) {
    return current
  }
  writeStoredTimerSeconds(levelId, START_TIME_SECONDS)
  return START_TIME_SECONDS
}

function wordFromGridSlot(grid: string[][], slot: CrosswordSlot): string {
  const letters: string[] = []
  for (let index = 0; index < slot.length; index += 1) {
    const row = slot.direction === 'vertical' ? slot.row + index : slot.row
    const col = slot.direction === 'horizontal' ? slot.col + index : slot.col
    letters.push(grid[row]?.[col] ?? '')
  }
  return normalizeWord(letters.join(''))
}

function findTemplateSlotForWord(templateGrid: string[][], runGrid: string[][], word: string): CrosswordSlot | null {
  const normalizedWord = normalizeWord(word)
  if (!normalizedWord) {
    return null
  }
  const templateSlots = getSlots(templateGrid)
  for (const slot of templateSlots) {
    if (slot.length !== normalizedWord.length) {
      continue
    }
    if (wordFromGridSlot(templateGrid, slot) !== normalizedWord) {
      continue
    }
    if (canPlaceWord(runGrid, normalizedWord, slot)) {
      return slot
    }
  }
  return null
}

export function Puzzle() {
  const navigate = useNavigate()
  const { puzzleId } = useParams<{ puzzleId: string }>()
  const levelId = Number(puzzleId)
  const level = useMemo(() => bonusRushLevels.find((entry) => entry.id === levelId), [levelId])

  const [runGrid, setRunGrid] = useState<string[][]>([])
  const [currentWord, setCurrentWord] = useState('')
  const [crosswordWords, setCrosswordWords] = useState<string[]>([])
  const [bonusWords, setBonusWords] = useState<string[]>([])
  const [latestBonusWord, setLatestBonusWord] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(START_TIME_SECONDS)
  const [inventory, setInventory] = useState<Inventory>(() => getInventory())
  const [rewardVideosUsed, setRewardVideosUsed] = useState(0)
  const [iapUsed, setIapUsed] = useState(false)
  const [showTimeExpiredModal, setShowTimeExpiredModal] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [invalidWordPulse, setInvalidWordPulse] = useState(0)
  const [alreadyFoundPulse, setAlreadyFoundPulse] = useState(0)
  const [temporaryMessage, setTemporaryMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [showDebugMenu, setShowDebugMenu] = useState(false)
  const [showResetProgressConfirm, setShowResetProgressConfirm] = useState(false)
  const [debugOutput, setDebugOutput] = useState('')

  const allowedWordsList = useMemo(() => (level ? level.allowedWords.map((word) => normalizeWord(word)).filter(Boolean) : []), [level])
  const allowedWordsSet = useMemo(() => new Set(allowedWordsList), [allowedWordsList])
  const crosswordWordsList = useMemo(() => (level ? level.crosswordWords.map((word) => normalizeWord(word)).filter(Boolean) : []), [level])
  const crosswordWordsSet = useMemo(() => new Set(crosswordWordsList), [crosswordWordsList])

  useEffect(() => {
    if (!level) {
      return
    }
    const bestStars = getProgress()[level.id]?.bestStars ?? 0
    if (bestStars >= 3) {
      navigate(`/results/${level.id}`, { replace: true })
    }
  }, [level, navigate])

  useEffect(() => {
    if (!level) {
      return
    }
    setRunGrid(buildRunGrid(level.crosswordGrid))
    setCurrentWord('')
    setCrosswordWords([])
    setBonusWords([])
    setLatestBonusWord(null)
    setInventory(getInventory())
    setRewardVideosUsed(0)
    setIapUsed(false)
    setShowTimeExpiredModal(false)
    setShowLeaveDialog(false)
    setShowCompleteDialog(false)
    setInvalidWordPulse(0)
    setAlreadyFoundPulse(0)
    setTemporaryMessage('')
    setFeedback('')
    setShowDebugMenu(false)
    setShowResetProgressConfirm(false)
    setDebugOutput('')
    setSecondsLeft(getInitialStoredTimerSeconds(level.id))
  }, [level])

  useEffect(() => {
    if (!level || secondsLeft <= 0 || showLeaveDialog || showCompleteDialog) {
      return
    }

    const timer = window.setInterval(() => {
      const remaining = readStoredTimerSeconds(level.id)
      if (remaining === null) {
        window.clearInterval(timer)
        setSecondsLeft(0)
        return
      }
      setSecondsLeft(remaining)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [level, secondsLeft, showLeaveDialog, showCompleteDialog])

  const foundAllWords = new Set([...crosswordWords, ...bonusWords])
  const totalFound = foundAllWords.size
  const totalAvailable = level?.totalWords ?? 0
  const stars = level ? starsForFound(totalFound, totalAvailable) : 0
  const isComplete = totalAvailable > 0 && totalFound === totalAvailable
  const missingWords = allowedWordsList.filter((word) => !foundAllWords.has(word))
  const completionRewards = rewardRows(rewardsForStars(stars))

  useEffect(() => {
    if (secondsLeft === 0 && !isComplete) {
      setShowTimeExpiredModal(true)
    }
  }, [secondsLeft, isComplete])

  useEffect(() => {
    if (!level || !isComplete || showCompleteDialog) {
      return
    }
    const rewardDelta = rewardsForStars(stars)
    setInventory(updateInventory(rewardDelta))
    recordRun(level.id, totalFound, stars)
    window.localStorage.removeItem(timerStorageKey(level.id))
    setShowCompleteDialog(true)
  }, [level, isComplete, showCompleteDialog, totalFound, stars])

  useEffect(() => {
    if (invalidWordPulse === 0) {
      return
    }
    const timeout = window.setTimeout(() => {
      setCurrentWord('')
      setInvalidWordPulse(0)
    }, INVALID_WORD_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [invalidWordPulse])

  useEffect(() => {
    if (alreadyFoundPulse === 0) {
      return
    }
    const timeout = window.setTimeout(() => setAlreadyFoundPulse(0), 560)
    return () => window.clearTimeout(timeout)
  }, [alreadyFoundPulse])

  useEffect(() => {
    if (!temporaryMessage) {
      return
    }
    const timeout = window.setTimeout(() => setTemporaryMessage(''), 900)
    return () => window.clearTimeout(timeout)
  }, [temporaryMessage])

  if (!level) {
    return (
      <section className="card page">
        <h2>Level not found</h2>
        <SecondaryButton onClick={() => navigate('/')}>Back</SecondaryButton>
      </section>
    )
  }

  const submitWord = () => {
    const rejectWord = (message: string, animateWord: boolean) => {
      setFeedback(message)
      setTemporaryMessage('')
      if (animateWord && normalizeWord(currentWord)) {
        setInvalidWordPulse((value) => value + 1)
      }
    }

    if (secondsLeft <= 0) {
      rejectWord('Time is up.', false)
      return
    }

    const normalized = normalizeWord(currentWord)
    if (!normalized) {
      rejectWord('Build a word first.', false)
      return
    }
    if (normalized.length < 3) {
      rejectWord('Words must be at least 3 letters.', true)
      return
    }
    if (foundAllWords.has(normalized)) {
      setAlreadyFoundPulse((value) => value + 1)
      setTemporaryMessage('already found')
      setFeedback('')
      setCurrentWord('')
      return
    }
    if (!allowedWordsSet.has(normalized)) {
      rejectWord('Word is not in this level list.', true)
      return
    }

    const shouldTryCrossword = crosswordWordsSet.has(normalized)
    const matchingSlot = shouldTryCrossword ? findTemplateSlotForWord(level.crosswordGrid, runGrid, normalized) : null

    if (shouldTryCrossword && matchingSlot) {
      const nextGrid = placeWord(runGrid, normalized, matchingSlot)
      const nextCrosswordWords = [...crosswordWords, normalized]
      const nextFound = new Set([...nextCrosswordWords, ...bonusWords]).size
      setRunGrid(nextGrid)
      setCrosswordWords(nextCrosswordWords)
      setLatestBonusWord(null)
      recordRun(level.id, nextFound, starsForFound(nextFound, totalAvailable))
      setFeedback(`Filled crossword: ${normalized}`)
    } else {
      const nextBonusWords = [...bonusWords, normalized]
      const nextFound = new Set([...crosswordWords, ...nextBonusWords]).size
      setBonusWords(nextBonusWords)
      setLatestBonusWord(normalized)
      recordRun(level.id, nextFound, starsForFound(nextFound, totalAvailable))
      setFeedback(`Bonus word found: ${normalized}`)
    }
    setCurrentWord('')
  }

  const completeCrosswordDebug = () => {
    const nextCrosswordWords = new Set(crosswordWords)
    let nextGrid = runGrid

    for (const word of crosswordWordsList) {
      const slot = findTemplateSlotForWord(level.crosswordGrid, nextGrid, word)
      if (slot) {
        nextGrid = placeWord(nextGrid, word, slot)
      }
      nextCrosswordWords.add(word)
    }

    const filteredBonus = bonusWords.filter((word) => !nextCrosswordWords.has(word))
    const finalizedCrossword = Array.from(nextCrosswordWords)
    const nextFound = new Set([...finalizedCrossword, ...filteredBonus]).size

    setRunGrid(nextGrid)
    setCrosswordWords(finalizedCrossword)
    setBonusWords(filteredBonus)
    setLatestBonusWord(null)
    setFeedback('Crossword words completed.')
    setCurrentWord('')
    recordRun(level.id, nextFound, starsForFound(nextFound, totalAvailable))
  }

  const completeBonusDebug = () => {
    const nextBonusWordsSet = new Set(bonusWords)
    const crosswordSet = new Set(crosswordWordsList)

    for (const word of allowedWordsList) {
      if (!crosswordSet.has(word) && !crosswordWords.includes(word)) {
        nextBonusWordsSet.add(word)
      }
    }

    const finalizedBonus = Array.from(nextBonusWordsSet)
    const nextFound = new Set([...crosswordWords, ...finalizedBonus]).size

    setBonusWords(finalizedBonus)
    setLatestBonusWord(finalizedBonus[finalizedBonus.length - 1] ?? null)
    setFeedback('Bonus words completed.')
    setCurrentWord('')
    recordRun(level.id, nextFound, starsForFound(nextFound, totalAvailable))
  }

  const addExtraTimeFromRewardVideo = () => {
    if (rewardVideosUsed >= 3) {
      return
    }
    const nextSeconds = secondsLeft + 30
    setRewardVideosUsed((value) => value + 1)
    setSecondsLeft(nextSeconds)
    writeStoredTimerSeconds(level.id, nextSeconds)
    setShowTimeExpiredModal(false)
  }

  const addExtraTimeFromCoins = () => {
    if (inventory.coins < COIN_COST) {
      return
    }
    const next = updateInventory({ coins: -COIN_COST })
    const nextSeconds = secondsLeft + 30
    setInventory(next)
    setSecondsLeft(nextSeconds)
    writeStoredTimerSeconds(level.id, nextSeconds)
    setShowTimeExpiredModal(false)
  }

  const addExtraTimeFromIap = () => {
    if (iapUsed) {
      return
    }
    const nextSeconds = secondsLeft + 60
    setIapUsed(true)
    setSecondsLeft(nextSeconds)
    writeStoredTimerSeconds(level.id, nextSeconds)
    setShowTimeExpiredModal(false)
  }

  const resetAllProgressDebug = () => {
    resetAllProgress()
    window.location.assign('/')
  }

  return (
    <section className="puzzle-page card page">
      <header className="puzzle-header">
        <SecondaryButton onClick={() => setShowLeaveDialog(true)}>Back</SecondaryButton>
        <span className="timer-pill" aria-label="Timer">
          {formatTimer(secondsLeft)}
        </span>
        <span className="inventory-chip" aria-label="Live stars">
          Stars: {stars}/3
        </span>
        <BonusCounter found={bonusWords.length} bonusTotal={Math.max(0, level.totalWords - crosswordWordsList.length)} />
        <div className="inventory-strip" aria-label="Inventory">
          <span className="inventory-chip">Coins: {inventory.coins}</span>
          <span className="inventory-chip">Hints: {inventory.hints}</span>
        </div>
        <ProgressBar current={totalFound} total={totalAvailable} label="Words Found" className="puzzle-header-progress" />
      </header>

      <div className="puzzle-main">
        <CrosswordGrid grid={runGrid} />

        <div className="word-wheel-panel">
          <WordWheel wheelLetters={level.wheelLetters} currentWord={currentWord} onCurrentWordChange={setCurrentWord} />

          <div
            key={`current-word-pill-${invalidWordPulse}-${alreadyFoundPulse}`}
            className={`current-word-pill ${invalidWordPulse > 0 ? 'is-invalid' : ''} ${alreadyFoundPulse > 0 ? 'is-found' : ''}`.trim()}
            aria-live="polite"
          >
            {currentWord ? normalizeWord(currentWord) : 'Current Word'}
          </div>

          <div className="word-actions">
            <PrimaryButton onClick={submitWord}>Submit</PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setCurrentWord('')
                setFeedback('')
              }}
            >
              Clear
            </SecondaryButton>
          </div>

          <p className={`puzzle-feedback ${temporaryMessage ? 'is-ephemeral' : ''}`.trim()} aria-live="polite">
            {temporaryMessage || feedback || `Found ${totalFound} words this run`}
          </p>

          <section className="bonus-words-panel" aria-label="Found bonus words">
            <h3>Bonus Words</h3>
            <ul className="bonus-words-list">
              {bonusWords.length === 0 ? (
                <li className="bonus-word-empty">No bonus words yet</li>
              ) : (
                bonusWords.map((word) => (
                  <li key={word} className={`bonus-word-item ${latestBonusWord === word ? 'is-new' : ''}`.trim()}>
                    {word}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>

      {DEBUG_AVAILABLE ? (
        <button type="button" className="puzzle-debug-fab" onClick={() => setShowDebugMenu(true)}>
          D
        </button>
      ) : null}

      <TimeExpiredModal
        open={showTimeExpiredModal}
        coinCost={COIN_COST}
        coins={inventory.coins}
        rewardVideosUsed={rewardVideosUsed}
        iapUsed={iapUsed}
        onRewardVideo={addExtraTimeFromRewardVideo}
        onCoins={addExtraTimeFromCoins}
        onIap={addExtraTimeFromIap}
        onDecline={() => navigate(buildResultsUrl(level.id, totalFound))}
      />

      {showLeaveDialog ? (
        <div className="modal-backdrop" role="presentation">
          <section className="leave-puzzle-modal card" role="dialog" aria-modal="true" aria-labelledby="leave-puzzle-title">
            <h2 id="leave-puzzle-title">Leave level?</h2>
            <p>Leaving now will reset this run's progress and timer until you restart this level.</p>
            <div className="leave-puzzle-actions">
              <PrimaryButton
                onClick={() => {
                  window.localStorage.removeItem(timerStorageKey(level.id))
                  navigate('/')
                }}
              >
                lose progress
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowLeaveDialog(false)}>keep playing</SecondaryButton>
            </div>
          </section>
        </div>
      ) : null}

      {showCompleteDialog ? (
        <div className="modal-backdrop" role="presentation">
          <section className="tier-complete-modal card" role="dialog" aria-modal="true" aria-labelledby="level-complete-title">
            <h2 id="level-complete-title">Congratulations! Level complete.</h2>
            <p>{`Star Mastery: ${stars}/3`}</p>
            <p>{`Words Found: ${totalFound} / ${totalAvailable}`}</p>
            {completionRewards.length > 0 ? (
              <ul className="tier-complete-rewards">
                {completionRewards.map((reward) => (
                  <li key={reward}>{reward}</li>
                ))}
              </ul>
            ) : (
              <p>No rewards earned this run.</p>
            )}
            <div className="tier-complete-actions">
              <SecondaryButton
                onClick={() => {
                  const currentIndex = bonusRushLevels.findIndex((entry) => entry.id === level.id)
                  const nextLevel = currentIndex >= 0 ? bonusRushLevels[currentIndex + 1] : undefined
                  navigate(nextLevel ? `/puzzle/${nextLevel.id}` : buildResultsUrl(level.id, totalFound))
                }}
              >
                Next Level
              </SecondaryButton>
            </div>
          </section>
        </div>
      ) : null}

      {DEBUG_AVAILABLE && showDebugMenu ? (
        <div className="modal-backdrop" role="presentation">
          <section className="puzzle-debug-modal card" role="dialog" aria-modal="true" aria-labelledby="puzzle-debug-title">
            <h2 id="puzzle-debug-title">Debug Commands</h2>
            <div className="puzzle-debug-actions">
              <SecondaryButton onClick={completeCrosswordDebug}>Complete Crossword</SecondaryButton>
              <SecondaryButton onClick={completeBonusDebug}>Complete Bonus</SecondaryButton>
              <SecondaryButton onClick={() => setDebugOutput(JSON.stringify(allowedWordsList, null, 2))}>allowedWords</SecondaryButton>
              <SecondaryButton onClick={() => setDebugOutput(JSON.stringify(crosswordWordsList, null, 2))}>crosswordWords</SecondaryButton>
              <SecondaryButton onClick={() => setDebugOutput(JSON.stringify(missingWords, null, 2))}>missingWords</SecondaryButton>
              <SecondaryButton onClick={() => setShowResetProgressConfirm(true)}>Reset All Progress</SecondaryButton>
            </div>
            <pre className="puzzle-debug-output">{debugOutput || 'Select a command to inspect values.'}</pre>
            <PrimaryButton onClick={() => setShowDebugMenu(false)}>Close</PrimaryButton>
          </section>
        </div>
      ) : null}

      {showResetProgressConfirm ? (
        <div className="modal-backdrop" role="presentation">
          <section className="reset-progress-modal card" role="dialog" aria-modal="true" aria-labelledby="reset-progress-title">
            <h2 id="reset-progress-title">Confirm Reset</h2>
            <p>⚠️ warning: this will delete all progress for all tiers on all levels</p>
            <div className="reset-progress-actions">
              <PrimaryButton
                onClick={() => {
                  resetAllProgressDebug()
                  setShowResetProgressConfirm(false)
                }}
              >
                Reset All Progress
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowResetProgressConfirm(false)}>Cancel</SecondaryButton>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
