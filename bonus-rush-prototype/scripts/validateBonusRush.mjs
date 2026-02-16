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
  const levels = mod.bonusRushLevels ?? []
  const ladderConfig = mod.bonusRushLadderConfig

  const errors = []
  const warnings = []

  if (!Array.isArray(levels) || levels.length === 0) {
    errors.push('No levels found in bonusRushLevels.')
  }

  for (const level of levels) {
    const ctx = `Level ${level.id}`
    const allowedWords = Array.isArray(level.allowedWords) ? level.allowedWords : []
    const crosswordWords = Array.isArray(level.crosswordWords) ? level.crosswordWords : []
    const bonusWords = Array.isArray(level.bonusWords) ? level.bonusWords : []
    const wheelLetters = Array.isArray(level.wheelLetters) ? level.wheelLetters : []
    const grid = Array.isArray(level.crosswordGrid) ? level.crosswordGrid : []

    const allowedSet = validateUniqueWordList(allowedWords, 'allowedWords', ctx, errors)
    const crosswordSet = validateUniqueWordList(crosswordWords, 'crosswordWords', ctx, errors)
    const bonusSet = validateUniqueWordList(bonusWords, 'bonusWords', ctx, errors)

    for (const word of crosswordSet) {
      if (!allowedSet.has(word)) {
        errors.push(`${ctx}: crosswordWords contains "${word}" which is missing from allowedWords`)
      }
    }
    for (const word of bonusSet) {
      if (!allowedSet.has(word)) {
        errors.push(`${ctx}: bonusWords contains "${word}" which is missing from allowedWords`)
      }
      if (crosswordSet.has(word)) {
        errors.push(`${ctx}: word "${word}" cannot appear in both crosswordWords and bonusWords`)
      }
    }

    const expectedAllowed = new Set([...crosswordSet, ...bonusSet])
    for (const word of expectedAllowed) {
      if (!allowedSet.has(word)) {
        errors.push(`${ctx}: allowedWords missing "${word}" from crosswordWords/bonusWords`)
      }
    }
    for (const word of allowedSet) {
      if (!expectedAllowed.has(word)) {
        errors.push(`${ctx}: allowedWords includes "${word}" not present in crosswordWords or bonusWords`)
      }
    }

    for (const word of allowedSet) {
      if (!canBuildFromWheel(word, wheelLetters)) {
        errors.push(`${ctx}: allowed word "${word}" cannot be built from wheelLetters`)
      }
    }

    if (level.totalWords !== allowedSet.size) {
      errors.push(`${ctx}: totalWords (${level.totalWords}) must equal allowedWords.length (${allowedSet.size})`)
    }

    const onePct = level.starThresholdsPct?.oneStar ?? 0
    const twoPct = level.starThresholdsPct?.twoStar ?? 0
    const threePct = level.starThresholdsPct?.threeStar ?? 0
    if (!(onePct <= twoPct && twoPct <= threePct)) {
      errors.push(`${ctx}: starThresholdsPct must be ordered oneStar <= twoStar <= threeStar`)
    }
    if (threePct > 1) {
      errors.push(`${ctx}: starThresholdsPct.threeStar (${threePct}) cannot exceed 1`)
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

  if (ladderConfig?.unlocks) {
    const levelIds = new Set(levels.map((level) => level.id))
    for (const unlock of ladderConfig.unlocks) {
      if (!levelIds.has(unlock.levelId)) {
        errors.push(`Ladder unlock references unknown levelId "${unlock.levelId}"`)
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

  console.log(`Bonus Rush validation passed (${levels.length} levels checked).`)
}

main().catch((error) => {
  console.error('Bonus Rush validation crashed:', error)
  process.exit(1)
})
