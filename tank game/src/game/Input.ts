export class Input {
  keys: Record<string, boolean> = {};
  justPressed: Record<string, boolean> = {};
  mouseDelta = { x: 0, y: 0 };
  isLocked = false;

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    this.justPressed[e.code] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.isLocked) {
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.keys['Mouse0'] = true;
      this.justPressed['Mouse0'] = true;
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.keys['Mouse0'] = false;
  };

  private handlePointerLockChange = () => {
    this.isLocked = document.pointerLockElement !== null;
  };

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  update() {
    this.justPressed = {};
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }
}
