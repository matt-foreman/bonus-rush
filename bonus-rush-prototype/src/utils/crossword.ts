export type SlotDirection = 'horizontal' | 'vertical'

export interface CrosswordSlot {
  row: number
  col: number
  length: number
  direction: SlotDirection
}

const BLOCKED_CELL = '#'
const EMPTY_MARKERS = new Set(['', ' ', '.', '_'])

function normalizeLetter(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '')
}

function isBlocked(value: string): boolean {
  return value === BLOCKED_CELL
}

function isEmpty(value: string): boolean {
  return EMPTY_MARKERS.has(value)
}

function getWordChars(word: string): string[] {
  return normalizeLetter(word).split('')
}

function cloneGrid(grid: string[][]): string[][] {
  return grid.map((row) => [...row])
}

/**
 * Assumptions:
 * - `#` marks blocked cells.
 * - Any non-`#` cell belongs to a slot; prefilled letters and empty markers may coexist.
 * - Empty fillable cells are represented by '', ' ', '.', or '_'.
 * - Slots with length < 2 are ignored.
 */
export function getSlots(grid: string[][]): CrosswordSlot[] {
  const slots: CrosswordSlot[] = []
  const rowCount = grid.length
  const colCount = Math.max(0, ...grid.map((row) => row.length))

  for (let row = 0; row < rowCount; row += 1) {
    let col = 0
    while (col < colCount) {
      const cell = grid[row]?.[col] ?? BLOCKED_CELL
      if (isBlocked(cell)) {
        col += 1
        continue
      }

      const start = col
      while (col < colCount && !isBlocked(grid[row]?.[col] ?? BLOCKED_CELL)) {
        col += 1
      }

      const length = col - start
      if (length >= 2) {
        slots.push({ row, col: start, length, direction: 'horizontal' })
      }
    }
  }

  for (let col = 0; col < colCount; col += 1) {
    let row = 0
    while (row < rowCount) {
      const cell = grid[row]?.[col] ?? BLOCKED_CELL
      if (isBlocked(cell)) {
        row += 1
        continue
      }

      const start = row
      while (row < rowCount && !isBlocked(grid[row]?.[col] ?? BLOCKED_CELL)) {
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

export function canPlaceWord(grid: string[][], word: string, slot: CrosswordSlot): boolean {
  const letters = getWordChars(word)
  if (letters.length !== slot.length) {
    return false
  }

  for (let i = 0; i < slot.length; i += 1) {
    const row = slot.direction === 'vertical' ? slot.row + i : slot.row
    const col = slot.direction === 'horizontal' ? slot.col + i : slot.col
    const current = grid[row]?.[col]

    if (current === undefined || isBlocked(current)) {
      return false
    }

    const existingLetter = normalizeLetter(current)
    const incomingLetter = letters[i]

    if (!isEmpty(current) && existingLetter && existingLetter !== incomingLetter) {
      return false
    }
  }

  return true
}

export function placeWord(grid: string[][], word: string, slot: CrosswordSlot): string[][] {
  if (!canPlaceWord(grid, word, slot)) {
    return cloneGrid(grid)
  }

  const nextGrid = cloneGrid(grid)
  const letters = getWordChars(word)

  for (let i = 0; i < slot.length; i += 1) {
    const row = slot.direction === 'vertical' ? slot.row + i : slot.row
    const col = slot.direction === 'horizontal' ? slot.col + i : slot.col
    nextGrid[row][col] = letters[i]
  }

  return nextGrid
}

export function findMatchingSlot(grid: string[][], word: string): CrosswordSlot | null {
  const letters = getWordChars(word)
  if (letters.length < 2) {
    return null
  }

  const slots = getSlots(grid)
  return slots.find((slot) => slot.length === letters.length && canPlaceWord(grid, word, slot)) ?? null
}
