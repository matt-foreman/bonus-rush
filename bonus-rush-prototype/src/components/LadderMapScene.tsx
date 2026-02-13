import { useEffect, useMemo, useRef, useState } from 'react'
import bonusRushMapWithLogo from '../assets/bonus_rush_map_with_logo_1080x1920.png'
import { LockedReason } from '../state/storage'
import type { TierName } from '../types/bonusRush'
import { MedalBadge } from './MedalBadge'
import { Tooltip } from './Tooltip'

const TOOLTIP_AUTO_CLOSE_MS = 2500
const RESIZE_DEBOUNCE_MS = 100
const DEBUG_AVAILABLE = import.meta.env.DEV

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

interface MappingParams {
  containerW: number
  containerH: number
  naturalW: number
  naturalH: number
  scale: number
  drawnW: number
  drawnH: number
  offsetX: number
  offsetY: number
}

interface DebugCapture {
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

function buildMappingParams(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
  fitMode: 'cover' | 'contain',
): MappingParams {
  const scale =
    fitMode === 'cover'
      ? Math.max(containerW / naturalW, containerH / naturalH)
      : Math.min(containerW / naturalW, containerH / naturalH)

  const drawnW = naturalW * scale
  const drawnH = naturalH * scale
  const offsetX = (containerW - drawnW) / 2
  const offsetY = (containerH - drawnH) / 2

  return {
    containerW,
    containerH,
    naturalW,
    naturalH,
    scale,
    drawnW,
    drawnH,
    offsetX,
    offsetY,
  }
}

function imageToScreen(mapping: MappingParams, x: number, y: number): ScreenPoint {
  return {
    left: mapping.offsetX + x * mapping.scale,
    top: mapping.offsetY + y * mapping.scale,
  }
}

function screenToImage(mapping: MappingParams, cx: number, cy: number): { imageX: number; imageY: number } {
  const imageX = (cx - mapping.offsetX) / mapping.scale
  const imageY = (cy - mapping.offsetY) / mapping.scale

  return {
    imageX: Math.max(0, Math.min(mapping.naturalW, imageX)),
    imageY: Math.max(0, Math.min(mapping.naturalH, imageY)),
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [debugEnabled, setDebugEnabled] = useState(false)
  const [debugContainMode, setDebugContainMode] = useState(false)
  const [debugCapture, setDebugCapture] = useState<DebugCapture | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [screenPoints, setScreenPoints] = useState<ScreenPoint[]>([])
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)

  const cappedLevels = useMemo(() => levels.slice(0, NODE_ANCHORS.length), [levels])
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

  const mapping = useMemo(() => {
    if (!naturalSize || containerSize.width <= 0 || containerSize.height <= 0) {
      return null
    }

    return buildMappingParams(
      containerSize.width,
      containerSize.height,
      naturalSize.width,
      naturalSize.height,
      debugEnabled && debugContainMode ? 'contain' : 'cover',
    )
  }, [containerSize, naturalSize, debugEnabled, debugContainMode])

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
    const computeContainerSize = () => {
      const container = containerRef.current
      if (!container) {
        return
      }

      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }

      setContainerSize({
        width: rect.width,
        height: rect.height,
      })
    }

    computeContainerSize()

    let timeoutId: number | null = null
    const debouncedMeasure = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(computeContainerSize, RESIZE_DEBOUNCE_MS)
    }

    const resizeObserver = new ResizeObserver(() => {
      debouncedMeasure()
    })

    const container = containerRef.current
    if (container) {
      resizeObserver.observe(container)
    }

    window.addEventListener('resize', debouncedMeasure)

    return () => {
      window.removeEventListener('resize', debouncedMeasure)
      resizeObserver.disconnect()
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    if (!mapping) {
      setScreenPoints([])
      return
    }

    const points = cappedLevels.map((level) => {
      const anchor = NODE_ANCHORS.find((entry) => entry.level === level.levelNumber)
      if (!anchor) {
        return { left: mapping.containerW / 2, top: mapping.containerH / 2 }
      }
      return imageToScreen(mapping, anchor.x, anchor.y)
    })

    setScreenPoints(points)
  }, [mapping, cappedLevels])

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
          ref={containerRef}
          className="mapSceneContent"
          style={{
            height: '100%',
          }}
          onClick={(event) => {
            if (!debugEnabled || !mapping) {
              return
            }

            const target = event.target as HTMLElement
            if (target.closest('.mapNode') || target.closest('.debugButton') || target.closest('.mapDebugPanel')) {
              return
            }

            const rect = containerRef.current?.getBoundingClientRect()
            if (!rect) {
              return
            }

            const cx = event.clientX - rect.left
            const cy = event.clientY - rect.top
            const { imageX, imageY } = screenToImage(mapping, cx, cy)

            setDebugCapture({
              containerX: cx,
              containerY: cy,
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
            style={{ objectFit: debugEnabled && debugContainMode ? 'contain' : 'cover', objectPosition: 'center' }}
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
          </div>

          {debugEnabled && mapping ? (
            <>
              <div
                className="mapDebugImageBounds"
                style={{
                  left: mapping.offsetX,
                  top: mapping.offsetY,
                  width: mapping.drawnW,
                  height: mapping.drawnH,
                }}
              />

              {cappedLevels.map((level, index) => {
                const point = screenPoints[index]
                const anchor = NODE_ANCHORS.find((entry) => entry.level === level.levelNumber)
                if (!point || !anchor) {
                  return null
                }

                return (
                  <div key={`debug-point-${level.puzzleId}`} className="mapDebugMark" style={{ left: point.left, top: point.top }}>
                    <span className="mapDebugCrosshair" />
                    <span className="mapDebugLabel">{`L${level.levelNumber} ix:${anchor.x} iy:${anchor.y}`}</span>
                    <span className="mapDebugLabel">{`sx:${Math.round(point.left)} sy:${Math.round(point.top)}`}</span>
                  </div>
                )
              })}

              {debugCapture ? (
                <div
                  className="debugTooltip"
                  style={{
                    left: debugCapture.containerX + 10,
                    top: debugCapture.containerY + 10,
                  }}
                >
                  <div>{`cx:${Math.round(debugCapture.containerX)} cy:${Math.round(debugCapture.containerY)}`}</div>
                  <div>{`ix:${Math.round(debugCapture.imageX)} iy:${Math.round(debugCapture.imageY)}`}</div>
                </div>
              ) : null}

              <div className="mapDebugPanel">
                <div>{`container: ${Math.round(mapping.containerW)} x ${Math.round(mapping.containerH)}`}</div>
                <div>{`natural: ${mapping.naturalW} x ${mapping.naturalH}`}</div>
                <div>{`scale: ${mapping.scale.toFixed(4)}`}</div>
                <div>{`offset: ${Math.round(mapping.offsetX)}, ${Math.round(mapping.offsetY)}`}</div>
                <div>{`drawn: ${Math.round(mapping.drawnW)} x ${Math.round(mapping.drawnH)}`}</div>
                <button
                  type="button"
                  className="mapDebugFitToggle"
                  onClick={() => setDebugContainMode((previous) => !previous)}
                >
                  {debugContainMode ? 'Using contain (debug)' : 'Using cover (debug)'}
                </button>
              </div>
            </>
          ) : null}

          {activeTooltip ? (
            <Tooltip text={activeTooltip.text} x={activeTooltip.x} y={activeTooltip.y} placement={activeTooltip.placement} />
          ) : null}

          {DEBUG_AVAILABLE ? (
            <button
              type="button"
              className="debugButton"
              onClick={() => {
                setDebugEnabled((previous) => !previous)
                setDebugCapture(null)
              }}
            >
              Debug
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
