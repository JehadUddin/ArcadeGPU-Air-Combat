export class InputManager {
  keys: { [key: string]: boolean } = {}
  mouseX = 0
  mouseY = 0
  mouseDown = false
  rightMouseDown = false
  interactPressed = false

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true
      if (e.code === 'KeyE') this.interactPressed = true
    })
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false
    })
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.mouseX -= e.movementX * 0.002
        this.mouseY += e.movementY * 0.002
        this.mouseY = Math.max(-Math.PI / 6, Math.min(Math.PI / 3, this.mouseY))
      }
    })
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.pointerLockElement) this.mouseDown = true
      if (e.button === 2 && document.pointerLockElement) this.rightMouseDown = true
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false
      if (e.button === 2) this.rightMouseDown = false
    })
    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
  }

  consumeInteract() {
    if (this.interactPressed) {
      this.interactPressed = false
      return true
    }
    return false
  }
}
