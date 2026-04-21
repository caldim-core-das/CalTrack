import React, { useEffect, useId, useState } from "react"

export function CalTrackLogo({ size = "md", showTagline = false, className = "" }) {
  const [animated, setAnimated] = useState(false)
  const uid = useId()
  const sandGradId = `ctSandGrad-${uid}`
  const topClipId = `ctTopClip-${uid}`
  const botClipId = `ctBotClip-${uid}`
  const glowId = `ctGlow-${uid}`

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={["ctLogo", `ctLogo-${size}`, animated ? "is-animated" : "", className].filter(Boolean).join(" ")}>
      <svg className="ctCircuitBg" viewBox="0 0 560 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke="rgba(26, 86, 219, 0.18)" strokeWidth="2">
            <path d="M70 60 H150" />
            <path d="M105 60 V32 H170" />
            <path d="M105 60 V88 H170" />
            <path d="M150 60 V20 H205" />
            <path d="M150 60 V100 H205" />
            <circle cx="170" cy="32" r="3" fill="rgba(26, 86, 219, 0.18)" />
            <circle cx="170" cy="88" r="3" fill="rgba(26, 86, 219, 0.18)" />
            <circle cx="205" cy="20" r="3" fill="rgba(26, 86, 219, 0.18)" />
            <circle cx="205" cy="100" r="3" fill="rgba(26, 86, 219, 0.18)" />
          </g>
          <g stroke="rgba(245, 158, 11, 0.18)" strokeWidth="2">
            <path d="M410 60 H490" />
            <path d="M455 60 V32 H520" />
            <path d="M455 60 V88 H520" />
            <path d="M490 60 V20 H540" />
            <path d="M490 60 V100 H540" />
            <circle cx="520" cy="32" r="3" fill="rgba(245, 158, 11, 0.18)" />
            <circle cx="520" cy="88" r="3" fill="rgba(245, 158, 11, 0.18)" />
            <circle cx="540" cy="20" r="3" fill="rgba(245, 158, 11, 0.18)" />
            <circle cx="540" cy="100" r="3" fill="rgba(245, 158, 11, 0.18)" />
          </g>
          <path d="M260 18 V8" stroke="rgba(100, 116, 139, 0.16)" strokeWidth="2" />
          <path d="M300 18 V8" stroke="rgba(100, 116, 139, 0.16)" strokeWidth="2" />
          <circle cx="260" cy="8" r="3" fill="rgba(100, 116, 139, 0.16)" />
          <circle cx="300" cy="8" r="3" fill="rgba(100, 116, 139, 0.16)" />
        </g>
      </svg>
      <div className="ctRow">
        <span className="ctHourglassWrap" aria-hidden="true">
          <svg className="ctHourglassSvg" viewBox="0 0 54 80" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={sandGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
              <linearGradient id={`ctFrameGrad-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0B2B6F" />
                <stop offset="55%" stopColor="#1A56DB" />
                <stop offset="100%" stopColor="#60A5FA" />
              </linearGradient>
              <linearGradient id={`ctFrameWarm-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
              <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0.96  0 1 0 0 0.62  0 0 1 0 0.11  0 0 0 0.65 0"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <clipPath id={topClipId}>
                <path d="M8 4 L46 4 L46 6 Q46 36 27 38 Q8 36 8 6 Z" />
              </clipPath>
              <clipPath id={botClipId}>
                <path d="M8 76 L46 76 L46 74 Q46 44 27 42 Q8 44 8 74 Z" />
              </clipPath>
            </defs>

            <path d="M8 4 L46 4 L46 6 Q46 36 27 40 Q8 36 8 6 Z" fill="none" stroke={`url(#ctFrameGrad-${uid})`} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M8 76 L46 76 L46 74 Q46 44 27 40 Q8 44 8 74 Z" fill="none" stroke={`url(#ctFrameWarm-${uid})`} strokeWidth="2.5" strokeLinejoin="round" />

            <rect x="6" y="2" width="42" height="5" rx="2.5" fill={`url(#ctFrameGrad-${uid})`} />
            <rect x="6" y="73" width="42" height="5" rx="2.5" fill={`url(#ctFrameWarm-${uid})`} />

            <g clipPath={`url(#${topClipId})`} filter={`url(#${glowId})`}>
              <rect className="ctSandTop" x="0" y="0" width="54" height="40" fill={`url(#${sandGradId})`} />
            </g>

            <rect className="ctSandStream" x="25.5" y="38" width="3" height="6" fill="#F59E0B" rx="1.5" />

            <g clipPath={`url(#${botClipId})`} filter={`url(#${glowId})`}>
              <rect className="ctSandPile" x="0" y="40" width="54" height="40" fill={`url(#${sandGradId})`} />
            </g>
          </svg>
        </span>
        <span className="ctWordmark">
          <span className="ctCal">CAL</span>
          <span className="ctTrack">track</span>
        </span>
      </div>

      {showTagline && (
        <>
          <div className="ctUnderline" />
          <div className="ctSubRow">
            <span className="ctTagWord">CHRONOFLOW</span>
            <span className="ctDot" aria-hidden="true" />
            <span className="ctTagline">Workforce Time Suite</span>
          </div>
        </>
      )}
    </div>
  )
}
