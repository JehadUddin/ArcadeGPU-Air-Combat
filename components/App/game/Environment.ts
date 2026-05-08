import { gfx3JoltManager, JOLT_LAYER_NON_MOVING, Gfx3Jolt, JOLT_LAYER_MOVING } from '@lib/gfx3_jolt/gfx3_jolt_manager';
import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { gfx3MeshRenderer } from '@lib/gfx3_mesh/gfx3_mesh_renderer';
import { UT } from '@lib/core/utils';
import { Quaternion } from '@lib/core/quaternion';
import { createBoxMesh, createTerrainMesh } from './GameUtils';

export class Environment {
  floor: Gfx3Mesh;
  static meshesInitialized = false;
  static qMat = new Quaternion();
  
  static cloudMesh: Gfx3Mesh;
  
  clouds: { pos: vec3, scale: vec3, nextX: number }[] = [];

  constructor() {
    if (!Environment.meshesInitialized) {
      Environment.cloudMesh = createBoxMesh(1, 1, 1, [0.95, 0.95, 0.98]); 
      Environment.meshesInitialized = true;
    }

    const mapSize = 4000; // Very large map for flying
    // Two-tone green checkerboard
    const terrainData = createTerrainMesh(mapSize, mapSize, 64, 64, [0.35, 0.5, 0.3], [0.3, 0.45, 0.25]);
    this.floor = terrainData.mesh;
    
    // Add a single large flat box for physics ground instead of complex terrain mesh
    gfx3JoltManager.addBox({
        width: mapSize, height: 10, depth: mapSize,
        x: 0, y: -5, z: 0,
        motionType: Gfx3Jolt.EMotionType_Static,
        layer: JOLT_LAYER_NON_MOVING
    });

    // Add clouds high up
    for (let i = 0; i < 60; i++) {
        const cx = (Math.random() - 0.5) * mapSize;
        const cy = 200 + Math.random() * 300;
        const cz = (Math.random() - 0.5) * mapSize;
        const cw = 40 + Math.random() * 80;
        const ch = 10 + Math.random() * 15;
        const cd = 30 + Math.random() * 60;
        this.clouds.push({ pos: [cx, cy, cz], nextX: cx, scale: [cw, ch, cd] });
    }
  }
  
  update(ts: number) {
      // Animate clouds
      for (const cloud of this.clouds) {
          cloud.nextX += (ts / 1000) * 15; // Move slightly in X
          if (cloud.nextX > 2000) {
              cloud.nextX = -2000; // loop back
          }
      }
  }

  draw(cameraPos: vec3) {
    this.floor.draw();
    
    for (const cloud of this.clouds) {
        const ZERO: vec3 = [0,0,0];
        const mat = UT.MAT4_TRANSFORM([cloud.nextX, cloud.pos[1], cloud.pos[2]], ZERO, cloud.scale, Environment.qMat);
        gfx3MeshRenderer.drawMesh(Environment.cloudMesh, mat);
    }
  }
}
