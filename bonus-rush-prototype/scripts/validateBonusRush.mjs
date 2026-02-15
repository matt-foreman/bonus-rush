import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dataPath = path.join(rootDir, 'src/data/bonusRush.ts')

async function loadTsModule(filePath) {
  const source = await fs.readFile(filePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    fileName: filePath,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      isolatedModules: true,
    },
  })

  const jsFilePath = path.join(rootDir, '.tmp.validate-bonus-rush.mjs')
  await fs.writeFile(jsFilePath, transpiled.outputText, 'utf8')
  try {
    return await import(`${pathToFileURL(jsFilePath).href}?t=${Date.now()}`)
  } finally {
    await fs.unlink(jsFilePath).catch(() => {})
  }
}

function normalizeWord(input) {
  return String(input).trim().toUpperCase().replace(/[^A-Z]/g, '')
}

function countLetters(letters) {
  const counts = new Map()
  for (const letter of letters) {
    const normalized = normalizeWord(letter)
    if (!normalized) {
      continue
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  return counts
}

function canBuildFromWheel(word, wheelLetters) {
  const needs = countLetters(word.split(''))
  const available = countLetters(wheelLetters)
  for (const [letter, needed] of needs) {
    if ((available.get(letter) ?? 0) < needed) {
      return false
    }
  }
  return true
}

function isBlocked(cell) {
  return cell === '#'
}

function getSlots(grid) {
  const slots = []
  const rows = grid.length
  const cols = Math.max(0, ...grid.map((row) => row.length))

  for (let row = 0; row < rows; row += 1) {
    let col = 0
    while (col < cols) {
      const cell = grid[row]?.[col] ?? '#'
      if (isBlocked(cell)) {
        col += 1
        continue
      }
      const start = col
      while (col < cols && !isBlocked(grid[row]?.[col] ?? '#')) {
        col += 1
      }
      const length = col - start
      if (length >= 2) {
        slots.push({ row, col: start, length, direction: 'horizontal' })
      }
    }
  }

  for (let col = 0; col < cols; col += 1) {
    let row = 0
    while (row < rows) {
      const cell = grid[row]?.[col] ?? '#'
      if (isBlocked(cell)) {
        row += 1
        continue
      }
      const start = row
      while (row < rows && !isBlocked(grid[row]?.[col] ?? '#')) {
        row += 1
      }
      const length = row - start
      if (length >= 2) {
        slots.push({ row: start, col, length, direction: 'vertical' })
      }
    }
  }

  return slots
}

function slotWord(grid, slot) {
  const letters = []
  for (let i = 0; i < slot.length; i += 1) {
    const row = slot.direction === 'vertical' ? slot.row + i : slot.row
    const col = slot.direction === 'horizontal' ? slot.col + i : slot.col
    letters.push(normalizeWord(grid[row]?.[col] ?? ''))
  }
  return normalizeWord(letters.join(''))
}

function validateUniqueWordList(words, label, ctx, errors) {
  const seen = new Set()
  for (const raw of words) {
    const normalized = normalizeWord(raw)
    if (!normalized) {
      errors.push(`${ctx}: ${label} contains an empty/invalid entry`)
      continue
    }
    if (normalized !== raw) {
      errors.push(`${ctx}: ${label} has non-uppercase or non-alpha value "${raw}"`)
    }
    if (normalized.length < 3) {
      errors.push(`${ctx}: ${label} contains word shorter than 3 letters: "${raw}"`)
    }
    if (seen.has(normalized)) {
      errors.push(`${ctx}: ${label} has duplicate word "${raw}"`)
    }
    seen.add(normalized)
  }
  return seen
}

async function main() {
  const mod = await loadTsModule(dataPath)
  const puzzles = mod.bonusRushPuzzles ?? []
  const ladderConfig = mod.bonusRushLadderConfig

  const errors = []
  const warnings = []

  if (!Array.isArray(puzzles) || puzzles.length === 0) {
    errors.push('No puzzles found in bonusRushPuzzles.')
  }

  for (const puzzle of puzzles) {
    const puzzleCtx = `Puzzle ${puzzle.id}`
    const tiers = puzzle.tiers ?? {}
    for (const tierName of ['Bronze', 'Silver', 'Gold']) {
      const tier = tiers[tierName]
      const ctx = `${puzzleCtx} ${tierName}`
      if (!tier) {
        errors.push(`${ctx}: missing tier config`)
        continue
      }

      const allowedWords = Array.isArray(tier.allowedWords) ? tier.allowedWords : []
      const crosswordWords = Array.isArray(tier.crosswordWords) ? tier.crosswordWords : []
      const wheelLetters = Array.isArray(tier.wheelLetters) ? tier.wheelLetters : []
      const grid = Array.isArray(tier.crosswordGrid) ? tier.crosswordGrid : []

      const allowedSet = validateUniqueWordList(allowedWords, 'allowedWords', ctx, errors)
      const crosswordSet = validateUniqueWordList(crosswordWords, 'crosswordWords', ctx, errors)

      for (const word of crosswordSet) {
        if (!allowedSet.has(word)) {
          errors.push(`${ctx}: crosswordWords contains "${word}" which is missing from allowedWords`)
        }
      }

      for (const word of allowedSet) {
        if (!canBuildFromWheel(word, wheelLetters)) {
          errors.push(`${ctx}: allowed word "${word}" cannot be built from wheelLetters`)
        }
      }

      if (tier.totalWords !== allowedSet.size) {
        errors.push(`${ctx}: totalWords (${tier.totalWords}) must equal allowedWords.length (${allowedSet.size})`)
      }

      const expectedBonus = allowedSet.size - crosswordSet.size
      if (tier.bonusWordsTotal !== expectedBonus) {
        errors.push(`${ctx}: bonusWordsTotal (${tier.bonusWordsTotal}) must equal allowed-crossword (${expectedBonus})`)
      }

      const one = tier.thresholds?.oneStar ?? 0
      const two = tier.thresholds?.twoStar ?? 0
      const three = tier.thresholds?.threeStar ?? 0
      if (!(one <= two && two <= three)) {
        errors.push(`${ctx}: thresholds must be ordered oneStar <= twoStar <= threeStar`)
      }
      if (three > allowedSet.size) {
        errors.push(`${ctx}: thresholds.threeStar (${three}) cannot exceed totalWords (${allowedSet.size})`)
      }

      const slotWords = getSlots(grid)
        .map((slot) => slotWord(grid, slot))
        .filter((word) => word.length >= 3)
      const slotWordSet = new Set(slotWords)

      for (const crosswordWord of crosswordSet) {
        if (!slotWordSet.has(crosswordWord)) {
          errors.push(`${ctx}: crossword word "${crosswordWord}" does not match any >=3-letter slot in crosswordGrid`)
        }
      }

      for (const gridWord of slotWordSet) {
        if (!crosswordSet.has(gridWord)) {
          warnings.push(`${ctx}: crosswordGrid has fillable word "${gridWord}" not listed in crosswordWords`)
        }
      }
    }
  }

  if (ladderConfig?.unlocks) {
    const puzzleIds = new Set(puzzles.map((puzzle) => puzzle.id))
    for (const unlock of ladderConfig.unlocks) {
      if (!puzzleIds.has(unlock.puzzleId)) {
        errors.push(`Ladder unlock references unknown puzzleId "${unlock.puzzleId}"`)
      }
    }
  }

  if (warnings.length > 0) {
    console.log('Warnings:')
    for (const warning of warnings) {
      console.log(`- ${warning}`)
    }
  }

  if (errors.length > 0) {
    console.error('Bonus Rush validation failed:')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(`Bonus Rush validation passed (${puzzles.length} puzzles checked).`)
}

main().catch((error) => {
  console.error('Bonus Rush validation crashed:', error)
  process.exit(1)
})

