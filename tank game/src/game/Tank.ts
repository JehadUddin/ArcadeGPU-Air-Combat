import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from './InputManager';
import { getExplosionMaterial, getProjectileMaterial, getFireMaterial } from './Shaders';
import { AAAExplosion } from './Explosion';

function isDescendant(child: THREE.Object3D, parent: THREE.Object3D): boolean {
  if (child === parent) return true;
  if (child.parent) return isDescendant(child.parent, parent);
  return false;
}

function isDescendantByUserData(child: THREE.Object3D, key: string): boolean {
  if (child.userData[key]) return true;
  if (child.parent) return isDescendantByUserData(child.parent, key);
  return false;
}

export class Tank {
  group: THREE.Group;
  turret: THREE.Group;
  barrel: THREE.Group;
  muzzleFlash: THREE.PointLight;
  muzzleMesh: THREE.Mesh;
  
  wheelsL: THREE.Mesh[] = [];
  wheelsR: THREE.Mesh[] = [];
  
  particles: THREE.InstancedMesh;
  particleData: any[] = [];
  
  position: THREE.Vector3;
  rotation: number = 0;
  velocity: THREE.Vector3;
  body: CANNON.Body;
  world: CANNON.World;
  scene: THREE.Scene;
  
  projectiles: { mesh: THREE.Mesh, body: CANNON.Body, life: number, material?: THREE.ShaderMaterial }[] = [];
  explosions: AAAExplosion[] = [];
  
  trajectoryLine: THREE.Line;
  targetMarker: THREE.Group;
  
  cameraDist: number = 15;
  cameraShake: number = 0;
  markerTime: number = 0;
  
  recoil: number = 0;
  wasMouseDown: boolean = false;
  
  hullMaterial: THREE.MeshPhysicalMaterial;
  trackMaterial: THREE.MeshPhysicalMaterial;
  metalMaterial: THREE.MeshPhysicalMaterial;

  constructor(scene: THREE.Scene, world: CANNON.World) {
    this.world = world;
    this.scene = scene;
    this.group = new THREE.Group();
    this.position = new THREE.Vector3(0, 0, -10);
    this.velocity = new THREE.Vector3();
    this.group.position.copy(this.position);

    // Physics Body
    const tankShape = new CANNON.Box(new CANNON.Vec3(1.6, 0.7, 2.75));
    this.body = new CANNON.Body({
      mass: 5000,
      shape: tankShape,
      position: new CANNON.Vec3(0, 2, -10),
      angularDamping: 0.9,
    });
    this.body.angularFactor.set(0, 1, 0); // Only allow rotation around Y axis
    world.addBody(this.body);

    this.body.addEventListener("collide", (e: any) => {
      if (e.body && e.body.isEnemyBullet) {
        const damage = e.body.damage || 5;
        this.takeDamage(damage);
      }
    });

    this.hullMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x3a4a23,
      metalness: 0.7,
      roughness: 0.4,
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
    });

    this.trackMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      metalness: 0.4,
      roughness: 0.8,
    });

    this.metalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.3,
      clearcoat: 0.5,
    });

    this.turret = new THREE.Group();
    this.barrel = new THREE.Group();
    
    this.muzzleFlash = new THREE.PointLight(0x00aaff, 0, 20);
    this.muzzleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      getFireMaterial(0x0000ff, 0x00aaff, 0xffffff)
    );
    this.muzzleMesh.visible = false;

    this.particles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 }),
      20
    );
    for (let i = 0; i < 20; i++) {
      this.particleData.push({ life: 0, maxLife: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 0 });
    }

    const trajectoryGeo = new THREE.BufferGeometry();
    const trajectoryMat = new THREE.LineDashedMaterial({ 
      color: 0x00ffaa, 
      linewidth: 2, 
      scale: 1, 
      dashSize: 1, 
      gapSize: 0.5, 
      transparent: true, 
      opacity: 0.8,
      depthTest: false,
      depthWrite: false
    });
    this.trajectoryLine = new THREE.Line(trajectoryGeo, trajectoryMat);
    this.trajectoryLine.visible = false;
    this.trajectoryLine.renderOrder = 998;
    scene.add(this.trajectoryLine);

    this.targetMarker = new THREE.Group();
    const markerGeo = new THREE.RingGeometry(0.6, 0.8, 32);
    markerGeo.rotateX(-Math.PI / 2);
    const markerMat = new THREE.MeshBasicMaterial({ 
      color: 0xff3333, 
      transparent: true, 
      opacity: 0.9, 
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    const ring = new THREE.Mesh(markerGeo, markerMat);
    this.targetMarker.add(ring);
    
    const centerGeo = new THREE.CircleGeometry(0.2, 16);
    centerGeo.rotateX(-Math.PI / 2);
    const centerMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false
    });
    const center = new THREE.Mesh(centerGeo, centerMat);
    this.targetMarker.add(center);

    this.targetMarker.visible = false;
    this.targetMarker.renderOrder = 999;
    scene.add(this.targetMarker);

    this.buildMesh();
    scene.add(this.group);
  }

  takeDamage(amount: number) {
    // Simple damage effect: flash red
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && child.material.color) {
        const origColor = child.material.color.getHex();
        child.material.color.setHex(0xff0000);
        setTimeout(() => {
          if (child.material) child.material.color.setHex(origColor);
        }, 200);
      }
    });
  }

  buildMesh() {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 5.5), this.hullMaterial);
    hull.position.y = 1.0;
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.group.add(hull);

    const trackL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 6.0), this.trackMaterial);
    trackL.position.set(-1.9, 0.6, 0);
    trackL.castShadow = true;
    trackL.receiveShadow = true;
    this.group.add(trackL);

    const trackR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 6.0), this.trackMaterial);
    trackR.position.set(1.9, 0.6, 0);
    trackR.castShadow = true;
    trackR.receiveShadow = true;
    this.group.add(trackR);

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.9, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    
    for (let i = 0; i < 6; i++) {
      const z = -2.2 + i * 0.88;
      const wheelL = new THREE.Mesh(wheelGeo, this.metalMaterial);
      wheelL.position.set(-1.9, 0.4, z);
      wheelL.castShadow = true;
      this.group.add(wheelL);
      this.wheelsL.push(wheelL);

      const wheelR = new THREE.Mesh(wheelGeo, this.metalMaterial);
      wheelR.position.set(1.9, 0.4, z);
      wheelR.castShadow = true;
      this.group.add(wheelR);
      this.wheelsR.push(wheelR);
    }

    this.turret.position.set(0, 1.8, -0.5);
    this.group.add(this.turret);

    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.0, 16), this.hullMaterial);
    turretBase.castShadow = true;
    turretBase.receiveShadow = true;
    this.turret.add(turretBase);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16), this.metalMaterial);
    hatch.position.set(0, 0.55, 0.5);
    hatch.castShadow = true;
    this.turret.add(hatch);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 8), this.metalMaterial);
    antenna.position.set(-0.8, 1.5, 0.8);
    antenna.castShadow = true;
    this.turret.add(antenna);

    const exhaust = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.4), this.metalMaterial);
    exhaust.position.set(0, 0.5, 2.8);
    exhaust.castShadow = true;
    this.group.add(exhaust);

    this.barrel.position.set(0, 0, -1.4);
    this.turret.add(this.barrel);

    const mantlet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), this.hullMaterial);
    mantlet.castShadow = true;
    this.barrel.add(mantlet);

    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 4.0, 16), this.metalMaterial);
    gun.rotation.x = Math.PI / 2;
    gun.position.z = -2.0;
    gun.castShadow = true;
    this.barrel.add(gun);

    this.muzzleFlash.position.set(0, 0, -4.5);
    this.muzzleMesh.position.set(0, 0, -4.5);
    this.barrel.add(this.muzzleFlash);
    this.barrel.add(this.muzzleMesh);
    
    this.group.add(this.particles);
  }

  updateMovement(delta: number, input: InputManager) {
    const speed = 10;
    const turnSpeed = 1.5;

    let moveZ = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) moveZ -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) moveZ += 1;

    let turnY = 0;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) turnY += 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) turnY -= 1;

    // Apply forces/velocity to physics body
    const localForward = new CANNON.Vec3(0, 0, moveZ);
    const forward = new CANNON.Vec3();
    this.body.quaternion.vmult(localForward, forward);
    
    const targetVelX = forward.x * speed;
    const targetVelZ = forward.z * speed;

    this.body.velocity.x = THREE.MathUtils.damp(this.body.velocity.x, targetVelX, 10, delta);
    this.body.velocity.z = THREE.MathUtils.damp(this.body.velocity.z, targetVelZ, 10, delta);
    
    this.velocity.set(this.body.velocity.x, this.body.velocity.y, this.body.velocity.z);

    if (moveZ !== 0) {
      this.body.angularVelocity.y = turnY * turnSpeed * (moveZ < 0 ? 1 : -1);
    } else {
      this.body.angularVelocity.y = THREE.MathUtils.damp(this.body.angularVelocity.y, turnY * turnSpeed, 10, delta);
    }
  }

  updateVisuals(delta: number, input: InputManager, camera: THREE.PerspectiveCamera | null) {
    // Sync position and rotation
    this.position.set(this.body.position.x, this.body.position.y - 0.7, this.body.position.z);
    this.group.position.copy(this.position);
    this.group.quaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
    
    // Extract Y rotation for turret logic
    const euler = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'YXZ');
    this.rotation = euler.y;

    let moveZ = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) moveZ -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) moveZ += 1;
    let turnY = 0;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) turnY += 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) turnY -= 1;

    const speed = 10;
    const wheelRot = (moveZ * speed * delta) / 0.4;
    this.wheelsL.forEach(w => w.rotation.x -= wheelRot + (turnY * 0.05));
    this.wheelsR.forEach(w => w.rotation.x -= wheelRot - (turnY * 0.05));

    if (camera) {
      const targetDist = input.rightMouseDown ? 8 : 15;
      this.cameraDist = THREE.MathUtils.damp(this.cameraDist, targetDist, 5, delta);
      
      const target = this.position.clone().add(new THREE.Vector3(0, 3, 0));
      const camX = target.x + this.cameraDist * Math.cos(input.mouseY) * Math.sin(input.mouseX);
      let camY = target.y + this.cameraDist * Math.sin(input.mouseY);
      const camZ = target.z + this.cameraDist * Math.cos(input.mouseY) * Math.cos(input.mouseX);
      
      // Prevent camera from clipping under the ground
      camY = Math.max(1.0, camY);
      
      const idealCamPos = new THREE.Vector3(camX, camY, camZ);
      
      const isDescendant = (child: THREE.Object3D, parent: THREE.Object3D): boolean => {
        if (child === parent) return true;
        if (child.parent) return isDescendant(child.parent, parent);
        return false;
      };

      // Raycast to prevent clipping through walls
      const camRaycaster = new THREE.Raycaster(target, idealCamPos.clone().sub(target).normalize(), 0, this.cameraDist);
      const camIntersects = camRaycaster.intersectObjects(this.scene.children, true);
      
      const validCamIntersects = camIntersects.filter(i => 
        i.object.visible && 
        i.object !== this.trajectoryLine && 
        !isDescendant(i.object, this.targetMarker) &&
        !isDescendant(i.object, this.group)
      );
      
      if (validCamIntersects.length > 0) {
        // Move camera slightly in front of the hit point
        idealCamPos.copy(validCamIntersects[0].point).lerp(target, 0.1);
      }
      
      camera.position.copy(idealCamPos);
      camera.lookAt(target);

      // --- NEW AIMING LOGIC ---
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      
      const aimPoint = new THREE.Vector3();
      const intersects = raycaster.intersectObjects(this.scene.children, true);

      const turretWorldPos = new THREE.Vector3();
      this.turret.getWorldPosition(turretWorldPos);
      const distToTank = camera.position.distanceTo(turretWorldPos);

      // Filter out the tank itself, invisible objects, and objects behind the tank
      const validIntersects = intersects.filter(i => 
        i.object.visible && 
        i.object !== this.trajectoryLine && 
        !i.object.userData.isProjectile &&
        !isDescendant(i.object, this.targetMarker) &&
        !isDescendant(i.object, this.group) &&
        !isDescendantByUserData(i.object, 'isExplosion') &&
        i.distance > distToTank - 2
      );

      if (validIntersects.length > 0) {
        aimPoint.copy(validIntersects[0].point);
      } else {
        raycaster.ray.at(1000, aimPoint);
      }
      
      const dirToAim = new THREE.Vector3().subVectors(aimPoint, turretWorldPos).normalize();
      const localDir = dirToAim.clone().applyQuaternion(this.group.quaternion.clone().invert());
      
      let targetTurretYaw = Math.atan2(localDir.x, localDir.z) + Math.PI;
      
      // Normalize angles to prevent spinning
      let currentYaw = this.turret.rotation.y;
      while (targetTurretYaw - currentYaw > Math.PI) targetTurretYaw -= Math.PI * 2;
      while (targetTurretYaw - currentYaw < -Math.PI) targetTurretYaw += Math.PI * 2;
      
      this.turret.rotation.y = THREE.MathUtils.damp(currentYaw, targetTurretYaw, 20, delta);

      const localDirBarrel = dirToAim.clone().applyQuaternion(this.turret.getWorldQuaternion(new THREE.Quaternion()).invert());
      let targetBarrelPitch = Math.asin(localDirBarrel.y);
      targetBarrelPitch = THREE.MathUtils.clamp(targetBarrelPitch, -Math.PI/4, Math.PI/4);
      
      // Normalize pitch to prevent spinning
      let currentPitch = this.barrel.rotation.x;
      while (targetBarrelPitch - currentPitch > Math.PI) targetBarrelPitch -= Math.PI * 2;
      while (targetBarrelPitch - currentPitch < -Math.PI) targetBarrelPitch += Math.PI * 2;

      this.barrel.rotation.x = THREE.MathUtils.damp(currentPitch, targetBarrelPitch, 20, delta);
      
      // Update world matrices so trajectory calculation uses the latest barrel position
      this.turret.updateMatrixWorld();
      this.barrel.updateMatrixWorld();
      
      // Apply camera shake AFTER aiming so the crosshair raycast is stable
      if (this.cameraShake > 0) {
        camera.position.x += (Math.random() - 0.5) * this.cameraShake;
        camera.position.y += (Math.random() - 0.5) * this.cameraShake;
        camera.position.z += (Math.random() - 0.5) * this.cameraShake;
        this.cameraShake -= delta * 5.0;
        if (this.cameraShake < 0) this.cameraShake = 0;
        camera.lookAt(target);
      }
    }

    if (input.mouseDown) {
      this.trajectoryLine.visible = true;
      this.targetMarker.visible = true;
      
      this.markerTime += delta;
      const scale = 1.0 + Math.sin(this.markerTime * 10) * 0.1;
      this.targetMarker.scale.set(scale, scale, scale);
      this.targetMarker.children[0].rotation.z = this.markerTime * 2;
      
      const points = [];
      const barrelTip = new THREE.Vector3(0, 0, -4.5);
      barrelTip.applyMatrix4(this.barrel.matrixWorld);
      const direction = new THREE.Vector3(0, 0, -1);
      direction.transformDirection(this.barrel.matrixWorld);
      
      const speed = 100;
      const initialVel = direction.clone().multiplyScalar(speed);
      
      // Calculate effective gravity: world gravity + (10 * mass) / mass
      // Since mass is 10, force added is 100. Acceleration = force / mass = 100 / 10 = 10.
      // So effective gravity Y = world.gravity.y + 10
      const effectiveGravity = new THREE.Vector3(0, this.world.gravity.y + 10, 0);
      
      let currentPos = barrelTip.clone();
      let currentVel = initialVel.clone();
      const timeStep = 0.05;
      
      let hitGround = false;
      for (let i = 0; i < 60; i++) {
        points.push(currentPos.clone());
        currentVel.addScaledVector(effectiveGravity, timeStep);
        currentPos.addScaledVector(currentVel, timeStep);
        if (currentPos.y <= 0) {
          // Interpolate to find exact ground hit
          const prevPos = points[points.length - 1];
          const t = prevPos.y / (prevPos.y - currentPos.y);
          const hitPos = prevPos.clone().lerp(currentPos, t);
          points.push(hitPos);
          this.targetMarker.position.copy(hitPos);
          hitGround = true;
          break;
        }
      }
      this.trajectoryLine.geometry.dispose();
      this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
      this.trajectoryLine.computeLineDistances();
      if (!hitGround) {
        this.targetMarker.position.copy(points[points.length - 1]);
      }
    } else {
      this.trajectoryLine.visible = false;
      this.targetMarker.visible = false;
      
      if (this.wasMouseDown && this.recoil <= 0) {
        this.recoil = 1.0;
        this.shoot();
      }
    }
    
    this.wasMouseDown = input.mouseDown;

    if (this.recoil > 0) {
      this.recoil -= delta * 5;
      this.barrel.position.z = -1.4 + (this.recoil > 0 ? this.recoil * 0.5 : 0);
      
      const isFlashing = this.recoil > 0.8;
      this.muzzleFlash.intensity = isFlashing ? 10 : 0;
      this.muzzleMesh.visible = isFlashing;
      if (isFlashing) {
        const scale = 1 + Math.random() * 0.5;
        this.muzzleMesh.scale.set(scale, scale, scale);
        this.muzzleMesh.rotation.z = Math.random() * Math.PI;
        if ((this.muzzleMesh.material as any).uniforms) {
          (this.muzzleMesh.material as any).uniforms.time.value += delta * 10;
        }
      }
    } else {
      this.muzzleFlash.intensity = 0;
      this.muzzleMesh.visible = false;
      this.barrel.position.z = -1.4;
    }

    const isMoving = moveZ !== 0 || turnY !== 0;
    const dummy = new THREE.Object3D();
    this.particleData.forEach((p, i) => {
      p.life -= delta;
      if (p.life <= 0 && isMoving) {
        p.life = p.maxLife = 0.5 + Math.random() * 0.5;
        const isLeft = Math.random() > 0.5;
        p.pos.set(isLeft ? -1 : 1, 1.4, 2.8);
        p.vel.set((Math.random() - 0.5) * 0.5, 1 + Math.random(), (Math.random() - 0.5) * 0.5);
        p.scale = 0.1 + Math.random() * 0.2;
      } else if (p.life <= 0 && !isMoving && Math.random() < 0.1) {
        // Idle exhaust smoke
        p.life = p.maxLife = 1.0 + Math.random() * 1.0;
        p.pos.set((Math.random() - 0.5) * 0.5, 0.8, 2.8);
        p.vel.set((Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2);
        p.scale = 0.2 + Math.random() * 0.2;
      }
      
      if (p.life > 0) {
        p.pos.addScaledVector(p.vel, delta);
        p.scale += delta * 0.5;
        dummy.position.copy(p.pos);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        this.particles.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.particles.setMatrixAt(i, dummy.matrix);
      }
    });
    this.particles.instanceMatrix.needsUpdate = true;

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      
      // Counteract gravity slightly for a straighter shot
      p.body.force.y += p.body.mass * 10;
      
      if (p.material && p.material.uniforms) {
        p.material.uniforms.time.value += delta;
      }
      
      p.mesh.position.copy(p.body.position as unknown as THREE.Vector3);
      p.mesh.quaternion.copy(p.body.quaternion as unknown as THREE.Quaternion);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.world.removeBody(p.body);
        this.projectiles.splice(i, 1);
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.update(delta);
      
      if (exp.isDead()) {
        exp.dispose();
        this.explosions.splice(i, 1);
      }
    }
  }

  shoot() {
    const projectileGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const projectileMat = getFireMaterial(0x0000ff, 0x00aaff, 0xffffff);
    const mesh = new THREE.Mesh(projectileGeo, projectileMat);
    mesh.userData.isProjectile = true;
    
    // Add point light to projectile
    const light = new THREE.PointLight(0x00aaff, 1, 10);
    mesh.add(light);
    
    // Get world position and direction of the barrel tip
    const barrelTip = new THREE.Vector3(0, 0, -4.5);
    barrelTip.applyMatrix4(this.barrel.matrixWorld);
    
    const direction = new THREE.Vector3(0, 0, -1);
    direction.transformDirection(this.barrel.matrixWorld);

    mesh.position.copy(barrelTip);
    this.scene.add(mesh);

    const shape = new CANNON.Sphere(0.3);
    const body = new CANNON.Body({
      mass: 1,
      shape: shape,
      position: new CANNON.Vec3(barrelTip.x, barrelTip.y, barrelTip.z),
    });
    
    const speed = 100;
    body.velocity.set(direction.x * speed, direction.y * speed, direction.z * speed);
    
    (body as any).isBullet = true;
    (body as any).damage = 50; // Tank deals 50 damage
    
    this.world.addBody(body);
    
    const projectileObj = { mesh, body, life: 3.0, material: projectileMat };
    this.projectiles.push(projectileObj);

    // Collision event
    body.addEventListener("collide", (e: any) => {
      // Create explosion effect
      this.createExplosion(body.position.x, body.position.y, body.position.z);
      
      // Remove projectile on next frame
      projectileObj.life = 0;
    });
    
    // Apply recoil force to tank
    const recoilImpulse = 5000; // Reduced from 50000 to prevent "flying"
    const recoilForce = new CANNON.Vec3(-direction.x * recoilImpulse, 0, -direction.z * recoilImpulse);
    this.body.applyImpulse(recoilForce, this.body.position);
  }

  createExplosion(x: number, y: number, z: number) {
    // Visual explosion
    const explosionObj = new AAAExplosion(this.scene, new THREE.Vector3(x, y, z));
    this.explosions.push(explosionObj);
    
    // Camera shake based on distance
    const distToExplosion = this.body.position.distanceTo(new CANNON.Vec3(x, y, z));
    if (distToExplosion < 50) {
      this.cameraShake = Math.max(this.cameraShake, 1.0 * (1.0 - distToExplosion / 50));
    }

    // Apply explosion force to nearby bodies
    const explosionPos = new CANNON.Vec3(x, y, z);
    const explosionRadius = 10;
    const explosionForce = 800;

    for (const body of this.world.bodies) {
      if (body.type === CANNON.Body.DYNAMIC && body !== this.body) {
        const distance = body.position.distanceTo(explosionPos);
        if (distance < explosionRadius) {
          const forceDir = body.position.vsub(explosionPos);
          forceDir.normalize();
          const forceMultiplier = 1 - (distance / explosionRadius);
          const force = forceDir.scale(explosionForce * forceMultiplier);
          body.applyImpulse(force, body.position);
        }
      }
    }
  }
}
