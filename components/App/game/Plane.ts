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
  trailMesh: Gfx3Mesh;
  
  wheelLeft: Gfx3Mesh;
  wheelRight: Gfx3Mesh;
  wheelBack: Gfx3Mesh;
  strutLeft: Gfx3Mesh;
  strutRight: Gfx3Mesh;
  strutBack: Gfx3Mesh;

  physicsBody: any;
  velocity: number = 20; // Default cruising speed
  
  rotation: Quaternion = new Quaternion();
  
  rollRate: number = 0;
  pitchRate: number = 0;
  yawRate: number = 0;
  
  propAngle: number = 0;

  trails: { x: number, y: number, z: number, life: number, maxLife: number }[] = [];

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
    this.trailMesh = createBoxMesh(1.0, 1.0, 1.0, [0.9, 0.95, 1.0]); // white/light-blue trail
    
    // Wheels setup
    const tireColor: [number, number, number] = [0.1, 0.1, 0.1];
    const strutColor: [number, number, number] = [0.3, 0.3, 0.3];
    
    this.wheelLeft = createBoxMesh(0.2, 0.6, 0.6, tireColor); // Simple boxy tires
    this.wheelRight = createBoxMesh(0.2, 0.6, 0.6, tireColor);
    this.wheelBack = createBoxMesh(0.15, 0.4, 0.4, tireColor);
    
    this.strutLeft = createBoxMesh(0.1, 0.8, 0.1, strutColor);
    this.strutRight = createBoxMesh(0.1, 0.8, 0.1, strutColor);
    this.strutBack = createBoxMesh(0.1, 0.4, 0.1, strutColor);

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
    const minSpeed = 20;
    const maxSpeed = 150;
    const dt = ts / 1000;
    
    // Convert inputs to target rates
    const rollResponsiveness = 3.5;
    const pitchResponsiveness = 2.0;
    const yawResponsiveness = 1.0;
    
    const normalizedSpeed = Math.max(0, Math.min(1, (this.velocity - minSpeed) / (maxSpeed - minSpeed)));
    const maneuverability = 0.5 + 0.5 * Math.sin(normalizedSpeed * Math.PI); // best around middle speed

    const targetRollRate = rollInput * rollResponsiveness * maneuverability;
    const targetPitchRate = pitchInput * pitchResponsiveness * maneuverability;
    const targetYawRate = yawInput * yawResponsiveness * maneuverability;

    // Smooth movement over time to simulate momentum/inertia
    const rateSmooth = 1.0 - Math.exp(-8.0 * dt);
    this.rollRate = UT.LERP(this.rollRate, targetRollRate, rateSmooth);
    this.pitchRate = UT.LERP(this.pitchRate, targetPitchRate, rateSmooth);
    this.yawRate = UT.LERP(this.yawRate, targetYawRate, rateSmooth);

    // Apply local rotation rates
    // To simulate lift pulling us when banked:
    const localUp = this.rotation.rotateVector([0, 1, 0]);
    // If banked, localUp[0] is non-zero (pulling left/right in world space)
    
    // Actually, local delta rotation:
    const deltaYaw = this.yawRate * dt;
    const deltaPitch = this.pitchRate * dt; 
    const deltaRoll = this.rollRate * dt;

    const localRot = Quaternion.createFromEuler(deltaYaw, deltaPitch, deltaRoll, 'YXZ');
    this.rotation = Quaternion.multiply(this.rotation, localRot);
    
    // Normalize quaternion
    let len = Math.sqrt(this.rotation[0]*this.rotation[0] + this.rotation[1]*this.rotation[1] + this.rotation[2]*this.rotation[2] + this.rotation[3]*this.rotation[3]);
    if(len > 0) {
        this.rotation[0] /= len; this.rotation[1] /= len; this.rotation[2] /= len; this.rotation[3] /= len;
    }

    // Throttle controls
    const accelRate = throttleInput * 30.0;
    this.velocity += accelRate * dt;
    
    // Gravity effect on speed based on pitch
    const forwardVec = this.rotation.rotateVector([0, 0, -1]);
    const verticalPitch = forwardVec[1]; // y component of forward vector (-1 diving, 1 climbing)
    this.velocity -= verticalPitch * 15.0 * dt; // gravity speeds up dives, slows climbs
    
    // Drag/air resistance brings speed closer to default cruise if no input
    if (Math.abs(throttleInput) < 0.1) {
        const defaultCruise = 50;
        this.velocity = UT.LERP(this.velocity, defaultCruise, 1.0 - Math.exp(-0.5 * dt));
    }
    
    // High G maneuvers bleed speed
    const gForce = Math.abs(this.pitchRate) + Math.abs(this.yawRate);
    this.velocity -= gForce * 5.0 * dt;
    
    // Speed boundaries
    this.velocity = Math.max(minSpeed, Math.min(maxSpeed, this.velocity));

    let quat = this.rotation;
    
    // Forward vector
    const forward = quat.rotateVector([0, 0, -1]);
    
    // Update physics velocity
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
    const propLocalQuat = Quaternion.createFromEuler(0, 0, this.propAngle, 'YXZ');
    const propFinalQuat = Quaternion.multiply(quat, propLocalQuat);
    
    const propHubOffset = quat.rotateVector([0, -0.2, -3.4]);
    this.propellerHub.setPosition(pos.GetX() + propHubOffset[0], pos.GetY() + propHubOffset[1], pos.GetZ() + propHubOffset[2]);
    this.propellerHub.setQuaternion(quat);
    
    const propOffset = quat.rotateVector([0, -0.2, -3.5]); // slightly ahead of hub
    this.propeller.setPosition(pos.GetX() + propOffset[0], pos.GetY() + propOffset[1], pos.GetZ() + propOffset[2]);
    this.propeller.setQuaternion(propFinalQuat);

    // Wheels logic - retracting them visually based on speed? Or just leave them down
    // Let's retract them based on speed
    const isFlyingFast = this.velocity > 50;
    
    // Smooth retraction blend (0 = down, 1 = up)
    let wheelRetractAmount = Math.max(0, Math.min(1, (this.velocity - 35) / 20));
    
    // Left Wheel & Strut
    // When down: [ -1.5, -1.2, -0.5 ]
    // When up: [ -1.5, -0.3, -0.5 ] 
    const lStrutPos = [ -2.0, -0.8 + 0.5 * wheelRetractAmount, -0.5 ];
    const lWheelPos = [ -2.0, -1.2 + 0.9 * wheelRetractAmount, -0.5 ];
    
    const strutLeftOffset = quat.rotateVector(lStrutPos);
    this.strutLeft.setPosition(pos.GetX() + strutLeftOffset[0], pos.GetY() + strutLeftOffset[1], pos.GetZ() + strutLeftOffset[2]);
    this.strutLeft.setQuaternion(quat);
    
    const wheelLeftOffset = quat.rotateVector(lWheelPos);
    this.wheelLeft.setPosition(pos.GetX() + wheelLeftOffset[0], pos.GetY() + wheelLeftOffset[1], pos.GetZ() + wheelLeftOffset[2]);
    this.wheelLeft.setQuaternion(quat);
    
    // Right Wheel & Strut
    const rStrutPos = [ 2.0, -0.8 + 0.5 * wheelRetractAmount, -0.5 ];
    const rWheelPos = [ 2.0, -1.2 + 0.9 * wheelRetractAmount, -0.5 ];
    
    const strutRightOffset = quat.rotateVector(rStrutPos);
    this.strutRight.setPosition(pos.GetX() + strutRightOffset[0], pos.GetY() + strutRightOffset[1], pos.GetZ() + strutRightOffset[2]);
    this.strutRight.setQuaternion(quat);
    
    const wheelRightOffset = quat.rotateVector(rWheelPos);
    this.wheelRight.setPosition(pos.GetX() + wheelRightOffset[0], pos.GetY() + wheelRightOffset[1], pos.GetZ() + wheelRightOffset[2]);
    this.wheelRight.setQuaternion(quat);

    // Back Wheel & Strut
    const bStrutPos = [ 0.0, -0.3 + 0.2 * wheelRetractAmount, 3.5 ];
    const bWheelPos = [ 0.0, -0.5 + 0.4 * wheelRetractAmount, 3.5 ];
    
    const strutBackOffset = quat.rotateVector(bStrutPos);
    this.strutBack.setPosition(pos.GetX() + strutBackOffset[0], pos.GetY() + strutBackOffset[1], pos.GetZ() + strutBackOffset[2]);
    this.strutBack.setQuaternion(quat);
    
    const wheelBackOffset = quat.rotateVector(bWheelPos);
    this.wheelBack.setPosition(pos.GetX() + wheelBackOffset[0], pos.GetY() + wheelBackOffset[1], pos.GetZ() + wheelBackOffset[2]);
    this.wheelBack.setQuaternion(quat);

    // Contrails logic
    if (this.velocity > 60 || Math.abs(this.rollRate) > 1.0 || Math.abs(this.pitchRate) > 1.0) {
       const leftWingTip = quat.rotateVector([-5.0, -0.4, -0.5]);
       const rightWingTip = quat.rotateVector([5.0, -0.4, -0.5]);
       
       this.trails.push({
           x: pos.GetX() + leftWingTip[0], y: pos.GetY() + leftWingTip[1], z: pos.GetZ() + leftWingTip[2],
           life: 1.5, maxLife: 1.5
       });
       this.trails.push({
           x: pos.GetX() + rightWingTip[0], y: pos.GetY() + rightWingTip[1], z: pos.GetZ() + rightWingTip[2],
           life: 1.5, maxLife: 1.5
       });
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
       this.trails[i].life -= (ts / 1000);
       if (this.trails[i].life <= 0) {
           this.trails.splice(i, 1);
       }
    }
  }

  draw() {
    this.nose.draw();
    this.body.draw();
    this.tailBoom.draw();
    this.cockpit.draw();
    this.wings.draw();
    this.v_tail.draw();
    this.h_tail.draw();
    this.strutLeft.draw();
    this.strutRight.draw();
    this.strutBack.draw();
    this.wheelLeft.draw();
    this.wheelRight.draw();
    this.wheelBack.draw();
    this.propellerHub.draw();
    this.propeller.draw();
    
    // Draw trails
    for (const t of this.trails) {
        const scale = (t.life / t.maxLife) * 0.5; // start small, get smaller
        const ZERO: vec3 = [0,0,0];
        const dummyQuat = new Quaternion();
        const mat = UT.MAT4_TRANSFORM([t.x, t.y, t.z], ZERO, [scale, scale, scale], dummyQuat);
        gfx3MeshRenderer.drawMesh(this.trailMesh, mat);
    }
  }
}


