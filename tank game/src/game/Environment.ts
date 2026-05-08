import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class Environment {
  dynamicObjects: { mesh: THREE.Mesh, body: CANNON.Body }[] = [];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, world: CANNON.World) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    
    // Better sky and fog
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.012);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(100, 150, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    const d = 150;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.BoxGeometry(1000, 2, 1000);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x4a7c3b,
      roughness: 0.9,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    // Ground Physics
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(500, 1, 500)),
    });
    groundBody.position.set(0, -1, 0);
    world.addBody(groundBody);

    // Materials for environment objects
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.7 });
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, flatShading: true });
    const platformMat = new THREE.MeshStandardMaterial({ color: 0xcc8844, roughness: 0.8 });
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xaa6633, roughness: 0.8 });

    const createTree = (x: number, z: number, scale: number) => {
      const treeGroup = new THREE.Group();
      
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3), trunkMat);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      const leaves1 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4, 8), leavesMat);
      leaves1.position.y = 4;
      leaves1.castShadow = true;
      treeGroup.add(leaves1);

      const leaves2 = new THREE.Mesh(new THREE.ConeGeometry(2, 3, 8), leavesMat);
      leaves2.position.y = 5.5;
      leaves2.castShadow = true;
      treeGroup.add(leaves2);

      const leaves3 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.5, 8), leavesMat);
      leaves3.position.y = 7;
      leaves3.castShadow = true;
      treeGroup.add(leaves3);

      treeGroup.position.set(x, 0, z);
      treeGroup.scale.setScalar(scale);
      scene.add(treeGroup);

      treeGroup.updateMatrixWorld(true);
      treeGroup.matrixAutoUpdate = false;
      trunk.matrixAutoUpdate = false;
      leaves1.matrixAutoUpdate = false;
      leaves2.matrixAutoUpdate = false;
      leaves3.matrixAutoUpdate = false;

      // Collider for the trunk
      const trunkShape = new CANNON.Cylinder(0.4 * scale, 0.6 * scale, 3 * scale, 8);
      const trunkBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      trunkBody.addShape(trunkShape, new CANNON.Vec3(0, 1.5 * scale, 0));
      trunkBody.position.set(x, 0, z);
      world.addBody(trunkBody);
    };

    const createRock = (x: number, z: number, scale: number) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMat);
      rock.position.set(x, scale * 0.5, z);
      rock.scale.set(scale, scale * 0.8, scale);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
      rock.updateMatrixWorld(true);
      rock.matrixAutoUpdate = false;

      const rockShape = new CANNON.Sphere(scale * 0.9);
      const rockBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      rockBody.addShape(rockShape);
      rockBody.position.set(x, scale * 0.5, z);
      world.addBody(rockBody);
    };

    const createPlatform = (x: number, y: number, z: number, w: number, h: number, d: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, platformMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      mesh.updateMatrixWorld(true);
      mesh.matrixAutoUpdate = false;

      const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2));
      const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      body.addShape(shape);
      body.position.set(x, y, z);
      world.addBody(body);
    };

    const createRamp = (x: number, y: number, z: number, w: number, h: number, d: number, angle: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, rampMat);
      mesh.position.set(x, y, z);
      mesh.rotation.x = angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      mesh.updateMatrixWorld(true);
      mesh.matrixAutoUpdate = false;

      const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2));
      const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      body.addShape(shape);
      body.position.set(x, y, z);
      
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), angle);
      body.quaternion.copy(q);
      
      world.addBody(body);
    };

    const createCloud = (x: number, y: number, z: number, scale: number) => {
      const geo = new THREE.DodecahedronGeometry(1, 0);
      const cloud = new THREE.Mesh(geo, cloudMat);
      
      // Stretch it out a bit to look like a cloud
      cloud.scale.set(scale * 1.5, scale * 0.8, scale * 1.2);
      cloud.position.set(x, y, z);
      
      // Random rotation
      cloud.rotation.y = Math.random() * Math.PI * 2;
      cloud.rotation.z = (Math.random() - 0.5) * 0.2;
      
      cloud.matrixAutoUpdate = false;
      cloud.updateMatrix();
      
      scene.add(cloud);
    };

    // --- BUILD THE WORLD ---

    // 1. Parkour Course
    createPlatform(0, 0.5, -10, 4, 1, 4); // Start block
    createPlatform(0, 1.5, -16, 3, 1, 3); // Jump 1
    createPlatform(0, 2.5, -22, 2, 1, 2); // Jump 2
    createPlatform(5, 3.5, -22, 2, 1, 2); // Jump 3 (Right)
    createPlatform(10, 4.5, -22, 4, 1, 4); // Checkpoint
    
    // 2. Ramps and Slides
    createPlatform(10, 4.5, -30, 4, 1, 4);
    createRamp(10, 2.5, -36, 4, 1, 10, -Math.PI / 6); // Slide down
    createPlatform(10, 0.5, -42, 6, 1, 6); // Landing pad

    // 3. Giant staircase
    for (let i = 0; i < 10; i++) {
        createPlatform(-10 - i * 2, i * 0.5 + 0.25, -10, 2, 0.5, 4);
    }
    createPlatform(-30, 5, -10, 4, 1, 4); // Top of stairs

    // Generate forest and rocks (Surrounding the playground)
    for (let i = 0; i < 150; i++) {
      const x = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      
      // Keep the center and parkour area clear
      if (x > -40 && x < 20 && z > -50 && z < 10) continue;
      
      if (Math.random() > 0.3) {
        createTree(x, z, 0.8 + Math.random() * 0.8);
      } else {
        createRock(x, z, 1 + Math.random() * 3);
      }
    }

    // Generate clouds
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 400;
      const z = (Math.random() - 0.5) * 400;
      const y = 40 + Math.random() * 30;
      createCloud(x, y, z, 5 + Math.random() * 10);
    }

    // Add some ruins/walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.9 });
    const createWall = (x: number, z: number, w: number, h: number, d: number, rotY: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      wall.position.set(x, h/2, z);
      wall.rotation.y = rotY;
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
      wall.updateMatrixWorld(true);
      wall.matrixAutoUpdate = false;
      
      const wallShape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
      const wallBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
      wallBody.addShape(wallShape);
      wallBody.position.set(x, h / 2, z);
      wallBody.quaternion.setFromEuler(0, rotY, 0);
      world.addBody(wallBody);
    };

    createWall(15, 10, 10, 4, 2, 0);
    createWall(15, -10, 10, 4, 2, Math.PI / 2);
    createWall(-20, 5, 8, 3, 2, Math.PI / 4);
    createWall(-25, -15, 12, 5, 2, -Math.PI / 6);

    // Add a physical bridge
    this.createBridge(scene, world, new THREE.Vector3(0, 5, 20), new THREE.Vector3(0, 5, 40));

    // Add dynamic crates
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const crateGeo = new THREE.BoxGeometry(2, 2, 2);
    const crateShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));

    for (let i = 0; i < 15; i++) {
      const mesh = new THREE.Mesh(crateGeo, crateMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: 50,
        shape: crateShape,
        position: new CANNON.Vec3(
          (Math.random() - 0.5) * 40,
          5 + Math.random() * 10,
          (Math.random() - 0.5) * 40
        )
      });
      world.addBody(body);

      this.dynamicObjects.push({ mesh, body });
    }
  }

  createBridge(scene: THREE.Scene, world: CANNON.World, start: THREE.Vector3, end: THREE.Vector3) {
    const numPlanks = 10;
    const plankWidth = 4;
    const plankLength = start.distanceTo(end) / numPlanks;
    const plankThickness = 0.5;
    const gap = 0.2;

    const plankGeo = new THREE.BoxGeometry(plankWidth, plankThickness, plankLength - gap);
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9 });
    const plankShape = new CANNON.Box(new CANNON.Vec3(plankWidth / 2, plankThickness / 2, (plankLength - gap) / 2));

    let previousBody: CANNON.Body | null = null;

    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    const cannonQuat = new CANNON.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);

    for (let i = 0; i < numPlanks; i++) {
      const isStatic = i === 0 || i === numPlanks - 1;
      const mass = isStatic ? 0 : 50;

      const position = new THREE.Vector3().copy(start).add(direction.clone().multiplyScalar(i * plankLength + plankLength / 2));

      const mesh = new THREE.Mesh(plankGeo, plankMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: mass,
        shape: plankShape,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        quaternion: cannonQuat,
        linearDamping: 0.5,
        angularDamping: 0.5,
      });
      world.addBody(body);

      this.dynamicObjects.push({ mesh, body });

      if (previousBody) {
        // Create a hinge constraint between the previous plank and the current one
        const constraint = new CANNON.HingeConstraint(previousBody, body, {
          pivotA: new CANNON.Vec3(0, 0, plankLength / 2),
          axisA: new CANNON.Vec3(1, 0, 0),
          pivotB: new CANNON.Vec3(0, 0, -plankLength / 2),
          axisB: new CANNON.Vec3(1, 0, 0),
        });
        world.addConstraint(constraint);
      }

      previousBody = body;
    }
  }

  update(cameraPosition: THREE.Vector3) {
    const cullDistanceSq = 150 * 150; // 150 units cull distance
    
    for (const obj of this.dynamicObjects) {
      obj.mesh.position.copy(obj.body.position as unknown as THREE.Vector3);
      obj.mesh.quaternion.copy(obj.body.quaternion as unknown as THREE.Quaternion);
      
      // Simple distance culling for dynamic objects
      if (obj.mesh.position.distanceToSquared(cameraPosition) > cullDistanceSq) {
        obj.mesh.visible = false;
      } else {
        obj.mesh.visible = true;
      }
    }
  }
}
