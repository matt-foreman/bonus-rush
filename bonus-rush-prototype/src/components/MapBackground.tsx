interface Point {
  x: number
  y: number
}

interface MapBackgroundProps {
  width: number
  height: number
  nodePoints: Point[]
}

export function MapBackground({ width, height, nodePoints }: MapBackgroundProps) {
  const dots = nodePoints.slice(0, 5)

  return (
    <svg className="br-map-bg-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="brMapGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--br-map-sky-mist)" />
          <stop offset="54%" stopColor="var(--br-map-mint)" />
          <stop offset="100%" stopColor="var(--br-map-sage)" />
        </linearGradient>

        <pattern id="brNoiseDots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.7" fill="var(--br-map-noise-dot)" opacity="0.2" />
          <circle cx="10" cy="7" r="0.7" fill="var(--br-map-noise-dot)" opacity="0.16" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={width} height={height} fill="url(#brMapGradient)" />

      <path
        d={`M -18 ${height * 0.18} C ${width * 0.2} ${height * 0.02}, ${width * 0.48} ${height * 0.26}, ${width * 0.74} ${height * 0.16} C ${width * 0.92} ${height * 0.08}, ${width + 30} ${height * 0.2}, ${width + 30} ${height * 0.26} L ${width + 30} -30 L -30 -30 Z`}
        fill="var(--br-map-cloud-a)"
        opacity="0.28"
      />
      <path
        d={`M -22 ${height * 0.46} C ${width * 0.24} ${height * 0.34}, ${width * 0.5} ${height * 0.54}, ${width * 0.82} ${height * 0.44} C ${width * 0.98} ${height * 0.39}, ${width + 30} ${height * 0.5}, ${width + 30} ${height * 0.58} L ${width + 30} ${height * 0.72} L -30 ${height * 0.68} Z`}
        fill="var(--br-map-cloud-b)"
        opacity="0.24"
      />
      <path
        d={`M -24 ${height * 0.78} C ${width * 0.22} ${height * 0.68}, ${width * 0.46} ${height * 0.86}, ${width * 0.7} ${height * 0.78} C ${width * 0.88} ${height * 0.72}, ${width + 24} ${height * 0.84}, ${width + 24} ${height * 0.96} L ${width + 24} ${height + 26} L -24 ${height + 26} Z`}
        fill="var(--br-map-cloud-c)"
        opacity="0.26"
      />
      <ellipse
        cx={width * 0.28}
        cy={height * 0.3}
        rx={width * 0.2}
        ry={height * 0.07}
        fill="var(--br-map-spot)"
        opacity="0.2"
      />
      <ellipse
        cx={width * 0.72}
        cy={height * 0.66}
        rx={width * 0.24}
        ry={height * 0.09}
        fill="var(--br-map-spot)"
        opacity="0.18"
      />

      <g fill="none" stroke="var(--br-map-contour)" strokeWidth="1.2" opacity="0.22">
        <path d={`M ${width * -0.04} ${height * 0.16} C ${width * 0.18} ${height * 0.05}, ${width * 0.56} ${height * 0.08}, ${width * 1.02} ${height * 0.12}`} />
        <path d={`M ${width * -0.04} ${height * 0.52} C ${width * 0.24} ${height * 0.44}, ${width * 0.64} ${height * 0.58}, ${width * 1.04} ${height * 0.48}`} />
        <path d={`M ${width * -0.05} ${height * 0.84} C ${width * 0.22} ${height * 0.72}, ${width * 0.62} ${height * 0.9}, ${width * 1.06} ${height * 0.8}`} />
      </g>

      <rect x="0" y="0" width={width} height={height} fill="url(#brNoiseDots)" opacity="0.34" />

      <g fill="var(--br-map-highlight-dot)" opacity="0.28">
        {dots.map((point, index) => (
          <circle key={`${point.x}-${point.y}-${index}`} cx={point.x + 10} cy={point.y - 16} r={index % 2 === 0 ? 2.2 : 1.8} />
        ))}
      </g>
    </svg>
  )
}
