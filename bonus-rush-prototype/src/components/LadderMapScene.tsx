import { useEffect, useMemo, useRef, useState } from 'react'
import mapBackground from '../assets/bonus-rush-map-bg.png'
import { LockedReason } from '../state/storage'
import type { TierName } from '../types/bonusRush'
import { MedalBadge } from './MedalBadge'
import { Tooltip } from './Tooltip'

const IMAGE_WIDTH = 1024
const IMAGE_HEIGHT = 1536
const TOOLTIP_AUTO_CLOSE_MS = 2500
const RESIZE_DEBOUNCE_MS = 100
const DEBUG_MAP = false

interface NodeAnchor {
  level: number
  x: number
  y: number
}

const NODE_ANCHORS: NodeAnchor[] = [
  { level: 1, x: 600, y: 1302 },
  { level: 2, x: 304, y: 1008 },
  { level: 3, x: 813, y: 548 },
  { level: 4, x: 239, y: 202 },
]

interface ScreenPoint {
  left: number
  top: number
}

interface ActiveTooltip {
  text: string
  x: number
  y: number
  placement: 'above' | 'below'
}

export interface LadderMapSceneLevel {
  puzzleId: string
  levelNumber: number
  unlocked: boolean
  lockReason: LockedReason | null
  displayTier: TierName
  displayStars: number
}

interface LadderMapSceneProps {
  levels: LadderMapSceneLevel[]
  onSelectLevel: (puzzleId: string) => void
}

function imageToScreenPoint(containerRect: DOMRect, anchor: NodeAnchor): ScreenPoint {
  const scale = Math.max(containerRect.width / IMAGE_WIDTH, containerRect.height / IMAGE_HEIGHT)
  const drawnW = IMAGE_WIDTH * scale
  const drawnH = IMAGE_HEIGHT * scale
  const offsetX = (containerRect.width - drawnW) / 2
  const offsetY = (containerRect.height - drawnH) / 2

  return {
    left: offsetX + anchor.x * scale,
    top: offsetY + anchor.y * scale,
  }
}

function buildPathD(points: ScreenPoint[]): string {
  if (points.length === 0) {
    return ''
  }
  if (points.length === 1) {
    return `M ${points[0].left} ${points[0].top}`
  }

  let d = `M ${points[0].left} ${points[0].top}`
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]
    const current = points[index]
    const controlX = (prev.left + current.left) / 2
    d += ` Q ${controlX} ${prev.top}, ${current.left} ${current.top}`
  }
  return d
}

export function LadderMapScene({ levels, onSelectLevel }: LadderMapSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const [screenPoints, setScreenPoints] = useState<ScreenPoint[]>([])
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)

  const cappedLevels = useMemo(() => levels.slice(0, NODE_ANCHORS.length), [levels])

  useEffect(() => {
    const computePoints = () => {
      const sceneEl = sceneRef.current
      if (!sceneEl) {
        return
      }

      const rect = sceneEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }

      const points = NODE_ANCHORS.slice(0, cappedLevels.length).map((anchor) => imageToScreenPoint(rect, anchor))
      setScreenPoints(points)
    }

    computePoints()

    let timeoutId: number | null = null
    const debouncedCompute = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(computePoints, RESIZE_DEBOUNCE_MS)
    }

    const resizeObserver = new ResizeObserver(() => {
      debouncedCompute()
    })

    const sceneEl = sceneRef.current
    if (sceneEl) {
      resizeObserver.observe(sceneEl)
    }

    window.addEventListener('resize', debouncedCompute)

    return () => {
      window.removeEventListener('resize', debouncedCompute)
      resizeObserver.disconnect()
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [cappedLevels.length])

  useEffect(() => {
    if (!activeTooltip) {
      return
    }
    const timeout = window.setTimeout(() => setActiveTooltip(null), TOOLTIP_AUTO_CLOSE_MS)
    return () => window.clearTimeout(timeout)
  }, [activeTooltip])

  useEffect(() => {
    if (!activeTooltip) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }
      if (target.closest('.br-node-tooltip') || target.closest('.mapNode.locked')) {
        return
      }
      setActiveTooltip(null)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [activeTooltip])

  const getLockMessage = (reason: LockedReason | null): string => {
    if (reason === LockedReason.WeeklyUnlock) {
      return 'Coming next week'
    }
    return 'Finish the previous level'
  }

  const subtlePathD = useMemo(() => buildPathD(screenPoints), [screenPoints])

  return (
    <div className="mapSceneHost single">
      <div className="mapScene single">
        <div
          ref={sceneRef}
          className="mapSceneContent"
          style={{
            height: '100%',
          }}
        >
          <img className="mapBg" src={mapBackground} alt="" />

          <svg className="mapPathHighlight" aria-hidden="true">
            <path d={subtlePathD} />
          </svg>

          <div className="nodeLayer">
            {cappedLevels.map((level, index) => {
              const point = screenPoints[index]
              if (!point) {
                return null
              }

              const isLocked = !level.unlocked

              return (
                <button
                  key={level.puzzleId}
                  type="button"
                  className={`mapNode ${isLocked ? 'locked' : ''}`}
                  style={{
                    position: 'absolute',
                    left: point.left,
                    top: point.top,
                    transform: 'translate(-50%, -50%)',
                  }}
                  aria-disabled={isLocked}
                  onClick={() => {
                    if (isLocked) {
                      setActiveTooltip({
                        text: getLockMessage(level.lockReason),
                        x: point.left,
                        y: point.top,
                        placement: point.top < 120 ? 'below' : 'above',
                      })
                      return
                    }
                    setActiveTooltip(null)
                    onSelectLevel(level.puzzleId)
                  }}
                >
                  <span className="mapNodeLevel">Lv {level.levelNumber}</span>
                  <MedalBadge tier={level.displayTier} stars={level.displayStars} />
                  {isLocked ? (
                    <span className="mapNodeLockOverlay" aria-hidden="true">
                      <span className="mapNodeLockIcon">🔒</span>
                    </span>
                  ) : null}
                </button>
              )
            })}

            {DEBUG_MAP
              ? screenPoints.map((point, index) => {
                  const anchor = NODE_ANCHORS[index]
                  return (
                    <div key={`debug-${index}`} className="mapDebugMark" style={{ left: `${point.left}px`, top: `${point.top}px` }}>
                      <span className="mapDebugCrosshair" />
                      <span className="mapDebugLabel">sx:{Math.round(point.left)} sy:{Math.round(point.top)}</span>
                      <span className="mapDebugLabel">ix:{anchor.x} iy:{anchor.y}</span>
                    </div>
                  )
                })
              : null}
          </div>

          {activeTooltip ? (
            <Tooltip text={activeTooltip.text} x={activeTooltip.x} y={activeTooltip.y} placement={activeTooltip.placement} />
          ) : null}

          {DEBUG_MAP ? <div className="mapDebugBounds" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  )
}
