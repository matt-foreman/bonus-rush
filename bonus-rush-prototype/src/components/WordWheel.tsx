interface WordWheelProps {
  wheelLetters: string[]
  currentWord: string
  onCurrentWordChange: (nextWord: string) => void
  className?: string
}

const FULL_CIRCLE_DEG = 360

export function WordWheel({ wheelLetters, currentWord, onCurrentWordChange, className = '' }: WordWheelProps) {
  const normalized = wheelLetters.map((letter) => letter.toUpperCase())

  const appendLetter = (letter: string) => {
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
            aria-label={`Add ${letter}`}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
