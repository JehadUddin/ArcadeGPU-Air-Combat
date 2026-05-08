import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from './InputManager';
import { gsap } from 'gsap';

export class Player {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  body: CANNON.Body;
  isGrounded: boolean = true;
  
  // Skeleton Joints
  hips: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  
  lShoulder: THREE.Group;
  lElbow: THREE.Group;
  rShoulder: THREE.Group;
  rElbow: THREE.Group;
  
  lHip: THREE.Group;
  lKnee: THREE.Group;
  rHip: THREE.Group;
  rKnee: THREE.Group;
  
  // Animation State
  state: 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'fly' = 'idle';
  isFlying: boolean = false;
  animations: Record<string, gsap.core.Timeline> = {};
  currentAnim: gsap.core.Timeline | null = null;
  
  currentTurnSpeed: number = 0;
  currentForwardSpeed: number = 0;

  constructor(scene: THREE.Scene, world: CANNON.World) {
    this.mesh = new THREE.Group();
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    
    // Physics Body
    const playerShape = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
    const playerMaterial = new CANNON.Material('playerMaterial');
    playerMaterial.friction = 0.0;
    playerMaterial.restitution = 0.0;

    this.body = new CANNON.Body({
      mass: 80,
      shape: playerShape,
      position: new CANNON.Vec3(0, 5, 0),
      fixedRotation: true,
      material: playerMaterial,
    });
    world.addBody(this.body);

    // Materials
    const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xffccaa, roughness: 0.4 });
    const shirtMat = new THREE.MeshPhysicalMaterial({ color: 0x224488, roughness: 0.7 });
    const pantsMat = new THREE.MeshPhysicalMaterial({ color: 0x112244, roughness: 0.8 });
    const shoesMat = new THREE.MeshPhysicalMaterial({ color: 0x222222, roughness: 0.9 });
    const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x4a3000, roughness: 0.9 });
    const packMat = new THREE.MeshPhysicalMaterial({ color: 0x884422, roughness: 0.9 });
    const hatMat = new THREE.MeshPhysicalMaterial({ color: 0xdd2222, roughness: 0.7 });

    // Hips (Root of the skeleton)
    this.hips = new THREE.Group();
    this.hips.position.y = 1.0;
    this.mesh.add(this.hips);
    
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), pantsMat);
    pelvis.castShadow = true;
    this.hips.add(pelvis);
    
    // Spine
    this.spine = new THREE.Group();
    this.spine.position.y = 0.1;
    this.hips.add(this.spine);
    
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.22), shirtMat);
    chest.position.y = 0.25;
    chest.castShadow = true;
    this.spine.add(chest);
    
    // Backpack
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.15), packMat);
    backpack.position.set(0, 0.25, -0.18);
    backpack.castShadow = true;
    this.spine.add(backpack);
    
    // Head
    this.head = new THREE.Group();
    this.head.position.y = 0.55;
    this.spine.add(this.head);
    
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), skinMat);
    skull.position.y = 0.125;
    skull.castShadow = true;
    this.head.add(skull);
    
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.08, 0.27), hairMat);
    hair.position.y = 0.26;
    hair.castShadow = true;
    this.head.add(hair);
    
    // Cap
    const capBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), hatMat);
    capBase.position.y = 0.32;
    capBase.castShadow = true;
    this.head.add(capBase);
    
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.15), hatMat);
    capBrim.position.set(0, 0.30, 0.2);
    capBrim.castShadow = true;
    this.head.add(capBrim);
    
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eyes.position.set(0, 0.15, 0.13);
    this.head.add(eyes);

    // Left Arm
    this.lShoulder = new THREE.Group();
    this.lShoulder.position.set(0.22, 0.45, 0);
    this.spine.add(this.lShoulder);
    
    const lUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), shirtMat);
    lUpperArm.position.y = -0.15;
    lUpperArm.castShadow = true;
    this.lShoulder.add(lUpperArm);
    
    this.lElbow = new THREE.Group();
    this.lElbow.position.y = -0.3;
    this.lShoulder.add(this.lElbow);
    
    const lLowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), skinMat);
    lLowerArm.position.y = -0.15;
    lLowerArm.castShadow = true;
    this.lElbow.add(lLowerArm);
    
    // Right Arm
    this.rShoulder = new THREE.Group();
    this.rShoulder.position.set(-0.22, 0.45, 0);
    this.spine.add(this.rShoulder);
    
    const rUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), shirtMat);
    rUpperArm.position.y = -0.15;
    rUpperArm.castShadow = true;
    this.rShoulder.add(rUpperArm);
    
    this.rElbow = new THREE.Group();
    this.rElbow.position.y = -0.3;
    this.rShoulder.add(this.rElbow);
    
    const rLowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), skinMat);
    rLowerArm.position.y = -0.15;
    rLowerArm.castShadow = true;
    this.rElbow.add(rLowerArm);
    
    // Left Leg
    this.lHip = new THREE.Group();
    this.lHip.position.set(0.1, -0.1, 0);
    this.hips.add(this.lHip);
    
    const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), pantsMat);
    lThigh.position.y = -0.225;
    lThigh.castShadow = true;
    this.lHip.add(lThigh);
    
    this.lKnee = new THREE.Group();
    this.lKnee.position.y = -0.45;
    this.lHip.add(this.lKnee);
    
    const lCalf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), skinMat);
    lCalf.position.y = -0.225;
    lCalf.castShadow = true;
    this.lKnee.add(lCalf);
    
    const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2), shoesMat);
    lFoot.position.set(0, -0.45, 0.05);
    lFoot.castShadow = true;
    this.lKnee.add(lFoot);
    
    // Right Leg
    this.rHip = new THREE.Group();
    this.rHip.position.set(-0.1, -0.1, 0);
    this.hips.add(this.rHip);
    
    const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), pantsMat);
    rThigh.position.y = -0.225;
    rThigh.castShadow = true;
    this.rHip.add(rThigh);
    
    this.rKnee = new THREE.Group();
    this.rKnee.position.y = -0.45;
    this.rHip.add(this.rKnee);
    
    const rCalf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), skinMat);
    rCalf.position.y = -0.225;
    rCalf.castShadow = true;
    this.rKnee.add(rCalf);
    
    const rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2), shoesMat);
    rFoot.position.set(0, -0.45, 0.05);
    rFoot.castShadow = true;
    this.rKnee.add(rFoot);

    scene.add(this.mesh);
    this.initAnimations();
    this.playAnimation('idle');
    
    // Collision listener for bullet hits
    this.body.addEventListener("collide", (e: any) => {
      if (e.body && e.body.isEnemyBullet) {
        const damage = e.body.damage || 10;
        this.takeDamage(damage);
      }
    });
  }

  takeDamage(amount: number) {
    // Simple damage effect: flash red
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && child.material.color) {
        const origColor = child.material.color.getHex();
        child.material.color.setHex(0xff0000);
        setTimeout(() => {
          if (child.material) child.material.color.setHex(origColor);
        }, 200);
      }
    });
    
    // Add knockback
    this.body.velocity.y += 5;
  }

  initAnimations() {
    // Idle
    this.animations.idle = gsap.timeline({ repeat: -1, paused: true })
      .to(this.hips.position, { y: 1.015, duration: 1.5, ease: "sine.inOut" })
      .to(this.hips.position, { y: 1.0, duration: 1.5, ease: "sine.inOut" }, ">")
      .to(this.spine.rotation, { x: 0.02, duration: 1.5, ease: "sine.inOut" }, 0)
      .to(this.spine.rotation, { x: -0.02, duration: 1.5, ease: "sine.inOut" }, 1.5)
      .to(this.lShoulder.rotation, { x: 0.05, z: 0.1, duration: 1.5, ease: "sine.inOut" }, 0)
      .to(this.rShoulder.rotation, { x: 0.05, z: -0.1, duration: 1.5, ease: "sine.inOut" }, 0)
      .to(this.lElbow.rotation, { x: -0.1, duration: 1.5, ease: "sine.inOut" }, 0)
      .to(this.rElbow.rotation, { x: -0.1, duration: 1.5, ease: "sine.inOut" }, 0)
      .to(this.lHip.rotation, { x: 0, z: 0.05, duration: 1.5, ease: "sine.inOut" }, 0)
      .to(this.rHip.rotation, { x: 0, z: -0.05, duration: 1.5, ease: "sine.inOut" }, 0)
      .to(this.lKnee.rotation, { x: 0, duration: 1.5, ease: "sine.inOut" }, 0)
      .to(this.rKnee.rotation, { x: 0, duration: 1.5, ease: "sine.inOut" }, 0);

    // Walk
    const walkD = 0.25;
    this.animations.walk = gsap.timeline({ repeat: -1, paused: true })
      .to(this.hips.position, { y: 0.98, duration: walkD/2, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0)
      .to(this.lHip.rotation, { x: -0.8, duration: walkD, ease: "sine.inOut" }, 0)
      .to(this.rHip.rotation, { x: 0.8, duration: walkD, ease: "sine.inOut" }, 0)
      .to(this.lKnee.rotation, { x: 0.1, duration: walkD, ease: "sine.inOut" }, 0)
      .to(this.rKnee.rotation, { x: 1.1, duration: walkD, ease: "sine.inOut" }, 0)
      .to(this.lShoulder.rotation, { x: 0.8, z: 0.1, duration: walkD, ease: "sine.inOut" }, 0)
      .to(this.rShoulder.rotation, { x: -0.8, z: -0.1, duration: walkD, ease: "sine.inOut" }, 0)
      .to(this.lElbow.rotation, { x: -0.2, duration: walkD, ease: "sine.inOut" }, 0)
      .to(this.rElbow.rotation, { x: -0.4, duration: walkD, ease: "sine.inOut" }, 0)
      
      .to(this.hips.position, { y: 0.98, duration: walkD/2, ease: "sine.inOut", yoyo: true, repeat: 1 }, walkD)
      .to(this.lHip.rotation, { x: 0.8, duration: walkD, ease: "sine.inOut" }, walkD)
      .to(this.rHip.rotation, { x: -0.8, duration: walkD, ease: "sine.inOut" }, walkD)
      .to(this.lKnee.rotation, { x: 1.1, duration: walkD, ease: "sine.inOut" }, walkD)
      .to(this.rKnee.rotation, { x: 0.1, duration: walkD, ease: "sine.inOut" }, walkD)
      .to(this.lShoulder.rotation, { x: -0.8, z: 0.1, duration: walkD, ease: "sine.inOut" }, walkD)
      .to(this.rShoulder.rotation, { x: 0.8, z: -0.1, duration: walkD, ease: "sine.inOut" }, walkD)
      .to(this.lElbow.rotation, { x: -0.4, duration: walkD, ease: "sine.inOut" }, walkD)
      .to(this.rElbow.rotation, { x: -0.2, duration: walkD, ease: "sine.inOut" }, walkD);

    // Run (Sprint)
    const runD = 0.15;
    this.animations.run = gsap.timeline({ repeat: -1, paused: true })
      .to(this.hips.position, { y: 0.95, duration: runD/2, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0)
      .to(this.spine.rotation, { x: 0.2, duration: runD, ease: "sine.inOut" }, 0)
      .to(this.lHip.rotation, { x: -1.2, duration: runD, ease: "sine.inOut" }, 0)
      .to(this.rHip.rotation, { x: 1.2, duration: runD, ease: "sine.inOut" }, 0)
      .to(this.lKnee.rotation, { x: 0.2, duration: runD, ease: "sine.inOut" }, 0)
      .to(this.rKnee.rotation, { x: 1.8, duration: runD, ease: "sine.inOut" }, 0)
      .to(this.lShoulder.rotation, { x: 1.2, z: 0.15, duration: runD, ease: "sine.inOut" }, 0)
      .to(this.rShoulder.rotation, { x: -1.2, z: -0.15, duration: runD, ease: "sine.inOut" }, 0)
      .to(this.lElbow.rotation, { x: -0.6, duration: runD, ease: "sine.inOut" }, 0)
      .to(this.rElbow.rotation, { x: -1.0, duration: runD, ease: "sine.inOut" }, 0)
      
      .to(this.hips.position, { y: 0.95, duration: runD/2, ease: "sine.inOut", yoyo: true, repeat: 1 }, runD)
      .to(this.lHip.rotation, { x: 1.2, duration: runD, ease: "sine.inOut" }, runD)
      .to(this.rHip.rotation, { x: -1.2, duration: runD, ease: "sine.inOut" }, runD)
      .to(this.lKnee.rotation, { x: 1.8, duration: runD, ease: "sine.inOut" }, runD)
      .to(this.rKnee.rotation, { x: 0.2, duration: runD, ease: "sine.inOut" }, runD)
      .to(this.lShoulder.rotation, { x: -1.2, z: 0.15, duration: runD, ease: "sine.inOut" }, runD)
      .to(this.rShoulder.rotation, { x: 1.2, z: -0.15, duration: runD, ease: "sine.inOut" }, runD)
      .to(this.lElbow.rotation, { x: -1.0, duration: runD, ease: "sine.inOut" }, runD)
      .to(this.rElbow.rotation, { x: -0.6, duration: runD, ease: "sine.inOut" }, runD);

    // Jump
    this.animations.jump = gsap.timeline({ paused: true })
      .to(this.hips.position, { y: 1.0, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.hips.rotation, { x: -0.1, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.spine.rotation, { x: 0.1, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.head.rotation, { x: -0.2, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.lShoulder.rotation, { x: -0.8, z: 0.6, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.rShoulder.rotation, { x: -0.8, z: -0.6, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.lElbow.rotation, { x: -0.5, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.rElbow.rotation, { x: -0.5, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.lHip.rotation, { x: -0.4, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.rHip.rotation, { x: -0.6, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.lKnee.rotation, { x: 0.8, duration: 0.2, ease: "power2.out" }, 0)
      .to(this.rKnee.rotation, { x: 1.0, duration: 0.2, ease: "power2.out" }, 0);

    // Fall
    this.animations.fall = gsap.timeline({ paused: true })
      .to(this.hips.position, { y: 1.0, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.hips.rotation, { x: 0.1, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.spine.rotation, { x: 0.2, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.head.rotation, { x: 0.3, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.lShoulder.rotation, { x: -0.3, z: 0.6, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.rShoulder.rotation, { x: -0.3, z: -0.6, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.lElbow.rotation, { x: -0.5, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.rElbow.rotation, { x: -0.5, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.lHip.rotation, { x: -0.1, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.rHip.rotation, { x: -0.3, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.lKnee.rotation, { x: 0.2, duration: 0.3, ease: "power2.out" }, 0)
      .to(this.rKnee.rotation, { x: 0.4, duration: 0.3, ease: "power2.out" }, 0);

    // Fly
    this.animations.fly = gsap.timeline({ repeat: -1, paused: true })
      .to(this.hips.position, { y: 1.0, duration: 1, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0)
      .to(this.hips.rotation, { x: 0.5, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.spine.rotation, { x: 0.2, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.head.rotation, { x: -0.5, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.lShoulder.rotation, { x: -1.5, z: 1.5, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.rShoulder.rotation, { x: -1.5, z: -1.5, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.lElbow.rotation, { x: -0.2, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.rElbow.rotation, { x: -0.2, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.lHip.rotation, { x: 0.2, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.rHip.rotation, { x: 0.5, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.lKnee.rotation, { x: 0.1, duration: 1, ease: "sine.inOut" }, 0)
      .to(this.rKnee.rotation, { x: 0.1, duration: 1, ease: "sine.inOut" }, 0);
  }

  playAnimation(newState: string) {
    if (this.state === newState) return;
    this.state = newState as any;

    if (this.currentAnim) {
      this.currentAnim.pause();
    }

    this.currentAnim = this.animations[newState];
    if (this.currentAnim) {
      // To prevent snapping, we could tween the timescale or use gsap.to to tween to the first frame.
      // For simplicity, we just play from 0.
      this.currentAnim.play(0);
    }
  }

  shoot(camera: THREE.PerspectiveCamera) {
    const projectileGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const projectileMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const mesh = new THREE.Mesh(projectileGeo, projectileMat);
    
    // Get direction from camera
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // Spawn slightly in front of the player
    const spawnPos = this.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(direction.clone().multiplyScalar(1.0));
    mesh.position.copy(spawnPos);
    
    // We need access to the scene to add the mesh.
    // The mesh is added to the scene in the constructor, but we don't store the scene.
    // Let's assume we can get it from this.mesh.parent
    if (this.mesh.parent) {
      this.mesh.parent.add(mesh);
    }

    const shape = new CANNON.Sphere(0.1);
    const body = new CANNON.Body({
      mass: 0.1, // Player bullet mass
      shape: shape,
      position: new CANNON.Vec3(spawnPos.x, spawnPos.y, spawnPos.z),
    });
    
    const speed = 50;
    body.velocity.set(direction.x * speed, direction.y * speed, direction.z * speed);
    
    (body as any).isBullet = true;
    (body as any).damage = 25; // Player deals 25 damage
    
    this.body.world!.addBody(body);

    // Cleanup after 2 seconds
    setTimeout(() => {
      if (this.mesh.parent) this.mesh.parent.remove(mesh);
      this.body.world!.removeBody(body);
    }, 2000);

    // Sync mesh with body in an update loop?
    // Since we don't have a dedicated projectiles array in Player, we can just use a simple interval or let it be.
    // For a proper implementation, we should update the mesh position in the Player's update loop.
    // Let's add a simple interval for this specific bullet.
    const interval = setInterval(() => {
      mesh.position.copy(body.position as unknown as THREE.Vector3);
      mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
    }, 1000 / 60);

    setTimeout(() => clearInterval(interval), 2000);
  }

  updateMovement(delta: number, input: InputManager) {
    // Toggle Fly mode
    if (input.keys['KeyF']) {
      if (!this.isFlying) {
        this.isFlying = true;
        this.body.velocity.y = 0;
        input.keys['KeyF'] = false; // Consume input
      } else {
        this.isFlying = false;
        input.keys['KeyF'] = false; // Consume input
      }
    }

    if (this.isFlying) {
      // Counteract gravity
      const gravity = this.body.world!.gravity;
      this.body.applyForce(
        new CANNON.Vec3(-gravity.x * this.body.mass, -gravity.y * this.body.mass, -gravity.z * this.body.mass),
        this.body.position
      );
    }

    const isRunningInput = input.keys['ShiftLeft'];
    const speed = this.isFlying ? 15 : (isRunningInput ? 12 : 6);
    
    let vx = 0;
    let vz = 0;

    if (input.keys['KeyW'] || input.keys['ArrowUp']) vz -= speed;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) vz += speed;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) vx -= speed;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) vx += speed;

    let targetTurnSpeed = 0;
    const moveDir = new THREE.Vector3(vx, 0, vz);
    
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), input.mouseX);
      
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - this.mesh.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.mesh.rotation.y += diff * 10 * delta;
      targetTurnSpeed = diff;

      this.body.velocity.x = moveDir.x * speed;
      this.body.velocity.z = moveDir.z * speed;
    } else {
      // Stop immediately when no keys are pressed
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    }

    this.currentTurnSpeed = THREE.MathUtils.lerp(this.currentTurnSpeed, targetTurnSpeed, 10 * delta);

    if (this.isFlying) {
      let targetVelY = 0;
      if (input.keys['Space']) targetVelY = speed;
      if (input.keys['ShiftLeft']) targetVelY = -speed;
      this.body.velocity.y = targetVelY;
    }
    
    this.velocity.set(this.body.velocity.x, this.body.velocity.y, this.body.velocity.z);
    
    const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    this.currentForwardSpeed = THREE.MathUtils.lerp(this.currentForwardSpeed, currentSpeed, 15 * delta);

    // Ground check using physics contacts
    this.isGrounded = false;
    for (let i = 0; i < this.body.world!.contacts.length; i++) {
      const c = this.body.world!.contacts[i];
      if (c.bi === this.body || c.bj === this.body) {
        // ni points from bi to bj
        const normalY = c.bi === this.body ? -c.ni.y : c.ni.y;
        if (normalY > 0.5) {
          this.isGrounded = true;
          break;
        }
      }
    }

    if (this.isGrounded && input.keys['Space'] && !this.isFlying) {
      this.body.velocity.y = 10;
      this.isGrounded = false;
    }
  }

  updateVisuals(delta: number, input: InputManager, camera: THREE.PerspectiveCamera | null) {
    // Shoot
    if (input.mouseDown && camera) {
      this.shoot(camera);
      input.mouseDown = false; // Consume input to prevent rapid fire
    }

    // Sync position (offset by 1.0 to perfectly align feet with the ground)
    this.position.set(this.body.position.x, this.body.position.y - 1.0, this.body.position.z);
    this.mesh.position.copy(this.position);
    // Note: We don't copy quaternion because we rotate the mesh manually based on movement direction
    // this.mesh.quaternion.copy(this.body.quaternion);

    // --- GSAP ANIMATION SYSTEM ---
    const isRunningInput = input.keys['ShiftLeft'];
    const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    const isRunning = isRunningInput && currentSpeed > 1;
    const isWalking = currentSpeed > 0.1 && !isRunning;
    
    let nextState = this.state;
    if (this.isFlying) {
      nextState = 'fly';
    } else if (!this.isGrounded) {
      nextState = this.velocity.y > 0 ? 'jump' : 'fall';
    } else if (isRunning) {
      nextState = 'run';
    } else if (isWalking) {
      nextState = 'walk';
    } else {
      nextState = 'idle';
    }
    
    this.playAnimation(nextState);

    if (camera) {
      // Camera follow
      const target = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
      const dist = 5;
      const camX = target.x + dist * Math.cos(input.mouseY) * Math.sin(input.mouseX);
      let camY = target.y + dist * Math.sin(input.mouseY);
      const camZ = target.z + dist * Math.cos(input.mouseY) * Math.cos(input.mouseX);
      
      camY = Math.max(0.5, camY);
      
      const idealCamPos = new THREE.Vector3(camX, camY, camZ);
      
      const isDescendant = (child: THREE.Object3D, parent: THREE.Object3D): boolean => {
        if (child === parent) return true;
        if (child.parent) return isDescendant(child.parent, parent);
        return false;
      };

      // Raycast to prevent clipping through walls
      const camRaycaster = new THREE.Raycaster(target, idealCamPos.clone().sub(target).normalize(), 0, dist);
      const camIntersects = camRaycaster.intersectObjects(this.mesh.parent ? this.mesh.parent.children : [], true);
      
      const validCamIntersects = camIntersects.filter(i => 
        i.object.visible && 
        !isDescendant(i.object, this.mesh)
      );
      
      if (validCamIntersects.length > 0) {
        // Move camera slightly in front of the hit point
        idealCamPos.copy(validCamIntersects[0].point).lerp(target, 0.1);
      }

      camera.position.copy(idealCamPos);
      camera.lookAt(target);
    }
  }
}
