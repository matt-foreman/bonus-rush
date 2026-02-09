interface CrosswordGridProps {
  grid: string[][]
  boardOnlyLetters?: string[]
  className?: string
}

export function CrosswordGrid({ grid, boardOnlyLetters = [], className = '' }: CrosswordGridProps) {
  const boardOnly = new Set(boardOnlyLetters.map((letter) => letter.toUpperCase()))

  if (grid.length === 0) {
    return <div className={`crossword-grid-empty ${className}`.trim()}>No grid available</div>
  }

  return (
    <div className={`crossword-grid ${className}`.trim()} role="grid" aria-label="Crossword board">
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="crossword-row" role="row">
          {row.map((cell, columnIndex) => {
            if (cell === '#') {
              return <span key={columnIndex} className="crossword-cell blocked" aria-hidden="true" />
            }

            const normalized = cell.toUpperCase()
            const boardOnlyCell = boardOnly.has(normalized)

            return (
              <span
                key={columnIndex}
                role="gridcell"
                className={`crossword-cell tile ${boardOnlyCell ? 'board-only' : ''}`}
                aria-label={boardOnlyCell ? `${normalized} board letter` : normalized}
              >
                {normalized}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
