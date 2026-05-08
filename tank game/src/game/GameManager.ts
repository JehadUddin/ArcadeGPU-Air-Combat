import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from './InputManager';
import { Environment } from './Environment';
import { Player } from './Player';
import { Tank } from './Tank';
import { Enemy, EnemyState, EnemyType } from './Enemy';

export class GameManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  input: InputManager;
  environment: Environment;
  player: Player;
  tank: Tank;
  enemies: Enemy[] = [];
  world: CANNON.World;
  lastTime: number;
  
  isPlayerInTank: boolean = false;
  
  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 1000);
    
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Optimize pixel ratio for mobile
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.world = new CANNON.World();
    this.world.gravity.set(0, -25, 0);
    this.world.defaultContactMaterial.friction = 0.0;
    this.world.defaultContactMaterial.restitution = 0.0;

    this.input = new InputManager();
    this.environment = new Environment(this.scene, this.renderer, this.world);
    this.player = new Player(this.scene, this.world);
    this.tank = new Tank(this.scene, this.world);
    
    // Spawn different types of enemies
    const enemyTypes = [EnemyType.STANDARD, EnemyType.HEAVY, EnemyType.SCOUT];
    for (let i = 0; i < enemyTypes.length; i++) {
      const startPos = new THREE.Vector3(
        (Math.random() - 0.5) * 80,
        5,
        (Math.random() - 0.5) * 80 - 30
      );
      this.enemies.push(new Enemy(this.scene, this.world, startPos, enemyTypes[i]));
    }
    
    this.lastTime = performance.now();

    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    this.animate();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const currentTime = performance.now();
    const delta = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    // Dynamic Gravity Toggle
    if (this.input.keys['KeyG']) {
      this.input.keys['KeyG'] = false; // Consume input
      if (this.world.gravity.y === -25) {
        this.world.gravity.set(0, -9.81, 0); // Earth
        console.log("Gravity: Earth (-9.81)");
      } else if (this.world.gravity.y === -9.81) {
        this.world.gravity.set(0, -1.62, 0); // Moon
        console.log("Gravity: Moon (-1.62)");
      } else {
        this.world.gravity.set(0, -25, 0); // Heavy
        console.log("Gravity: Heavy (-25)");
      }
      
      // Wake up all bodies so they react to the new gravity
      for (const body of this.world.bodies) {
        if (body.type === CANNON.Body.DYNAMIC) {
          body.wakeUp();
        }
      }
    }

    if (this.input.keys['KeyE']) {
      const dist = this.player.position.distanceTo(this.tank.position);
      if (dist < 5) {
        this.isPlayerInTank = !this.isPlayerInTank;
        this.input.keys['KeyE'] = false;
        
        if (this.isPlayerInTank) {
          this.player.mesh.visible = false;
          // Move player body out of the way or disable collision
          this.player.body.position.set(0, -100, 0);
        } else {
          this.player.mesh.visible = true;
          // Place player next to tank
          const exitPos = this.tank.position.clone().add(
            new THREE.Vector3(3, 2, 0).applyQuaternion(this.tank.group.quaternion)
          );
          this.player.body.position.set(exitPos.x, exitPos.y, exitPos.z);
          this.player.body.velocity.set(0, 0, 0);
        }
      }
    }

    // 1. Input -> Velocity (Movement)
    if (this.isPlayerInTank) {
      this.tank.updateMovement(delta, this.input);
    } else {
      this.player.updateMovement(delta, this.input);
    }

    // 2. Physics Step
    this.world.step(1/60, delta, 3);

    // 3. Sync Mesh & Visuals
    this.tank.updateVisuals(delta, this.input, this.isPlayerInTank ? this.camera : null);
    this.player.updateVisuals(delta, this.input, !this.isPlayerInTank ? this.camera : null);

    // 4. Update Enemies
    const targetPos = this.isPlayerInTank ? this.tank.position : this.player.position;
    const targetVel = this.isPlayerInTank ? this.tank.velocity : this.player.velocity;
    
    for (const enemy of this.enemies) {
      enemy.update(delta, targetPos, targetVel, this.enemies);
    }

    this.environment.update(this.camera.position);

    this.renderer.render(this.scene, this.camera);
  }
}
