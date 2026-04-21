/**
 * fireSparkle(x, y) — launches a burst of coloured particles + ring from (x, y).
 * Works purely via DOM, no canvas needed.
 */

const COLORS = [
  "#7c5cfc", "#4f8eff", "#00d4ff", "#00f5c4",
  "#f040fb", "#ff4d8d", "#ffb830", "#ffffff"
]

export function fireSparkle(x, y) {
  // ring pulse
  const ring = document.createElement("div")
  ring.className = "spark-ring"
  ring.style.cssText = `
    width: 32px; height: 32px;
    left: ${x - 16}px; top: ${y - 16}px;
    border-color: ${COLORS[Math.floor(Math.random() * 3)]};
  `
  document.body.appendChild(ring)
  ring.addEventListener("animationend", () => ring.remove())

  // particles
  const N = 22
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2
    const dist  = 60 + Math.random() * 80
    const dx    = Math.cos(angle) * dist
    const dy    = Math.sin(angle) * dist - 40
    const size  = 4 + Math.random() * 6
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]

    const s = document.createElement("div")
    s.className = "sparkle"
    s.style.cssText = `
      width:  ${size}px;
      height: ${size}px;
      left:   ${x - size / 2}px;
      top:    ${y - size / 2}px;
      background: ${color};
      box-shadow: 0 0 ${size * 2}px ${color};
      --dx: ${dx}px;
      --dy: ${dy}px;
      animation-duration: ${0.6 + Math.random() * 0.5}s;
      animation-delay: ${Math.random() * 0.1}s;
    `
    document.body.appendChild(s)
    s.addEventListener("animationend", () => s.remove())
  }
}

/** Call from a form submit button ref after successful submit */
export function fireSparkleFromEl(el) {
  if (!el) return
  const rect = el.getBoundingClientRect()
  fireSparkle(
    rect.left + rect.width  / 2,
    rect.top  + rect.height / 2
  )
}
