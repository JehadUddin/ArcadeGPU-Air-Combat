import { Gfx3Mesh } from '@lib/gfx3_mesh/gfx3_mesh';
import { Gfx3MeshEffect } from '@lib/gfx3/gfx3_drawable';
import { UT } from '@lib/core/utils';

export function createBoxMesh(width: number, height: number, depth: number, color: [number, number, number]): Gfx3Mesh {
  const mesh = new Gfx3Mesh();
  mesh.setTag(0, 0, Gfx3MeshEffect.PIXELATION); 

  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  
  const coords = [
    -w, -h,  d,  w, -h,  d,  w,  h,  d,  -w, -h,  d,  w,  h,  d, -w,  h,  d,
     w, -h, -d, -w, -h, -d, -w,  h, -d,   w, -h, -d, -w,  h, -d,  w,  h, -d,
    -w,  h,  d,  w,  h,  d,  w,  h, -d,  -w,  h,  d,  w,  h, -d, -w,  h, -d,
    -w, -h, -d,  w, -h, -d,  w, -h,  d,  -w, -h, -d,  w, -h,  d, -w, -h,  d,
     w, -h,  d,  w, -h, -d,  w,  h, -d,   w, -h,  d,  w,  h, -d,  w,  h,  d,
    -w, -h, -d, -w, -h,  d, -w,  h,  d,  -w, -h, -d, -w,  h,  d, -w,  h, -d
  ];

  const colors = [];
  const normals = [];
  for (let i = 0; i < coords.length; i += 18) {
    const v0: vec3 = [coords[i], coords[i+1], coords[i+2]];
    const v1: vec3 = [coords[i+3], coords[i+4], coords[i+5]];
    const v2: vec3 = [coords[i+6], coords[i+7], coords[i+8]];
    const e1 = UT.VEC3_SUBSTRACT(v1, v0);
    const e2 = UT.VEC3_SUBSTRACT(v2, v0);
    const normal = UT.VEC3_NORMALIZE(UT.VEC3_CROSS(e1, e2));
    for (let j = 0; j < 6; j++) {
      colors.push(color[0], color[1], color[2]);
      normals.push(normal[0], normal[1], normal[2]);
    }
  }

  mesh.geo = Gfx3Mesh.buildVertices(coords.length / 3, coords, [], colors, normals);
  mesh.beginVertices(coords.length / 3);
  mesh.setVertices(mesh.geo.vertices);
  mesh.endVertices();

  return mesh;
}

export function generateHeightmapCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = '#000000'; // baseline 0 height
  ctx.fillRect(0, 0, width, height);
  
  return canvas;
}

export function createTerrainMesh(width: number, depth: number, segmentsW: number, segmentsD: number, color1: [number, number, number], color2: [number, number, number]): { mesh: Gfx3Mesh, vertices: Array<number>, indexes: Array<number> } {
  const mesh = new Gfx3Mesh();
  mesh.setTag(0, 0, Gfx3MeshEffect.PIXELATION); 
  
  const hw = width / 2;
  const hd = depth / 2;
  const segW = width / segmentsW;
  const segD = depth / segmentsD;
  
  const verticesFlat = new Array<number>();
  const colorsFlat = new Array<number>();
  const normalsFlat = new Array<number>();
  
  // Create solid discrete triangles for a checkerboard effect instead of smooth connected vertices
  for (let z = 0; z < segmentsD; z++) {
    for (let x = 0; x < segmentsW; x++) {
      const px = -hw + x * segW;
      const pz = -hd + z * segD;
      const px_next = px + segW;
      const pz_next = pz + segD;
      
      const py = 0; // Flat
      
      // Determine checkerboard color
      const isAlt = (x % 2 === 0) !== (z % 2 === 0);
      const cellColor = isAlt ? color2 : color1;

      // Triangle 1
      verticesFlat.push(px, py, pz);
      verticesFlat.push(px_next, py, pz_next);
      verticesFlat.push(px_next, py, pz);
      // Triangle 2
      verticesFlat.push(px, py, pz);
      verticesFlat.push(px, py, pz_next);
      verticesFlat.push(px_next, py, pz_next);

      for (let i = 0; i < 6; i++) {
        colorsFlat.push(cellColor[0], cellColor[1], cellColor[2]);
        normalsFlat.push(0, 1, 0); // Straight up
      }
    }
  }

  // We don't need actual indexes if we unroll everything
  const indexesFlat = new Array<number>();
  for (let i = 0; i < verticesFlat.length / 3; i++) {
    indexesFlat.push(i);
  }

  const faceGroups = [{ name: 'default', faces: [] as any[], vertexCount: verticesFlat.length }];
  for (let i = 0; i < indexesFlat.length; i+=3) {
      faceGroups[0].faces.push({
          v: [indexesFlat[i], indexesFlat[i+1], indexesFlat[i+2]],
          t: [indexesFlat[i], indexesFlat[i+1], indexesFlat[i+2]],
          n: [indexesFlat[i], indexesFlat[i+1], indexesFlat[i+2]],
          smoothGroup: 0
      });
  }

  mesh.geo = Gfx3Mesh.buildVertices(verticesFlat.length / 3, verticesFlat, [], colorsFlat, normalsFlat, faceGroups);
  mesh.beginVertices(mesh.geo.vertices.length / 17); // 17 floats per vertex
  mesh.setVertices(mesh.geo.vertices);
  mesh.endVertices();

  return { mesh, vertices: verticesFlat, indexes: indexesFlat };
}
