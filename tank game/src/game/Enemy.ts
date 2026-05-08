import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getExplosionMaterial, getProjectileMaterial, getFireMaterial } from './Shaders';
import { AAAExplosion } from './Explosion';

export enum EnemyState {
  PATROL,
  CHASE,
  ATTACK,
  FLANK,
  COVER,
  STUNNED,
  DEAD
}

export enum EnemyType {
  STANDARD,
  HEAVY,
  SCOUT
}

export class Enemy {
  mesh: THREE.Group;
  body: CANNON.Body;
  world: CANNON.World;
  scene: THREE.Scene;
  
  type: EnemyType;
  state: EnemyState = EnemyState.PATROL;
  health: number = 100;
  maxHealth: number = 100;
  speedMultiplier: number = 1.0;
  fireRateBase: number = 2.0;
  projectileSpeed: number = 40;
  damage: number = 10;
  detectionRange: number = 40;
  attackRange: number = 20;
  
  eyeMaterial: THREE.MeshBasicMaterial;
  
  patrolCenter: THREE.Vector3;
  patrolTarget: THREE.Vector3;
  
  fireTimer: number = 0;
  burstCount: number = 0;
  burstTimer: number = 0;
  isBursting: boolean = false;
  
  strafeTimer: number = 0;
  strafeDir: number = 1;
  
  coverTarget: THREE.Vector3 | null = null;
  flankAngle: number = 1;
  
  healthBarGroup: THREE.Group;
  healthBarFill: THREE.Mesh;
  
  projectiles: { mesh: THREE.Mesh, body: CANNON.Body, life: number, material?: THREE.ShaderMaterial }[] = [];
  explosions: AAAExplosion[] = [];
  
  constructor(scene: THREE.Scene, world: CANNON.World, startPos: THREE.Vector3, type: EnemyType = EnemyType.STANDARD) {
    this.scene = scene;
    this.world = world;
    this.type = type;
    this.patrolCenter = startPos.clone();
    this.patrolTarget = this.getRandomPatrolPoint();
    
    let bodyRadius = 3.0;
    let bodyColor = 0x444455;
    let mass = 50;

    switch (type) {
      case EnemyType.HEAVY:
        this.maxHealth = 250;
        this.speedMultiplier = 0.5;
        this.fireRateBase = 3.0;
        this.projectileSpeed = 30;
        this.damage = 20;
        this.detectionRange = 30;
        this.attackRange = 25;
        bodyRadius = 5.0;
        bodyColor = 0x552222;
        mass = 150;
        break;
      case EnemyType.SCOUT:
        this.maxHealth = 50;
        this.speedMultiplier = 1.8;
        this.fireRateBase = 1.0;
        this.projectileSpeed = 50;
        this.damage = 5;
        this.detectionRange = 60;
        this.attackRange = 30;
        bodyRadius = 2.0;
        bodyColor = 0x224455;
        mass = 20;
        break;
      case EnemyType.STANDARD:
      default:
        this.maxHealth = 100;
        this.speedMultiplier = 1.0;
        this.fireRateBase = 2.0;
        this.projectileSpeed = 40;
        this.damage = 10;
        this.detectionRange = 40;
        this.attackRange = 20;
        bodyRadius = 3.0;
        bodyColor = 0x444455;
        break;
    }
    this.health = this.maxHealth;
    
    this.mesh = new THREE.Group();
    
    // Build Mesh
    const bodyGeo = new THREE.IcosahedronGeometry(bodyRadius, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: bodyColor, 
      metalness: 0.8, 
      roughness: 0.2,
      flatShading: true
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    this.mesh.add(bodyMesh);
    
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const eyeGeo = new THREE.CylinderGeometry(bodyRadius * 0.4, bodyRadius * 0.4, bodyRadius * 0.2, 16);
    eyeGeo.rotateX(Math.PI / 2);
    const eyeMesh = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    eyeMesh.position.set(0, 0, bodyRadius * 0.9);
    this.mesh.add(eyeMesh);
    
    // Armor Ring
    const ringGeo = new THREE.TorusGeometry(bodyRadius * 1.3, bodyRadius * 0.15, 8, 24);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.5, flatShading: true });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.mesh.add(ringMesh);
    
    // Blasters
    const blasterGeo = new THREE.BoxGeometry(bodyRadius * 0.3, bodyRadius * 0.3, bodyRadius * 1.5);
    const blasterMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
    
    const blasterL = new THREE.Mesh(blasterGeo, blasterMat);
    blasterL.position.set(-bodyRadius * 1.2, -bodyRadius * 0.2, bodyRadius * 0.5);
    this.mesh.add(blasterL);
    
    const blasterR = new THREE.Mesh(blasterGeo, blasterMat);
    blasterR.position.set(bodyRadius * 1.2, -bodyRadius * 0.2, bodyRadius * 0.5);
    this.mesh.add(blasterR);
    
    // Health Bar
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.set(0, bodyRadius + 1.5, 0);
    
    const bgGeo = new THREE.PlaneGeometry(2, 0.3);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.renderOrder = 999;
    this.healthBarGroup.add(bgMesh);
    
    const fillGeo = new THREE.PlaneGeometry(1.9, 0.2);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, depthWrite: false });
    this.healthBarFill = new THREE.Mesh(fillGeo, fillMat);
    this.healthBarFill.position.z = 0.01;
    this.healthBarFill.renderOrder = 1000;
    this.healthBarGroup.add(this.healthBarFill);
    
    this.mesh.add(this.healthBarGroup);
    
    scene.add(this.mesh);
    
    // Physics
    const shape = new CANNON.Sphere(bodyRadius);
    this.body = new CANNON.Body({
      mass: mass,
      shape: shape,
      position: new CANNON.Vec3(startPos.x, startPos.y, startPos.z),
      linearDamping: 0.9,
      angularDamping: 0.9,
    });
    world.addBody(this.body);
    
    // Collision
    this.body.addEventListener("collide", (e: any) => {
      if (e.body && e.body.isBullet) {
        const damage = e.body.damage || 35;
        this.takeDamage(damage);
      }
    });
  }
  
  getRandomPatrolPoint() {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 15;
    return new THREE.Vector3(
      this.patrolCenter.x + Math.cos(angle) * radius,
      this.patrolCenter.y,
      this.patrolCenter.z + Math.sin(angle) * radius
    );
  }
  
  takeDamage(amount: number) {
    if (this.state === EnemyState.DEAD) return;
    
    this.health -= amount;
    this.state = EnemyState.STUNNED;
    this.eyeMaterial.color.setHex(0xffff00);
    
    // Update health bar
    const healthPercent = Math.max(0, this.health / this.maxHealth);
    this.healthBarFill.scale.x = healthPercent;
    this.healthBarFill.position.x = -0.95 * (1 - healthPercent); // Keep left-aligned
    
    if (healthPercent > 0.5) {
      (this.healthBarFill.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00);
    } else if (healthPercent > 0.25) {
      (this.healthBarFill.material as THREE.MeshBasicMaterial).color.setHex(0xffff00);
    } else {
      (this.healthBarFill.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);
    }
    
    setTimeout(() => {
      if (this.state !== EnemyState.DEAD) {
        if (this.health < this.maxHealth * 0.4) {
          this.state = EnemyState.COVER;
          this.findCover(new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z));
        } else {
          this.state = EnemyState.CHASE;
        }
      }
    }, 500);
    
    if (this.health <= 0) {
      this.die();
    }
  }

  findCover(targetPos: THREE.Vector3) {
    let bestCover: THREE.Vector3 | null = null;
    let bestDist = Infinity;
    
    const myPos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    
    for (const body of this.world.bodies) {
      if (body.type === CANNON.Body.STATIC && body.shapes.length > 0) {
        if (body.position.y < 0) continue; // Skip ground
        
        const coverPos = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
        const distToCover = myPos.distanceTo(coverPos);
        
        if (distToCover < 40 && distToCover > 2) {
          const dirFromTarget = new THREE.Vector3().subVectors(coverPos, targetPos).normalize();
          const hidePos = coverPos.clone().add(dirFromTarget.multiplyScalar(4));
          
          if (distToCover < bestDist) {
            bestDist = distToCover;
            bestCover = hidePos;
          }
        }
      }
    }
    this.coverTarget = bestCover;
  }
  
  die() {
    this.state = EnemyState.DEAD;
    this.healthBarGroup.visible = false;
    
    // Remove from scene (physics body is removed in update loop to avoid collision callback errors)
    this.scene.remove(this.mesh);
    
    // Explosion effect
    const explosionObj = new AAAExplosion(this.scene, this.mesh.position.clone());
    this.explosions.push(explosionObj);
  }
  
  update(delta: number, targetPos: THREE.Vector3, targetVel: THREE.Vector3, allEnemies: Enemy[]) {
    if (this.state === EnemyState.DEAD) {
      if (this.body.world) {
        this.world.removeBody(this.body);
      }
      this.updateProjectiles(delta);
      return;
    }
    
    const pos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
    const distToTarget = pos.distanceTo(targetPos);
    
    // State Transitions
    if (this.state !== EnemyState.STUNNED) {
      // Line of sight check using raycast
      let hasLineOfSight = false;
      const from = new CANNON.Vec3(pos.x, pos.y, pos.z);
      const to = new CANNON.Vec3(targetPos.x, targetPos.y, targetPos.z);
      const result = new CANNON.RaycastResult();
      
      // We do a simple raycast to see if there's a static object in the way
      this.world.raycastClosest(from, to, {
        skipBackfaces: true,
        collisionFilterMask: 1 // Assuming static objects are group 1
      }, result);
      
      // If we didn't hit anything, or we hit the target (which might not be in the mask, so no hit means clear path)
      // Actually, CANNON raycast might hit the ground. Let's just use distance and a simple check.
      // For a real game, we'd set up collision groups. For now, let's assume clear sight if within distance.
      hasLineOfSight = true; 
      
      if (distToTarget < this.attackRange && hasLineOfSight) {
        if (this.health < this.maxHealth * 0.4 && this.state !== EnemyState.COVER) {
          this.state = EnemyState.COVER;
          this.findCover(targetPos);
        } else if (this.state !== EnemyState.COVER && this.state !== EnemyState.FLANK && this.state !== EnemyState.ATTACK) {
          let attackers = 0;
          for (const other of allEnemies) {
            if (other !== this && other.state === EnemyState.ATTACK) attackers++;
          }
          if (attackers >= 1 && Math.random() < 0.5) {
            this.state = EnemyState.FLANK;
            this.flankAngle = Math.random() > 0.5 ? 1 : -1;
          } else {
            this.state = EnemyState.ATTACK;
          }
        }
      } else if (distToTarget < this.detectionRange && hasLineOfSight && this.state !== EnemyState.COVER) {
        this.state = EnemyState.CHASE;
      } else if (this.state === EnemyState.CHASE && distToTarget > this.detectionRange + 10) {
        this.state = EnemyState.PATROL;
        this.patrolCenter.copy(pos);
        this.patrolTarget = this.getRandomPatrolPoint();
      }
    }
    
    // Hover mechanics
    const fromHover = new CANNON.Vec3(pos.x, pos.y, pos.z);
    const toHover = new CANNON.Vec3(pos.x, pos.y - 10, pos.z);
    const resultHover = new CANNON.RaycastResult();
    this.world.raycastClosest(fromHover, toHover, { skipBackfaces: true }, resultHover);
    
    let groundY = 0;
    if (resultHover.hasHit) {
      groundY = resultHover.hitPointWorld.y;
    }
    
    const targetHeight = groundY + this.body.shapes[0].boundingSphereRadius + 1;
    const heightDiff = targetHeight - this.body.position.y;
    
    const hoverForce = heightDiff * 300 - this.body.velocity.y * 50;
    this.body.applyForce(new CANNON.Vec3(0, hoverForce, 0), this.body.position);
    
    // State Logic
    let moveTarget = this.patrolTarget;
    let speed = 10;
    let lookTarget = moveTarget;
    
    if (this.state === EnemyState.PATROL) {
      this.eyeMaterial.color.setHex(0x00ff00);
      if (pos.distanceTo(this.patrolTarget) < 2) {
        this.patrolTarget = this.getRandomPatrolPoint();
      }
      moveTarget = this.patrolTarget;
      lookTarget = moveTarget;
      speed = 10 * this.speedMultiplier;
    } else if (this.state === EnemyState.CHASE) {
      this.eyeMaterial.color.setHex(0xffaa00);
      moveTarget = targetPos;
      lookTarget = targetPos;
      speed = 20 * this.speedMultiplier;
    } else if (this.state === EnemyState.ATTACK) {
      this.eyeMaterial.color.setHex(0xff0000);
      
      this.strafeTimer -= delta;
      if (this.strafeTimer <= 0) {
        this.strafeDir = Math.random() > 0.5 ? 1 : -1;
        this.strafeTimer = 1 + Math.random() * 2;
      }
      
      const dirToTarget = new THREE.Vector3().subVectors(targetPos, pos).normalize();
      const right = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x);
      
      moveTarget = pos.clone().add(right.multiplyScalar(this.strafeDir * 5));
      if (distToTarget < 10) {
        moveTarget.add(dirToTarget.clone().multiplyScalar(-5));
      }
      
      lookTarget = targetPos;
      speed = 15 * this.speedMultiplier;
      
      // Improved Burst Firing Logic
      if (this.isBursting) {
        this.burstTimer -= delta;
        if (this.burstTimer <= 0) {
          const projSpeed = this.projectileSpeed;
          const leadTime = distToTarget / projSpeed;
          const predictedPos = targetPos.clone().add(targetVel.clone().multiplyScalar(leadTime));
          
          // Add random spread
          const spread = 1.0;
          predictedPos.x += (Math.random() - 0.5) * spread;
          predictedPos.y += (Math.random() - 0.5) * spread;
          predictedPos.z += (Math.random() - 0.5) * spread;

          this.shoot(predictedPos);
          this.burstCount--;
          
          if (this.burstCount <= 0) {
            this.isBursting = false;
            this.fireTimer = this.fireRateBase + Math.random() * this.fireRateBase;
          } else {
            this.burstTimer = 0.15 + Math.random() * 0.1; // Delay between shots in burst
          }
        }
      } else {
        this.fireTimer -= delta;
        if (this.fireTimer <= 0) {
          this.isBursting = true;
          // Heavy fires 2 shots, Scouts fire more, Standard fires 3
          this.burstCount = this.type === EnemyType.HEAVY ? 2 : (this.type === EnemyType.SCOUT ? 5 : 3);
          this.burstTimer = 0;
        }
      }
    } else if (this.state === EnemyState.FLANK) {
      this.eyeMaterial.color.setHex(0xaa00ff);
      
      const dirToTarget = new THREE.Vector3().subVectors(pos, targetPos).normalize();
      const right = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x).multiplyScalar(this.flankAngle);
      
      moveTarget = targetPos.clone().add(right.multiplyScalar(15)).add(dirToTarget.multiplyScalar(5));
      lookTarget = targetPos;
      speed = 18 * this.speedMultiplier;
      
      if (distToTarget < 15 || Math.random() < 0.005) {
        this.state = EnemyState.ATTACK;
      }
    } else if (this.state === EnemyState.COVER) {
      this.eyeMaterial.color.setHex(0x00aaff);
      if (this.coverTarget) {
        moveTarget = this.coverTarget;
        lookTarget = targetPos;
        speed = 25 * this.speedMultiplier;
        
        if (pos.distanceTo(this.coverTarget) < 3) {
          this.health = Math.min(this.maxHealth, this.health + delta * (this.maxHealth * 0.15));
          if (this.health > this.maxHealth * 0.8) {
            this.state = EnemyState.ATTACK;
            this.coverTarget = null;
          }
        }
      } else {
        this.state = EnemyState.CHASE;
      }
    }
    
    if (this.state !== EnemyState.STUNNED) {
      // Separation (Avoid other enemies)
      const separationForce = new THREE.Vector3();
      let count = 0;
      for (const other of allEnemies) {
        if (other !== this && other.state !== EnemyState.DEAD) {
          const otherPos = new THREE.Vector3(other.body.position.x, other.body.position.y, other.body.position.z);
          const dist = pos.distanceTo(otherPos);
          if (dist < 4) {
            const pushDir = new THREE.Vector3().subVectors(pos, otherPos).normalize();
            separationForce.add(pushDir.multiplyScalar(10 / Math.max(dist, 0.1)));
            count++;
          }
        }
      }
      
      // Movement
      const dir = new THREE.Vector3().subVectors(moveTarget, pos);
      dir.y = 0;
      
      if (count > 0) {
        dir.add(separationForce);
      }
      
      if (dir.lengthSq() > 0.1) {
        dir.normalize();
        this.body.applyForce(new CANNON.Vec3(dir.x * speed * 50, 0, dir.z * speed * 50), this.body.position);
      }
      
      // Rotation towards lookTarget
      const lookDir = new THREE.Vector3().subVectors(lookTarget, pos);
      if (lookDir.lengthSq() > 0.1) {
        const targetAngle = Math.atan2(lookDir.x, lookDir.z);
        const currentAngle = this.mesh.rotation.y;
        
        let diff = targetAngle - currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        this.mesh.rotation.y += diff * 5 * delta;
      }
    }
    
    // Sync mesh
    this.mesh.position.copy(this.body.position as any);
    
    // Tilt based on velocity
    const localVel = this.body.velocity.clone();
    const quat = new CANNON.Quaternion();
    quat.setFromEuler(0, -this.mesh.rotation.y, 0);
    const rotatedVel = quat.vmult(localVel);
    
    this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, rotatedVel.z * 0.02, 5 * delta);
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, -rotatedVel.x * 0.02, 5 * delta);
    
    // Health bar billboard and scaling
    if (this.healthBarGroup.visible) {
      // Make it face the camera
      // We need to get the camera position. Since we don't have direct access to the camera here,
      // we can use the targetPos (which is the player/camera position) as a good approximation
      // for making it face the player.
      
      // Get the world position of the health bar
      const healthBarWorldPos = new THREE.Vector3();
      this.healthBarGroup.getWorldPosition(healthBarWorldPos);
      
      // Calculate the direction from the health bar to the target
      const dirToTarget = new THREE.Vector3().subVectors(targetPos, healthBarWorldPos).normalize();
      
      // We want the health bar to face the target, but stay upright.
      // So we use lookAt, but we need to do it in world space, then convert back to local space.
      // A simpler way is to just set the rotation directly based on the direction to the target.
      
      // Since the health bar is a child of the enemy mesh, and the enemy mesh rotates,
      // we need to counteract the enemy mesh's rotation.
      
      // Reset rotation
      this.healthBarGroup.rotation.set(0, 0, 0);
      
      // Make it look at the target in world space
      // Since it's a child of the enemy mesh, we need to undo the enemy mesh's rotation
      this.healthBarGroup.quaternion.copy(this.mesh.quaternion).invert();
      
      // Now it's aligned with the world axes. Let's make it look at the target.
      // We can create a dummy object, make it look at the target, and copy its y-rotation.
      const dummy = new THREE.Object3D();
      dummy.position.copy(healthBarWorldPos);
      dummy.lookAt(targetPos);
      
      // Apply the rotation to the health bar group
      this.healthBarGroup.quaternion.multiply(dummy.quaternion);
      
      // Scale based on distance to keep it roughly the same size on screen
      const dist = pos.distanceTo(targetPos);
      const scale = Math.max(1, dist / 15); // Adjust 15 to change base scaling distance
      this.healthBarGroup.scale.set(scale, scale, scale);
    }
    
    this.updateProjectiles(delta);
  }
  
  shoot(targetPos: THREE.Vector3) {
    const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
    
    const projectileGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const projectileMat = getFireMaterial(0xe61919, 0xff8000, 0xffe619);
    const mesh = new THREE.Mesh(projectileGeo, projectileMat);
    mesh.userData.isProjectile = true;
    
    const spawnPos = this.mesh.position.clone().add(dir.clone().multiplyScalar(2.5));
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);
    
    const shape = new CANNON.Sphere(0.4);
    const body = new CANNON.Body({
      mass: 1,
      shape: shape,
      position: new CANNON.Vec3(spawnPos.x, spawnPos.y, spawnPos.z),
    });
    
    const speed = this.projectileSpeed;
    body.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed);
    
    (body as any).isEnemyBullet = true;
    (body as any).damage = this.damage;
    
    this.world.addBody(body);
    
    const projectileObj = { mesh, body, life: 2.0, material: projectileMat };
    this.projectiles.push(projectileObj);
    
    // Collision event
    body.addEventListener("collide", (e: any) => {
      this.createExplosion(body.position.x, body.position.y, body.position.z);
      projectileObj.life = 0;
    });
    
    // Recoil
    this.body.applyImpulse(new CANNON.Vec3(-dir.x * 100, -dir.y * 100, -dir.z * 100), this.body.position);
  }
  
  createExplosion(x: number, y: number, z: number) {
    const explosionObj = new AAAExplosion(this.scene, new THREE.Vector3(x, y, z));
    this.explosions.push(explosionObj);
  }
  
  updateProjectiles(delta: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      
      if (p.material && p.material.uniforms) {
        p.material.uniforms.time.value += delta;
      }
      
      p.mesh.position.copy(p.body.position as any);
      p.mesh.quaternion.copy(p.body.quaternion as any);
      
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
}
