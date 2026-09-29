/**
 * Unified input state written by the keyboard, joystick and jump button and
 * read by the player controller every frame.
 */
export const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  /** analog stick vector: x = right, y = forward, length 0..1 */
  stick: { x: 0, y: 0 },
  /** timestamp of the last jump press; the controller consumes it (jump buffering) */
  jumpPressedAt: -1,
}

export function moveVector(): { x: number; y: number; magnitude: number } {
  let x = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let y = (input.forward ? 1 : 0) - (input.backward ? 1 : 0)
  const kb = Math.hypot(x, y)
  if (kb > 0) {
    x /= kb
    y /= kb
    return { x, y, magnitude: 1 }
  }
  const m = Math.hypot(input.stick.x, input.stick.y)
  if (m > 0.001) return { x: input.stick.x / m, y: input.stick.y / m, magnitude: Math.min(1, m) }
  return { x: 0, y: 0, magnitude: 0 }
}

export function pressJump() {
  input.jumpPressedAt = performance.now()
}

export function clearMovement() {
  input.forward = input.backward = input.left = input.right = input.sprint = false
  input.stick.x = input.stick.y = 0
  input.jumpPressedAt = -1
}
