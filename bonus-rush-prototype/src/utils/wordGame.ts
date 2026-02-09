const allowedWordsCache = new WeakMap<string[], Set<string>>()

function getAllowedWordsSet(allowedWords: string[]): Set<string> {
  const cached = allowedWordsCache.get(allowedWords)
  if (cached) {
    return cached
  }

  const next = new Set(allowedWords.map((word) => normalizeWord(word)))
  allowedWordsCache.set(allowedWords, next)
  return next
}

function countLetters(letters: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const letter of letters) {
    const normalized = normalizeWord(letter)
    if (!normalized) {
      continue
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  return counts
}

/**
 * Assumptions:
 * - Inputs are English alpha characters; normalization removes non A-Z chars.
 * - `wheelLetters` entries are single letters, but multi-char values are normalized as-is.
 * - Empty/invalid normalized words are treated as invalid.
 */
export function normalizeWord(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, '')
}

export function isValidWord(word: string, wheelLetters: string[]): boolean {
  const normalizedWord = normalizeWord(word)
  if (!normalizedWord) {
    return false
  }

  const availableCounts = countLetters(wheelLetters)
  const usedCounts = countLetters(normalizedWord.split(''))

  for (const [letter, used] of usedCounts.entries()) {
    if (used > (availableCounts.get(letter) ?? 0)) {
      return false
    }
  }

  return true
}

export function isAllowedWord(word: string, allowedWords: string[]): boolean {
  const normalizedWord = normalizeWord(word)
  if (!normalizedWord) {
    return false
  }

  return getAllowedWordsSet(allowedWords).has(normalizedWord)
}
