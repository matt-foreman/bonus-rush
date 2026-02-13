import { useEffect, useMemo, useRef, useState } from 'react'
import bonusRushMapWithLogo from '../assets/bonus_rush_map_with_logo_1080x1920.png'
import { LockedReason } from '../state/storage'
import type { TierName } from '../types/bonusRush'
import { MedalBadge } from './MedalBadge'
import { Tooltip } from './Tooltip'

const TOOLTIP_AUTO_CLOSE_MS = 2500
const RESIZE_DEBOUNCE_MS = 100
const DEBUG_MAP = true

interface NodeAnchor {
  level: number
  x: number
  y: number
}

const NODE_ANCHORS: NodeAnchor[] = [
  { level: 1, x: 385, y: 1320 },
  { level: 2, x: 638, y: 1151 },
  { level: 3, x: 543, y: 814 },
  { level: 4, x: 692, y: 470 },
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

interface Sparkle {
  id: number
  x: string
  y: string
  delay: string
}

interface PlacementPoint {
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

function imageToScreenPoint(containerRect: DOMRect, naturalWidth: number, naturalHeight: number, anchor: NodeAnchor): ScreenPoint {
  const scale = Math.max(containerRect.width / naturalWidth, containerRect.height / naturalHeight)
  const drawnW = naturalWidth * scale
  const drawnH = naturalHeight * scale
  const offsetX = (containerRect.width - drawnW) / 2
  const offsetY = (containerRect.height - drawnH) / 2

  return {
    left: offsetX + anchor.x * scale,
    top: offsetY + anchor.y * scale,
  }
}

function screenToImagePoint(
  containerRect: DOMRect,
  naturalWidth: number,
  naturalHeight: number,
  mouseX: number,
  mouseY: number,
): { imageX: number; imageY: number } {
  const scale = Math.max(containerRect.width / naturalWidth, containerRect.height / naturalHeight)
  const drawnW = naturalWidth * scale
  const drawnH = naturalHeight * scale
  const offsetX = (containerRect.width - drawnW) / 2
  const offsetY = (containerRect.height - drawnH) / 2

  const imageX = (mouseX - offsetX) / scale
  const imageY = (mouseY - offsetY) / scale

  return {
    imageX: Math.max(0, Math.min(naturalWidth, imageX)),
    imageY: Math.max(0, Math.min(naturalHeight, imageY)),
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
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [nodeAnchors, setNodeAnchors] = useState<NodeAnchor[]>(NODE_ANCHORS)
  const [placementMode, setPlacementMode] = useState(false)
  const [placementPoint, setPlacementPoint] = useState<PlacementPoint | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [screenPoints, setScreenPoints] = useState<ScreenPoint[]>([])
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)

  const cappedLevels = useMemo(() => levels.slice(0, nodeAnchors.length), [levels, nodeAnchors.length])
  const sparkles = useMemo<Sparkle[]>(
    () =>
      Array.from({ length: 10 }).map((_, index) => ({
        id: index,
        x: `${20 + Math.random() * 60}%`,
        y: `${20 + Math.random() * 180}px`,
        delay: `${Math.random() * 2.5}s`,
      })),
    [],
  )

  useEffect(() => {
    const imageEl = imgRef.current
    if (imageEl && imageEl.complete && imageEl.naturalWidth > 0 && imageEl.naturalHeight > 0) {
      setNaturalSize({
        width: imageEl.naturalWidth,
        height: imageEl.naturalHeight,
      })
    }
  }, [])

  useEffect(() => {
    const computePoints = () => {
      const sceneEl = sceneRef.current
      const imageEl = imgRef.current
      if (!sceneEl || !imageEl) {
        return
      }

      const rect = sceneEl.getBoundingClientRect()
      const naturalWidth = imageEl.naturalWidth || naturalSize?.width || 0
      const naturalHeight = imageEl.naturalHeight || naturalSize?.height || 0
      if (rect.width <= 0 || rect.height <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
        return
      }

      const points = cappedLevels.map((level) => {
        const anchor = nodeAnchors.find((entry) => entry.level === level.levelNumber)
        if (!anchor) {
          return { left: rect.width / 2, top: rect.height / 2 }
        }
        return imageToScreenPoint(rect, naturalWidth, naturalHeight, anchor)
      })
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
  }, [cappedLevels, nodeAnchors, naturalSize])

  useEffect(() => {
    if (!activeTooltip) {
      return
    }
    const timeout = window.setTimeout(() => setActiveTooltip(null), TOOLTIP_AUTO_CLOSE_MS)
    return () => window.clearTimeout(timeout)
  }, [activeTooltip])

  useEffect(() => {
    if (!copyStatus) {
      return
    }
    const timeout = window.setTimeout(() => setCopyStatus(''), 1500)
    return () => window.clearTimeout(timeout)
  }, [copyStatus])

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
          onClick={(event) => {
            if (!placementMode) {
              return
            }

            const target = event.target as HTMLElement
            if (
              target.closest('.mapNode') ||
              target.closest('.debugButton') ||
              target.closest('.debugTooltipPanel') ||
              target.closest('.debugAssignRow') ||
              target.closest('.debugPanel')
            ) {
              return
            }

            const container = sceneRef.current
            if (!container) {
              return
            }

            const rect = container.getBoundingClientRect()
            const imageEl = imgRef.current
            const naturalWidth = imageEl?.naturalWidth || naturalSize?.width || 0
            const naturalHeight = imageEl?.naturalHeight || naturalSize?.height || 0
            if (naturalWidth <= 0 || naturalHeight <= 0) {
              return
            }
            const mouseX = event.clientX - rect.left
            const mouseY = event.clientY - rect.top
            const { imageX, imageY } = screenToImagePoint(rect, naturalWidth, naturalHeight, mouseX, mouseY)

            setPlacementPoint({
              containerX: mouseX,
              containerY: mouseY,
              imageX,
              imageY,
            })
          }}
        >
          <img
            ref={imgRef}
            className="mapBg"
            src={bonusRushMapWithLogo}
            alt="Bonus Rush Map"
            onLoad={(event) => {
              setNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }}
          />

          <div className="sparkleLayer" aria-hidden="true">
            {sparkles.map((sparkle) => (
              <div
                key={sparkle.id}
                className="sparkle"
                style={{
                  left: sparkle.x,
                  top: sparkle.y,
                  animationDelay: sparkle.delay,
                }}
              />
            ))}
          </div>

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
              ? cappedLevels.map((level, index) => {
                  const point = screenPoints[index]
                  const anchor = nodeAnchors.find((entry) => entry.level === level.levelNumber)
                  if (!point || !anchor) {
                    return null
                  }
                  return (
                    <div
                      key={`debug-${level.puzzleId}`}
                      className="mapDebugMark"
                      style={{ left: `${point.left}px`, top: `${point.top}px` }}
                    >
                      <span className="mapDebugCrosshair" />
                      <span className="mapDebugLabel">sx:{Math.round(point.left)} sy:{Math.round(point.top)}</span>
                      <span className="mapDebugLabel">ix:{anchor.x} iy:{anchor.y}</span>
                    </div>
                  )
                })
              : null}
          </div>

          {placementMode && placementPoint ? (
            <>
              <div
                className="debugMarker"
                style={{
                  left: `${placementPoint.containerX}px`,
                  top: `${placementPoint.containerY}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              />

              <div
                className="debugTooltip debugTooltipPanel"
                style={{
                  left: `${placementPoint.containerX + 12}px`,
                  top: `${placementPoint.containerY + 10}px`,
                }}
              >
                <div>{`containerX: ${Math.round(placementPoint.containerX)}, containerY: ${Math.round(placementPoint.containerY)}`}</div>
                <div>{`imageX: ${Math.round(placementPoint.imageX)}, imageY: ${Math.round(placementPoint.imageY)}`}</div>
              </div>

              <div
                className="debugAssignRow"
                style={{
                  left: `${placementPoint.containerX + 12}px`,
                  top: `${placementPoint.containerY + 60}px`,
                }}
              >
                {[1, 2, 3, 4].map((levelNumber) => (
                  <button
                    key={`set-level-${levelNumber}`}
                    type="button"
                    className="debugAssignButton"
                    onClick={() => {
                      setNodeAnchors((previous) =>
                        previous.map((anchor) =>
                          anchor.level === levelNumber
                            ? {
                                level: levelNumber,
                                x: Math.round(placementPoint.imageX),
                                y: Math.round(placementPoint.imageY),
                              }
                            : anchor,
                        ),
                      )
                    }}
                  >
                    {`Set as Level ${levelNumber}`}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {activeTooltip ? (
            <Tooltip text={activeTooltip.text} x={activeTooltip.x} y={activeTooltip.y} placement={activeTooltip.placement} />
          ) : null}

          {DEBUG_MAP && placementMode ? <div className="mapDebugBounds" aria-hidden="true" /> : null}

          {DEBUG_MAP ? (
            <button
              type="button"
              className="debugButton"
              onClick={() => {
                setPlacementMode((previous) => !previous)
                setPlacementPoint(null)
              }}
            >
              ⚙️
            </button>
          ) : null}

          {DEBUG_MAP && placementMode ? (
            <div className="debugPanel">
              <button
                type="button"
                className="debugCopyButton"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(nodeAnchors, null, 2))
                    setCopyStatus('Copied')
                  } catch {
                    setCopyStatus('Copy failed')
                  }
                }}
              >
                Copy Anchors
              </button>
              {copyStatus ? <span className="debugCopyStatus">{copyStatus}</span> : null}
              <pre>{JSON.stringify(nodeAnchors, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
