import { gfx3JoltManager, JOLT_LAYER_MOVING, Gfx3Jolt } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { Quaternion } from '@lib/core/quaternion';
import { UT } from '@lib/core/utils';
import { createBoxMesh } from './GameUtils';

/**
 * The Plane class represents the player-controlled airplane.
 */
export class Plane {
  nose: Gfx3Mesh;
  body: Gfx3Mesh;
  tailBoom: Gfx3Mesh;
  wings: Gfx3Mesh;
  v_tail: Gfx3Mesh;
  h_tail: Gfx3Mesh;
  propeller: Gfx3Mesh;
  propellerHub: Gfx3Mesh;
  cockpit: Gfx3Mesh;

  physicsBody: any;
  velocity: number = 20; // Default cruising speed
  
  // Rotation values
  yaw: number = 0;
  pitch: number = 0;
  roll: number = 0;
  
  propAngle: number = 0;

  constructor() {
    // Colors inspired by a WWII Spitfire / Mustang
    const fuselageColor: [number, number, number] = [0.4, 0.45, 0.4];
    const wingColor: [number, number, number] = [0.35, 0.4, 0.35];
    const propColor: [number, number, number] = [0.1, 0.1, 0.1];
    const propHubColor: [number, number, number] = [0.6, 0.1, 0.1]; // Red hub
    const cockpitColor: [number, number, number] = [0.2, 0.6, 0.8]; // Glass

    this.nose = createBoxMesh(1.0, 1.0, 1.5, fuselageColor);
    this.body = createBoxMesh(1.4, 1.4, 3.0, fuselageColor);
    this.tailBoom = createBoxMesh(0.8, 0.8, 3.0, fuselageColor);
    
    this.cockpit = createBoxMesh(1.0, 0.8, 1.8, cockpitColor);
    this.wings = createBoxMesh(10.0, 0.15, 2.2, wingColor);
    this.v_tail = createBoxMesh(0.15, 2.0, 1.5, wingColor);
    this.h_tail = createBoxMesh(3.5, 0.15, 1.2, wingColor);
    
    this.propeller = createBoxMesh(4.5, 0.1, 0.1, propColor);
    this.propellerHub = createBoxMesh(0.6, 0.6, 0.8, propHubColor);

    this.physicsBody = gfx3JoltManager.addBox({
      width: 1.4, height: 1.4, depth: 7.5, // approximate full size
      x: 0, y: 50.0, z: 0,
      motionType: Gfx3Jolt.EMotionType_Dynamic,
      layer: JOLT_LAYER_MOVING,
      settings: { mAngularDamping: 1.0, mLinearDamping: 0.5, mMassPropertiesOverride: 100.0, mAllowedDOFs: 7 }
    });
    
    // Disable gravity on the physics body so we fly smoothly
    gfx3JoltManager.bodyInterface.SetGravityFactor(this.physicsBody.body.GetID(), 0);
  }

  async load() {}

  getPosition(): vec3 {
     const pos = this.physicsBody.body.GetPosition();
     return [pos.GetX(), pos.GetY(), pos.GetZ()];
  }

  update(ts: number, rollInput: number, pitchInput: number, yawInput: number, throttleInput: number) {
    const minSpeed = 10;
    const maxSpeed = 80;
    
    // Input handling
    const rollSpeed = 2.5;
    const pitchSpeed = 1.5;
    const yawSpeed = 1.0;

    // Apply inputs to current attitudes
    this.roll -= rollInput * rollSpeed * (ts / 1000);
    this.pitch -= pitchInput * pitchSpeed * (ts / 1000);
    
    // Allow direct yaw input, but also add turn rate based on roll
    this.yaw -= yawInput * yawSpeed * (ts / 1000);
    const turnRate = Math.sin(this.roll) * 1.5 * Math.cos(this.pitch);
    this.yaw -= turnRate * (ts / 1000);
    
    // Natural pitch down when rolled to simulate loss of lift
    const pitchDrop = Math.abs(Math.sin(this.roll)) * 0.2 * (ts / 1000);
    this.pitch += pitchDrop;

    const accelRate = throttleInput * 20.0;
    this.velocity += accelRate * (ts / 1000);
    this.velocity = Math.max(minSpeed, Math.min(maxSpeed, this.velocity));

    // Calculate rotation quaternion (YXZ order is yaw-pitch-roll)
    let quat = Quaternion.createFromEuler(this.yaw, this.pitch, this.roll, 'YXZ');
    
    // Forward vector
    const forward = quat.rotateVector([0, 0, -1]);
    
    const linVel = UT.VEC3_SCALE(forward, this.velocity);
    
    const joltLinVel = new Gfx3Jolt.Vec3(linVel[0], linVel[1], linVel[2]);
    gfx3JoltManager.bodyInterface.SetLinearVelocity(this.physicsBody.body.GetID(), joltLinVel);
    
    const pos = this.physicsBody.body.GetPosition();
    
    // Sync Mesh Positions
    // Base position is roughly the center of mass
    const bodyOffset = quat.rotateVector([0, 0, 0]);
    this.body.setPosition(pos.GetX() + bodyOffset[0], pos.GetY() + bodyOffset[1], pos.GetZ() + bodyOffset[2]);
    this.body.setQuaternion(quat);
    
    // Nose is in front of the body
    const noseOffset = quat.rotateVector([0, -0.2, -2.25]);
    this.nose.setPosition(pos.GetX() + noseOffset[0], pos.GetY() + noseOffset[1], pos.GetZ() + noseOffset[2]);
    this.nose.setQuaternion(quat);
    
    // Tailboom is behind the body
    const tailOffset = quat.rotateVector([0, 0, 3.0]);
    this.tailBoom.setPosition(pos.GetX() + tailOffset[0], pos.GetY() + tailOffset[1], pos.GetZ() + tailOffset[2]);
    this.tailBoom.setQuaternion(quat);
    
    // Cockpit on top of the body
    const cockpitOffset = quat.rotateVector([0, 1.1, -0.5]);
    this.cockpit.setPosition(pos.GetX() + cockpitOffset[0], pos.GetY() + cockpitOffset[1], pos.GetZ() + cockpitOffset[2]);
    this.cockpit.setQuaternion(quat);

    // Wings attached near the front/center of the body
    const wingOffset = quat.rotateVector([0, -0.4, -0.5]);
    this.wings.setPosition(pos.GetX() + wingOffset[0], pos.GetY() + wingOffset[1], pos.GetZ() + wingOffset[2]);
    this.wings.setQuaternion(quat);

    // V-Tail on top of the rear tail boom
    const vTailOffset = quat.rotateVector([0, 0.8, 4.0]);
    this.v_tail.setPosition(pos.GetX() + vTailOffset[0], pos.GetY() + vTailOffset[1], pos.GetZ() + vTailOffset[2]);
    this.v_tail.setQuaternion(quat);

    // H-Tail at the rear of the tail boom
    const hTailOffset = quat.rotateVector([0, 0.0, 4.2]);
    this.h_tail.setPosition(pos.GetX() + hTailOffset[0], pos.GetY() + hTailOffset[1], pos.GetZ() + hTailOffset[2]);
    this.h_tail.setQuaternion(quat);

    // Propeller spinning at the front of the nose
    this.propAngle += this.velocity * 1.5 * (ts/1000);
    const propLocalQuat = Quaternion.createFromEuler(0, 0, this.propAngle, 'ZXY');
    const propFinalQuat = Quaternion.multiply(quat, propLocalQuat);
    
    const propHubOffset = quat.rotateVector([0, -0.2, -3.4]);
    this.propellerHub.setPosition(pos.GetX() + propHubOffset[0], pos.GetY() + propHubOffset[1], pos.GetZ() + propHubOffset[2]);
    this.propellerHub.setQuaternion(quat); // hub doesn't need to spin visually if it's rotation symmetric, but we can spin it
    this.propellerHub.setQuaternion(propFinalQuat);
    
    const propOffset = quat.rotateVector([0, -0.2, -3.5]);
    this.propeller.setPosition(pos.GetX() + propOffset[0], pos.GetY() + propOffset[1], pos.GetZ() + propOffset[2]);
    this.propeller.setQuaternion(propFinalQuat);
  }

  draw() {
    this.nose.draw();
    this.body.draw();
    this.tailBoom.draw();
    this.cockpit.draw();
    this.wings.draw();
    this.v_tail.draw();
    this.h_tail.draw();
    this.propellerHub.draw();
    this.propeller.draw();
  }
}


