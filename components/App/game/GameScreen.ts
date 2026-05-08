/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { em } from '@lib/engine/engine_manager';
import { screenManager } from '@lib/screen/screen_manager';
import { Screen } from '@lib/screen/screen';
import { gfx3Manager } from '@lib/gfx3/gfx3_manager';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { gfx3PostRenderer, PostParam } from '@lib/gfx3_post/gfx3_post_renderer';
import { gfx3JoltManager } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Camera } from '@lib/gfx3_camera/gfx3_camera';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { eventManager } from '@lib/core/event_manager';
import { inputManager } from '@lib/input/input_manager';
import { Plane } from './Plane';
import { Environment } from './Environment';

export class GameScreen extends Screen {
  camera: Gfx3Camera;
  plane: Plane;
  level: Environment;
  moveDir = { x: 0, y: 0 };
  
  cameraLookTarget: vec3 = [0, 0, 0];
  isReady: boolean = false;
  
  frameMouseX: number = 0;
  frameMouseY: number = 0;
  
  constructor() {
    super();
    this.camera = new Gfx3Camera(0);
    this.plane = new Plane();
    this.level = new Environment();
  }

  async onEnter() {
    gfx3PostRenderer.setParam(PostParam.PIXELATION_ENABLED, 0.0);
    
    // Load Models
    await Promise.all([
      this.plane.load()
    ]);
    
    // Desktop Controls
    inputManager.registerAction('keyboard', 'KeyW', 'PITCH_DOWN');
    inputManager.registerAction('keyboard', 'KeyS', 'PITCH_UP');
    inputManager.registerAction('keyboard', 'KeyA', 'ROLL_LEFT');
    inputManager.registerAction('keyboard', 'KeyD', 'ROLL_RIGHT');
    inputManager.registerAction('keyboard', 'KeyQ', 'YAW_LEFT');
    inputManager.registerAction('keyboard', 'KeyE', 'YAW_RIGHT');
    inputManager.registerAction('keyboard', 'ShiftLeft', 'THR_UP');
    inputManager.registerAction('keyboard', 'ControlLeft', 'THR_DOWN');

    inputManager.setPointerLockEnabled(true);
    eventManager.subscribe(inputManager, 'E_MOUSE_MOVE', this, this.handleMouseMove);

    this.camera.setPosition(0, 10, -10);
    this.camera.lookAt(0, 0, 0);
    this.camera.getView().setBgColor(0.53, 0.81, 0.92, 1.0); // Sky blue
    
    const planePos = this.plane.getPosition();
    this.cameraLookTarget = [planePos[0], planePos[1] + 1.5, planePos[2]];
    this.isReady = true;
  }

  handleMouseMove = (data: any) => {
    // Accumulate mouse movement
    if (inputManager.isPointerLockCaptured()) {
        this.frameMouseX += data.movementX;
        this.frameMouseY += data.movementY;
    }
  };

  update(ts: number) {
    inputManager.update(ts);
    gfx3JoltManager.update(ts);

    let rollInput = 0;
    let pitchInput = 0;
    let yawInput = 0;
    let throttleInput = 0;
    
    if (inputManager.isActiveAction('ROLL_LEFT')) rollInput -= 1;
    if (inputManager.isActiveAction('ROLL_RIGHT')) rollInput += 1;
    if (inputManager.isActiveAction('PITCH_DOWN')) pitchInput += 1; 
    if (inputManager.isActiveAction('PITCH_UP')) pitchInput -= 1;
    if (inputManager.isActiveAction('YAW_LEFT')) yawInput += 1;
    if (inputManager.isActiveAction('YAW_RIGHT')) yawInput -= 1;
    if (inputManager.isActiveAction('THR_UP')) throttleInput += 1;
    if (inputManager.isActiveAction('THR_DOWN')) throttleInput -= 1;
    
    // Also use mouse for pitch/yaw if pointer is locked
    if (inputManager.isPointerLockCaptured()) {
        yawInput -= this.frameMouseX * 0.05; // Mouse X -> Yaw
        pitchInput += this.frameMouseY * 0.05; // Mouse Y -> Pitch
    }
    this.frameMouseX = 0;
    this.frameMouseY = 0;

    this.level.update(ts);
    this.plane.update(ts, rollInput, pitchInput, yawInput, throttleInput);

    // Camera follow the plane smoothly
    const followPos = this.plane.getPosition();
    const planeQ = Quaternion.createFromEuler(this.plane.yaw, this.plane.pitch, this.plane.roll, 'YXZ');
    
    // Offset behind and up relative to the plane's YAW and slightly pitch
    // By keeping roll at 0 for offset, the camera won't flip upside down when the plane rolls
    const offsetQuat = Quaternion.createFromEuler(this.plane.yaw, this.plane.pitch * 0.8, 0, 'YXZ');
    const camOffset = offsetQuat.rotateVector([0, 4, 18]); // slightly higher and further back
    
    if (!followPos || isNaN(followPos[0]) || isNaN(followPos[1]) || isNaN(followPos[2])) {
        return;
    }

    const camTarget = [
        followPos[0] + camOffset[0],
        followPos[1] + camOffset[1],
        followPos[2] + camOffset[2]
    ] as vec3;
    
    const camPos = this.camera.getPosition();
    const posLerpRate = 1.0 - Math.exp(-6.0 * (ts / 1000));
    const targetLerpRate = 1.0 - Math.exp(-10.0 * (ts / 1000));

    const lerpedPos = UT.VEC3_LERP(camPos, camTarget, posLerpRate);
    const desiredLookTarget = [followPos[0], followPos[1] + 1.0, followPos[2]] as vec3;
    this.cameraLookTarget = UT.VEC3_LERP(this.cameraLookTarget, desiredLookTarget, targetLerpRate);
    
    if (!isNaN(lerpedPos[0]) && !isNaN(lerpedPos[1]) && !isNaN(lerpedPos[2])) {
        this.camera.setPosition(lerpedPos[0], lerpedPos[1], lerpedPos[2]);
        this.camera.lookAt(this.cameraLookTarget[0], this.cameraLookTarget[1], this.cameraLookTarget[2]);
    }
  }

  draw() {
    gfx3Manager.beginDrawing();
    gfx3MeshRenderer.drawDirLight([0.3, -1.0, 0.4], [1.0, 0.95, 0.9], [1.0, 1.0, 1.0], 1.5);
    gfx3MeshRenderer.setAmbientColor([0.5, 0.55, 0.65]); // Brighter ambient

    const camPos = this.camera.getPosition();
    
    // Slight fog effect by simulating fog with post process or clear color? 
    // ArcadeGPU might not have fog, but we have a sky blue bg.

    this.level.draw(camPos);
    this.plane.draw();
    
    gfx3Manager.endDrawing();
  }

  render(ts: number) {
    if (!this.isReady) return;
    
    gfx3Manager.beginRender();
    
    gfx3Manager.setDestinationTexture(gfx3PostRenderer.getSourceTexture());
    gfx3Manager.beginPassRender(0);
    gfx3MeshRenderer.render(ts);
    gfx3Manager.endPassRender();
    
    gfx3Manager.setDestinationTexture(null);
    gfx3PostRenderer.render(ts, gfx3Manager.getCurrentRenderingTexture());
    
    gfx3Manager.endRender();
  }
}
