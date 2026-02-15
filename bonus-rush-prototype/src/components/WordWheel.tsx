interface WordWheelProps {
  wheelLetters: string[]
  currentWord: string
  onCurrentWordChange: (nextWord: string) => void
  className?: string
}

const FULL_CIRCLE_DEG = 360

export function WordWheel({ wheelLetters, currentWord, onCurrentWordChange, className = '' }: WordWheelProps) {
  const normalized = wheelLetters.map((letter) => letter.toUpperCase())
  const availableCounts = normalized.reduce<Map<string, number>>((acc, letter) => {
    acc.set(letter, (acc.get(letter) ?? 0) + 1)
    return acc
  }, new Map())
  const usedCounts = currentWord
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .split('')
    .reduce<Map<string, number>>((acc, letter) => {
      acc.set(letter, (acc.get(letter) ?? 0) + 1)
      return acc
    }, new Map())

  const appendLetter = (letter: string) => {
    const used = usedCounts.get(letter) ?? 0
    const available = availableCounts.get(letter) ?? 0
    if (used >= available) {
      return
    }
    onCurrentWordChange(`${currentWord}${letter}`)
  }

  if (normalized.length === 0) {
    return <div className={`word-wheel-empty ${className}`.trim()}>No wheel letters</div>
  }

  return (
    <div className={`word-wheel ${className}`.trim()} aria-label="Word wheel">
      <div className="word-wheel-center" aria-hidden="true" />
      {normalized.map((letter, index) => {
        const angle = (index / normalized.length) * FULL_CIRCLE_DEG
        const used = usedCounts.get(letter) ?? 0
        const available = availableCounts.get(letter) ?? 0
        const exhausted = used >= available
        const style = {
          transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0, -98px) rotate(-${angle}deg)`,
        }

        return (
          <button
            key={`${letter}-${index}`}
            type="button"
            className="wheel-letter"
            style={style}
            onClick={() => appendLetter(letter)}
            disabled={exhausted}
            aria-label={`Add ${letter}`}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
