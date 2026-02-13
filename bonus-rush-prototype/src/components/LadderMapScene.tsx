import { useEffect, useMemo, useRef, useState } from 'react'
import mapBackground from '../assets/bonus-rush-map-bg.png'
import { LockedReason } from '../state/storage'
import type { TierName } from '../types/bonusRush'
import { MedalBadge } from './MedalBadge'
import { Tooltip } from './Tooltip'

const IMAGE_NATURAL_WIDTH = 1024
const IMAGE_NATURAL_HEIGHT = 1536
const TOOLTIP_AUTO_CLOSE_MS = 2500
const RESIZE_DEBOUNCE_MS = 100
const DEBUG_MAP = true

const DEFAULT_NODE_ANCHORS: NodeAnchor[] = [
  { level: 1, x: 185, y: 1180 },
  { level: 2, x: 865, y: 1025 },
  { level: 3, x: 555, y: 430 },
  { level: 4, x: 595, y: 730 },
]

interface NodeAnchor {
  level: number
  x: number
  y: number
}

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

interface PlacementMarker {
  containerX: number
  containerY: number
  imageX: number
  imageY: number
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

function imageToScreenPoint(
  imgNaturalW: number,
  imgNaturalH: number,
  containerRect: DOMRect,
  x: number,
  y: number,
): ScreenPoint {
  const scale = Math.max(containerRect.width / imgNaturalW, containerRect.height / imgNaturalH)
  const drawnW = imgNaturalW * scale
  const drawnH = imgNaturalH * scale
  const offsetX = (containerRect.width - drawnW) / 2
  const offsetY = (containerRect.height - drawnH) / 2

  return {
    left: offsetX + x * scale,
    top: offsetY + y * scale,
  }
}

function screenToImagePoint(
  imgNaturalW: number,
  imgNaturalH: number,
  containerRect: DOMRect,
  containerX: number,
  containerY: number,
): { imageX: number; imageY: number } {
  const scale = Math.max(containerRect.width / imgNaturalW, containerRect.height / imgNaturalH)
  const drawnW = imgNaturalW * scale
  const drawnH = imgNaturalH * scale
  const offsetX = (containerRect.width - drawnW) / 2
  const offsetY = (containerRect.height - drawnH) / 2

  const imageX = (containerX - offsetX) / scale
  const imageY = (containerY - offsetY) / scale

  return {
    imageX: Math.max(0, Math.min(imgNaturalW, imageX)),
    imageY: Math.max(0, Math.min(imgNaturalH, imageY)),
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

function buildAnchors(count: number, baseAnchors: NodeAnchor[]): NodeAnchor[] {
  if (count <= baseAnchors.length) {
    return baseAnchors.slice(0, count)
  }

  const anchors = [...baseAnchors]
  for (let index = baseAnchors.length; index < count; index += 1) {
    const step = index - baseAnchors.length + 1
    anchors.push({
      level: index + 1,
      x: 540 + Math.sin(index * 0.9) * 210,
      y: 730 - step * 235,
    })
  }
  return anchors
}

export function LadderMapScene({ levels, onSelectLevel }: LadderMapSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const [nodeAnchors, setNodeAnchors] = useState<NodeAnchor[]>(DEFAULT_NODE_ANCHORS)
  const [placementMode, setPlacementMode] = useState(false)
  const [placementMarker, setPlacementMarker] = useState<PlacementMarker | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [screenPoints, setScreenPoints] = useState<ScreenPoint[]>([])
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)

  const isSingleScreen = levels.length <= 4
  const anchors = useMemo(() => buildAnchors(levels.length, nodeAnchors), [levels.length, nodeAnchors])
  const extraHeightPx = Math.max(0, levels.length - 4) * 220

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

      const points = anchors.map((anchor) =>
        imageToScreenPoint(IMAGE_NATURAL_WIDTH, IMAGE_NATURAL_HEIGHT, rect, anchor.x, anchor.y),
      )

      setScreenPoints(points)
    }

    computePoints()

    let timeoutId: number | null = null
    const onResize = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(computePoints, RESIZE_DEBOUNCE_MS)
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [anchors])

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

  useEffect(() => {
    if (!copyFeedback) {
      return
    }
    const timeout = window.setTimeout(() => setCopyFeedback(null), 1500)
    return () => window.clearTimeout(timeout)
  }, [copyFeedback])

  const getLockMessage = (reason: LockedReason | null): string => {
    if (reason === LockedReason.WeeklyUnlock) {
      return 'Coming next week'
    }
    return 'Finish the previous level'
  }

  const subtlePathD = useMemo(() => buildPathD(screenPoints.slice(0, levels.length)), [screenPoints, levels.length])
  const displayedAnchors = anchors.slice(0, Math.min(levels.length, 4))

  const copyAnchors = async () => {
    const payload = JSON.stringify(displayedAnchors, null, 2)
    try {
      await navigator.clipboard.writeText(payload)
      setCopyFeedback('Copied')
    } catch {
      setCopyFeedback('Copy failed')
    }
  }

  return (
    <div className={`mapSceneHost ${isSingleScreen ? 'single' : 'multi'}`}>
      <div className={`mapScene ${isSingleScreen ? 'single' : 'multi'}`}>
        <div
          ref={sceneRef}
          className="mapSceneContent"
          style={{
            height: isSingleScreen ? '100%' : `calc(100% + ${extraHeightPx}px)`,
          }}
          onClick={(event) => {
            if (!placementMode) {
              return
            }
            const target = event.target as HTMLElement | null
            if (target?.closest('.mapNode') || target?.closest('.mapPlacementPanel') || target?.closest('.mapPlacementToggle')) {
              return
            }

            const rect = event.currentTarget.getBoundingClientRect()
            const containerX = event.clientX - rect.left
            const containerY = event.clientY - rect.top
            const { imageX, imageY } = screenToImagePoint(
              IMAGE_NATURAL_WIDTH,
              IMAGE_NATURAL_HEIGHT,
              rect,
              containerX,
              containerY,
            )

            setPlacementMarker({
              containerX,
              containerY,
              imageX: Math.round(imageX),
              imageY: Math.round(imageY),
            })
          }}
        >
          <img className="mapBg" src={mapBackground} alt="" />

          <svg className="mapOverlay" viewBox={`0 0 ${IMAGE_NATURAL_WIDTH} ${IMAGE_NATURAL_HEIGHT}`} aria-hidden="true">
            <path
              id="dirtPath"
              d="M 230 1480 C 210 1290, 430 1180, 700 1030 C 892 922, 882 756, 676 640 C 502 542, 474 456, 562 382 C 616 334, 664 256, 676 192"
              fill="none"
              stroke={DEBUG_MAP && placementMode ? 'rgba(56, 118, 88, 0.85)' : 'transparent'}
              strokeWidth={DEBUG_MAP && placementMode ? 8 : 0}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <svg className="mapPathHighlight" aria-hidden="true">
            <path d={subtlePathD} />
          </svg>

          <div className="nodeLayer">
            {levels.map((level, index) => {
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
                  style={{ left: `${point.left}px`, top: `${point.top}px`, transform: 'translate(-50%, -50%)' }}
                  aria-disabled={isLocked}
                  onClick={() => {
                    if (placementMode) {
                      return
                    }
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

            {DEBUG_MAP && placementMode
              ? screenPoints.map((point, index) => (
                  <div key={`debug-${index}`} className="mapDebugMark" style={{ left: `${point.left}px`, top: `${point.top}px` }}>
                    <span className="mapDebugDot" />
                    <span className="mapDebugLabel">
                      L{index + 1} ({Math.round(point.left)},{Math.round(point.top)})
                    </span>
                  </div>
                ))
              : null}

            {DEBUG_MAP && placementMode && placementMarker ? (
              <div className="mapPlacementMarker" style={{ left: placementMarker.containerX, top: placementMarker.containerY }}>
                <span className="mapPlacementMarkerDot" />
                <div className="mapPlacementTooltip">
                  <span>{`container: ${Math.round(placementMarker.containerX)}, ${Math.round(placementMarker.containerY)}`}</span>
                  <span>{`image: ${placementMarker.imageX}, ${placementMarker.imageY}`}</span>
                </div>
              </div>
            ) : null}
          </div>

          {activeTooltip ? (
            <Tooltip text={activeTooltip.text} x={activeTooltip.x} y={activeTooltip.y} placement={activeTooltip.placement} />
          ) : null}

          {DEBUG_MAP && placementMode ? <div className="mapDebugBounds" aria-hidden="true" /> : null}

          {DEBUG_MAP ? (
            <button
              type="button"
              className={`mapPlacementToggle ${placementMode ? 'is-active' : ''}`}
              onClick={() => {
                setPlacementMode((prev) => !prev)
                setPlacementMarker(null)
              }}
              aria-label="Toggle Placement Mode"
              title="Placement Mode"
            >
              ⚙
            </button>
          ) : null}

          {DEBUG_MAP && placementMode ? (
            <div className="mapPlacementPanel">
              <div className="mapPlacementTitle">Placement Mode</div>
              <div className="mapPlacementActions">
                {[1, 2, 3, 4].map((levelNumber) => (
                  <button
                    key={`assign-${levelNumber}`}
                    type="button"
                    className="mapPlacementAction"
                    disabled={!placementMarker}
                    onClick={() => {
                      if (!placementMarker) {
                        return
                      }
                      setNodeAnchors((prev) => {
                        const next = [...prev]
                        next[levelNumber - 1] = {
                          level: levelNumber,
                          x: placementMarker.imageX,
                          y: placementMarker.imageY,
                        }
                        return next
                      })
                    }}
                  >
                    {`Set as Level ${levelNumber}`}
                  </button>
                ))}
              </div>

              <button type="button" className="mapPlacementCopy" onClick={copyAnchors}>
                Copy Anchors
              </button>
              {copyFeedback ? <div className="mapPlacementFeedback">{copyFeedback}</div> : null}

              <div className="mapPlacementAnchors">
                {displayedAnchors.map((anchor) => (
                  <div key={`anchor-${anchor.level}`} className="mapPlacementAnchorRow">
                    <span>{`L${anchor.level}`}</span>
                    <span>{`x:${Math.round(anchor.x)} y:${Math.round(anchor.y)}`}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
