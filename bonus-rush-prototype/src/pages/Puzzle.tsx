import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BonusCounter,
  CrosswordGrid,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  TierBadge,
  TimeExpiredModal,
  WordWheel,
} from '../components'
import { bonusRushPuzzles } from '../data/bonusRush'
import { getInventory, isTierUnlocked, recordRun, type Inventory, updateInventory } from '../state/storage'
import type { TierConfig, TierName } from '../types/bonusRush'
import { canPlaceWord, getSlots, placeWord, type CrosswordSlot } from '../utils/crossword'
import { normalizeWord } from '../utils/wordGame'

const START_TIME_SECONDS = 180
const INVALID_WORD_ANIMATION_MS = 620
const tiers: TierName[] = ['Bronze', 'Silver', 'Gold']
const coinCostByTier: Record<TierName, number> = { Bronze: 50, Silver: 100, Gold: 150 }
const TIMER_STORAGE_PREFIX = 'bonusRush.timerEndsAt'
const DEBUG_AVAILABLE = import.meta.env.DEV

function buildRunGrid(tier: TierConfig): string[][] {
  const fixedLetters = new Set(tier.addedBoardLetters.map((letter) => letter.toUpperCase()))

  return tier.crosswordGrid.map((row) =>
    row.map((cell) => {
      if (cell === '#') {
        return '#'
      }

      const normalized = cell.toUpperCase()
      if (fixedLetters.has(normalized)) {
        return normalized
      }

      return ''
    }),
  )
}

function formatTimer(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function starsForFound(found: number, tier: TierConfig): number {
  if (found >= tier.thresholds.threeStar) {
    return 3
  }
  if (found >= tier.thresholds.twoStar) {
    return 2
  }
  if (found >= tier.thresholds.oneStar) {
    return 1
  }
  return 0
}

function timerStorageKey(puzzleId: string, tier: TierName): string {
  return `${TIMER_STORAGE_PREFIX}.${puzzleId}.${tier}`
}

function readStoredTimerSeconds(puzzleId: string, tier: TierName): number | null {
  const raw = window.localStorage.getItem(timerStorageKey(puzzleId, tier))
  if (!raw) {
    return null
  }

  const endsAt = Number(raw)
  if (!Number.isFinite(endsAt) || endsAt <= 0) {
    window.localStorage.removeItem(timerStorageKey(puzzleId, tier))
    return null
  }

  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  if (remaining === 0) {
    window.localStorage.removeItem(timerStorageKey(puzzleId, tier))
  }
  return remaining
}

function writeStoredTimerSeconds(puzzleId: string, tier: TierName, remainingSeconds: number): void {
  const key = timerStorageKey(puzzleId, tier)
  if (remainingSeconds <= 0) {
    window.localStorage.removeItem(key)
    return
  }

  const endsAt = Date.now() + remainingSeconds * 1000
  window.localStorage.setItem(key, String(endsAt))
}

function getInitialStoredTimerSeconds(puzzleId: string, tier: TierName): number {
  const key = timerStorageKey(puzzleId, tier)
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    writeStoredTimerSeconds(puzzleId, tier, START_TIME_SECONDS)
    return START_TIME_SECONDS
  }

  const endsAt = Number(raw)
  if (!Number.isFinite(endsAt) || endsAt <= 0) {
    window.localStorage.removeItem(key)
    return 0
  }

  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  if (remaining === 0) {
    window.localStorage.removeItem(key)
  }
  return remaining
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
  const [searchParams, setSearchParams] = useSearchParams()

  const puzzle = useMemo(() => bonusRushPuzzles.find((entry) => entry.id === puzzleId), [puzzleId])

  const requestedTier = searchParams.get('tier')
  const resolvedTier = useMemo<TierName>(() => {
    if (!puzzle) {
      return 'Bronze'
    }

    if (tiers.includes(requestedTier as TierName)) {
      const tier = requestedTier as TierName
      if (isTierUnlocked(puzzle.id, tier)) {
        return tier
      }
    }

    return tiers.find((tier) => isTierUnlocked(puzzle.id, tier)) ?? 'Bronze'
  }, [puzzle, requestedTier])

  const [activeTier, setActiveTier] = useState<TierName>(resolvedTier)
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
  const [pausedSeconds, setPausedSeconds] = useState<number | null>(null)
  const [invalidWordPulse, setInvalidWordPulse] = useState(0)
  const [alreadyFoundPulse, setAlreadyFoundPulse] = useState(0)
  const [temporaryMessage, setTemporaryMessage] = useState('')
  const [showDebugMenu, setShowDebugMenu] = useState(false)
  const [debugOutput, setDebugOutput] = useState('')
  const [feedback, setFeedback] = useState('')

  const tierConfig = puzzle?.tiers[activeTier]
  const allowedWordsList = useMemo(
    () => (tierConfig ? tierConfig.allowedWords.map((word) => normalizeWord(word)).filter(Boolean) : []),
    [tierConfig],
  )
  const allowedWordsSet = useMemo(() => new Set(allowedWordsList), [allowedWordsList])
  const crosswordWordsList = useMemo(() => {
    if (!tierConfig?.crosswordWords || tierConfig.crosswordWords.length === 0) {
      return allowedWordsList
    }
    return tierConfig.crosswordWords.map((word) => normalizeWord(word)).filter(Boolean)
  }, [tierConfig, allowedWordsList])
  const crosswordWordsSet = useMemo(() => new Set(crosswordWordsList), [crosswordWordsList])

  useEffect(() => {
    setActiveTier(resolvedTier)
    if (searchParams.get('tier') !== resolvedTier) {
      setSearchParams({ tier: resolvedTier }, { replace: true })
    }
  }, [resolvedTier, puzzleId, searchParams, setSearchParams])

  useEffect(() => {
    if (!puzzle || !tierConfig) {
      return
    }

    setRunGrid(buildRunGrid(tierConfig))
    setCurrentWord('')
    setCrosswordWords([])
    setBonusWords([])
    setLatestBonusWord(null)
    setInventory(getInventory())
    setRewardVideosUsed(0)
    setIapUsed(false)
    setShowTimeExpiredModal(false)
    setInvalidWordPulse(0)
    setAlreadyFoundPulse(0)
    setTemporaryMessage('')
    setShowDebugMenu(false)
    setDebugOutput('')
    setFeedback('')
    setSecondsLeft(getInitialStoredTimerSeconds(puzzle.id, activeTier))
  }, [puzzle, tierConfig, activeTier])

  useEffect(() => {
    if (!tierConfig || !puzzle || secondsLeft <= 0 || showLeaveDialog) {
      return
    }

    const timer = window.setInterval(() => {
      const remaining = readStoredTimerSeconds(puzzle.id, activeTier)
      if (remaining === null) {
        window.clearInterval(timer)
        setSecondsLeft(0)
        return
      }

      setSecondsLeft(remaining)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [tierConfig, activeTier, secondsLeft, puzzle, showLeaveDialog])

  useEffect(() => {
    if (!tierConfig) {
      return
    }

    const foundCount = new Set([...crosswordWords, ...bonusWords]).size
    const levelComplete = foundCount === allowedWordsList.length
    if (secondsLeft === 0 && !levelComplete) {
      setShowTimeExpiredModal(true)
      return
    }

    if (secondsLeft === 0 && levelComplete) {
      const found = foundCount
      const params = new URLSearchParams({
        tier: activeTier,
        found: String(found),
        run: String(Date.now()),
      })
      navigate(`/results/${puzzle?.id ?? ''}?${params.toString()}`)
    }
  }, [secondsLeft, bonusWords, crosswordWords, activeTier, tierConfig, navigate, puzzle?.id, allowedWordsList.length])

  useEffect(() => {
    setCurrentWord('')
  }, [crosswordWords.length, bonusWords.length])

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

    const timeout = window.setTimeout(() => {
      setAlreadyFoundPulse(0)
    }, 560)

    return () => window.clearTimeout(timeout)
  }, [alreadyFoundPulse])

  useEffect(() => {
    if (!temporaryMessage) {
      return
    }

    const timeout = window.setTimeout(() => {
      setTemporaryMessage('')
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [temporaryMessage])

  useEffect(() => {
    if (!DEBUG_AVAILABLE || !tierConfig) {
      return
    }

    if (tierConfig.totalWords !== allowedWordsList.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[BonusRush] totalWords mismatch for ${puzzle?.id ?? 'unknown'} ${activeTier}: totalWords=${tierConfig.totalWords}, allowedWords=${allowedWordsList.length}. Using allowedWords length for completion.`,
      )
    }
  }, [tierConfig, allowedWordsList.length, puzzle?.id, activeTier])

  if (!puzzle || !tierConfig) {
    return (
      <section className="card page">
        <h2>Puzzle not found</h2>
        <SecondaryButton onClick={() => navigate('/')}>Back</SecondaryButton>
      </section>
    )
  }

  const foundWordsAll = new Set([...crosswordWords, ...bonusWords])
  const totalFound = foundWordsAll.size
  const totalAvailable = allowedWordsList.length
  const missingWords = allowedWordsList.filter((word) => !foundWordsAll.has(word))

  const switchTier = (tier: TierName) => {
    if (!isTierUnlocked(puzzle.id, tier)) {
      return
    }

    setSearchParams({ tier })
    setActiveTier(tier)
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

    if (foundWordsAll.has(normalized)) {
      setAlreadyFoundPulse((value) => value + 1)
      setTemporaryMessage('already found')
      setFeedback('')
      setCurrentWord('')
      return
    }

    if (!allowedWordsSet.has(normalized)) {
      rejectWord('Word is not in this tier list.', true)
      return
    }

    const shouldTryCrossword = crosswordWordsSet.has(normalized)
    const matchingSlot = shouldTryCrossword ? findTemplateSlotForWord(tierConfig.crosswordGrid, runGrid, normalized) : null

    if (shouldTryCrossword && matchingSlot) {
      const nextGrid = placeWord(runGrid, normalized, matchingSlot)
      const nextCrosswordWords = [...crosswordWords, normalized]
      const nextFound = new Set([...nextCrosswordWords, ...bonusWords]).size
      setRunGrid(nextGrid)
      setCrosswordWords(nextCrosswordWords)
      setLatestBonusWord(null)
      recordRun(puzzle.id, activeTier, nextFound, starsForFound(nextFound, tierConfig))
      setFeedback(`Filled crossword: ${normalized}`)
    } else {
      const nextBonusWords = [...bonusWords, normalized]
      const nextFound = new Set([...crosswordWords, ...nextBonusWords]).size
      setBonusWords(nextBonusWords)
      setLatestBonusWord(normalized)
      recordRun(puzzle.id, activeTier, nextFound, starsForFound(nextFound, tierConfig))
      setFeedback(`Bonus word found: ${normalized}`)
    }

    setCurrentWord('')
  }

  const closeRunToResults = () => {
    const params = new URLSearchParams({
      tier: activeTier,
      found: String(totalFound),
      run: String(Date.now()),
    })
    navigate(`/results/${puzzle.id}?${params.toString()}`)
  }

  const openLeaveDialog = () => {
    setPausedSeconds(secondsLeft)
    setShowLeaveDialog(true)
  }

  const keepPlaying = () => {
    const resumeSeconds = pausedSeconds ?? secondsLeft
    setSecondsLeft(resumeSeconds)
    writeStoredTimerSeconds(puzzle.id, activeTier, resumeSeconds)
    setShowLeaveDialog(false)
    setPausedSeconds(null)
  }

  const loseProgressAndLeave = () => {
    window.localStorage.removeItem(timerStorageKey(puzzle.id, activeTier))
    setShowLeaveDialog(false)
    setPausedSeconds(null)
    setCurrentWord('')
    setCrosswordWords([])
    setBonusWords([])
    setLatestBonusWord(null)
    setFeedback('')
    navigate('/')
  }

  const addExtraTimeFromRewardVideo = () => {
    if (rewardVideosUsed >= 3) {
      return
    }
    const nextSeconds = secondsLeft + 30
    setRewardVideosUsed((value) => value + 1)
    setSecondsLeft(nextSeconds)
    writeStoredTimerSeconds(puzzle.id, activeTier, nextSeconds)
    setShowTimeExpiredModal(false)
  }

  const addExtraTimeFromCoins = () => {
    const cost = coinCostByTier[activeTier]
    if (inventory.coins < cost) {
      return
    }

    const next = updateInventory({ coins: -cost })
    const nextSeconds = secondsLeft + 30
    setInventory(next)
    setSecondsLeft(nextSeconds)
    writeStoredTimerSeconds(puzzle.id, activeTier, nextSeconds)
    setShowTimeExpiredModal(false)
  }

  const addExtraTimeFromIap = () => {
    if (iapUsed) {
      return
    }
    const nextSeconds = secondsLeft + 60
    setIapUsed(true)
    setSecondsLeft(nextSeconds)
    writeStoredTimerSeconds(puzzle.id, activeTier, nextSeconds)
    setShowTimeExpiredModal(false)
  }

  const fillCrosswordDebug = () => {
    let nextGrid = runGrid
    const nextCrosswordWords = [...crosswordWords]

    for (const word of crosswordWordsList) {
      if (foundWordsAll.has(word)) {
        continue
      }
      const slot = findTemplateSlotForWord(tierConfig.crosswordGrid, nextGrid, word)
      if (!slot) {
        continue
      }
      nextGrid = placeWord(nextGrid, word, slot)
      nextCrosswordWords.push(word)
    }

    const dedupedCrossword = [...new Set(nextCrosswordWords)]
    const nextFound = new Set([...dedupedCrossword, ...bonusWords]).size

    setRunGrid(nextGrid)
    setCrosswordWords(dedupedCrossword)
    setLatestBonusWord(null)
    recordRun(puzzle.id, activeTier, nextFound, starsForFound(nextFound, tierConfig))
  }

  const fillBonusDebug = () => {
    const nextBonus = [...new Set([...bonusWords, ...missingWords])]
    const nextFound = new Set([...crosswordWords, ...nextBonus]).size

    setBonusWords(nextBonus)
    setLatestBonusWord(null)
    recordRun(puzzle.id, activeTier, nextFound, starsForFound(nextFound, tierConfig))
  }

  return (
    <section className={`puzzle-page card page tier-accent-${activeTier.toLowerCase()}`}>
      <header className="puzzle-header">
        <SecondaryButton onClick={openLeaveDialog}>Back</SecondaryButton>
        <TierBadge tier={activeTier} />
        <span className="timer-pill" aria-label="Timer">
          {formatTimer(secondsLeft)}
        </span>
        <BonusCounter found={bonusWords.length} bonusTotal={tierConfig.bonusWordsTotal} />
        <div className="inventory-strip" aria-label="Inventory">
          <span className="inventory-chip">Coins: {inventory.coins}</span>
          <span className="inventory-chip">Hints: {inventory.hints}</span>
        </div>
      </header>

      <ProgressBar current={totalFound} total={totalAvailable} label="Words Found" />

      <div className="tier-tabs" role="tablist" aria-label="Tier selection">
        {tiers.map((tier) => {
          const locked = !isTierUnlocked(puzzle.id, tier)
          return (
            <button
              key={tier}
              type="button"
              role="tab"
              className={`tier-tab ${activeTier === tier ? 'active' : ''}`}
              aria-selected={activeTier === tier}
              disabled={locked}
              onClick={() => switchTier(tier)}
            >
              {tier}
            </button>
          )
        })}
      </div>

      <div className="puzzle-main">
        <CrosswordGrid grid={runGrid} boardOnlyLetters={tierConfig.addedBoardLetters} />

        <div className="word-wheel-panel">
          <WordWheel wheelLetters={tierConfig.wheelLetters} currentWord={currentWord} onCurrentWordChange={setCurrentWord} />

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
        tier={activeTier}
        coins={inventory.coins}
        rewardVideosUsed={rewardVideosUsed}
        iapUsed={iapUsed}
        onRewardVideo={addExtraTimeFromRewardVideo}
        onCoins={addExtraTimeFromCoins}
        onIap={addExtraTimeFromIap}
        onDecline={closeRunToResults}
      />

      {showLeaveDialog ? (
        <div className="modal-backdrop" role="presentation">
          <section className="leave-puzzle-modal card" role="dialog" aria-modal="true" aria-labelledby="leave-puzzle-title">
            <h2 id="leave-puzzle-title">Leave puzzle?</h2>
            <p>Leaving now will reset this run's progress and timer until you restart this level.</p>
            <div className="leave-puzzle-actions">
              <PrimaryButton onClick={loseProgressAndLeave}>lose progress</PrimaryButton>
              <SecondaryButton onClick={keepPlaying}>keep playing</SecondaryButton>
            </div>
          </section>
        </div>
      ) : null}

      {DEBUG_AVAILABLE && showDebugMenu ? (
        <div className="modal-backdrop" role="presentation">
          <section className="puzzle-debug-modal card" role="dialog" aria-modal="true" aria-labelledby="puzzle-debug-title">
            <h2 id="puzzle-debug-title">Debug Commands</h2>
            <div className="puzzle-debug-actions">
              <SecondaryButton onClick={fillCrosswordDebug}>Autofill Puzzle Words</SecondaryButton>
              <SecondaryButton onClick={fillBonusDebug}>Autofill Bonus Words</SecondaryButton>
              <SecondaryButton onClick={() => setDebugOutput(JSON.stringify(allowedWordsList, null, 2))}>allowedWords</SecondaryButton>
              <SecondaryButton onClick={() => setDebugOutput(JSON.stringify(crosswordWordsList, null, 2))}>crosswordWords</SecondaryButton>
              <SecondaryButton
                onClick={() =>
                  setDebugOutput(
                    [
                      `foundCrossword: ${crosswordWords.length}`,
                      `foundBonus: ${bonusWords.length}`,
                      `foundAllWords: ${foundWordsAll.size}`,
                      `totalAvailable: ${totalAvailable}`,
                    ].join('\n'),
                  )
                }
              >
                found counts
              </SecondaryButton>
              <SecondaryButton onClick={() => setDebugOutput(JSON.stringify(missingWords, null, 2))}>missingWords</SecondaryButton>
            </div>
            <pre className="puzzle-debug-output">{debugOutput || 'Select a command to inspect values.'}</pre>
            <PrimaryButton onClick={() => setShowDebugMenu(false)}>Close</PrimaryButton>
          </section>
        </div>
      ) : null}
    </section>
  )
}
