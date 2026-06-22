import { useId } from "react"

// Animated SVG lip-sync mouth component
// All paths share the SAME command structure (M…C…C…Z / M…C) so
// browsers can CSS-transition the `d` attribute between viseme states.
//
// ViewBox: 120 × 72   Centre: (60, 36)
// Interior path:  M pt  C 3pts  C 3pts  Z
// Lip edge path:  M pt  C 3pts

const VISEMES = {
  rest: {
    interior: "M 30,36 C 44,32 76,32 90,36 C 76,40 44,40 30,36 Z",
    upper:    "M 28,36 C 44,26 76,26 92,36",
    lower:    "M 28,36 C 44,46 76,46 92,36",
    teeth: false, teethY: 36,
  },
  M: {
    // bilabial — b / m / p  (lips pressed)
    interior: "M 26,36 C 43,33 77,33 94,36 C 77,39 43,39 26,36 Z",
    upper:    "M 24,36 C 42,27 78,27 96,36",
    lower:    "M 24,36 C 42,45 78,45 96,36",
    teeth: false, teethY: 36,
  },
  A: {
    // wide open — "ahh"
    interior: "M 32,38 C 46,20 74,20 88,38 C 74,56 46,56 32,38 Z",
    upper:    "M 30,38 C 44,18 76,18 90,38",
    lower:    "M 30,38 C 44,58 76,58 90,38",
    teeth: true, teethY: 36,
  },
  E: {
    // spread smile — "ee"
    interior: "M 18,34 C 44,27 76,27 102,34 C 76,41 44,41 18,34 Z",
    upper:    "M 16,34 C 44,25 76,25 104,34",
    lower:    "M 16,34 C 44,43 76,43 104,34",
    teeth: true, teethY: 34,
  },
  I: {
    // small spread — "ih" / default talking consonant
    interior: "M 28,35 C 44,27 76,27 92,35 C 76,43 44,43 28,35 Z",
    upper:    "M 26,35 C 44,25 76,25 94,35",
    lower:    "M 26,35 C 44,45 76,45 94,35",
    teeth: true, teethY: 34,
  },
  O: {
    // round — "oh"
    interior: "M 44,36 C 50,18 70,18 76,36 C 70,54 50,54 44,36 Z",
    upper:    "M 42,36 C 49,16 71,16 78,36",
    lower:    "M 42,36 C 49,56 71,56 78,36",
    teeth: false, teethY: 36,
  },
  U: {
    // small round — "oo"
    interior: "M 46,36 C 51,22 69,22 74,36 C 69,50 51,50 46,36 Z",
    upper:    "M 44,36 C 50,20 70,20 76,36",
    lower:    "M 44,36 C 50,52 70,52 76,36",
    teeth: false, teethY: 36,
  },
  F: {
    // labiodental — f / v
    interior: "M 30,34 C 44,25 76,25 90,34 C 76,41 44,41 30,34 Z",
    upper:    "M 28,34 C 44,22 76,22 92,34",
    lower:    "M 28,34 C 44,42 76,42 92,34",
    teeth: true, teethY: 34,
  },
}

export default function MouthViseme({ viseme = "rest", speaking = false }) {
  const uid    = useId()
  const clipId = `mc${uid.replace(/\W/g, "")}`
  const v      = VISEMES[viseme] ?? VISEMES.rest

  return (
    <div
      className="w-28 h-20 rounded-2xl overflow-hidden border flex items-center justify-center shrink-0"
      style={{
        background: "#f7edea",
        borderColor: speaking ? "#2A9D8F" : "#ead4cc",
        boxShadow: speaking ? "0 0 0 2px #2A9D8F33" : undefined,
        transition: "border-color 200ms, box-shadow 200ms",
      }}
    >
      <svg viewBox="0 0 120 72" className="w-full h-full">
        {/* Face background */}
        <ellipse cx="60" cy="38" rx="56" ry="32" fill="#f0d8d0" />

        {/* ClipPath for teeth masking */}
        <defs>
          <clipPath id={clipId}>
            <path d={v.interior} />
          </clipPath>
        </defs>

        {/* Mouth interior (dark) */}
        <path
          d={v.interior}
          fill="#3a0e0e"
          style={{ transition: "d 110ms ease-out" }}
        />

        {/* Teeth — white upper half of mouth, clipped to opening */}
        <rect
          x="0" y="0" width="120" height={v.teethY}
          fill="white"
          clipPath={`url(#${clipId})`}
          opacity={v.teeth ? 0.95 : 0}
          style={{ transition: "opacity 80ms" }}
        />

        {/* Lower lip */}
        <path
          d={v.lower}
          fill="none"
          stroke="#bf6070"
          strokeWidth="8.5"
          strokeLinecap="round"
          style={{ transition: "d 110ms ease-out" }}
        />

        {/* Upper lip */}
        <path
          d={v.upper}
          fill="none"
          stroke="#c87080"
          strokeWidth="7.5"
          strokeLinecap="round"
          style={{ transition: "d 110ms ease-out" }}
        />

        {/* Upper lip highlight */}
        <path
          d={v.upper}
          fill="none"
          stroke="rgba(255,235,235,0.45)"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transition: "d 110ms ease-out" }}
        />
      </svg>
    </div>
  )
}
