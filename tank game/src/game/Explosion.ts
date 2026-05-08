import * as THREE from 'three';

const fireballVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const noiseFunctions = `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }
`;

const fireballFragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float time;
  uniform float progress;

  ${noiseFunctions}

  void main() {
    // 3D to 2D mapping for noise
    vec2 p = vPosition.xy + vPosition.z;
    float n = fbm(p * 3.0 + time * 2.0);
    
    // Fire color gradient
    vec3 colorWhite = vec3(1.0, 0.9, 0.8);
    vec3 colorYellow = vec3(1.0, 0.8, 0.1);
    vec3 colorOrange = vec3(1.0, 0.4, 0.0);
    vec3 colorRed = vec3(0.8, 0.1, 0.0);
    vec3 colorBlack = vec3(0.05, 0.05, 0.05);
    
    vec3 color = mix(colorBlack, colorRed, smoothstep(0.0, 0.3, n));
    color = mix(color, colorOrange, smoothstep(0.3, 0.5, n));
    color = mix(color, colorYellow, smoothstep(0.5, 0.8, n));
    color = mix(color, colorWhite, smoothstep(0.8, 1.0, n));
    
    // Fade out based on progress
    float fireMask = smoothstep(progress - 0.2, progress + 0.2, n);
    float alpha = fireMask * (1.0 - progress);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

const smokeFragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float time;
  uniform float progress;

  ${noiseFunctions}

  void main() {
    vec2 p = vPosition.xy + vPosition.z;
    float n = fbm(p * 2.0 + time * 0.5);
    float alpha = smoothstep(0.3, 0.8, n) * (1.0 - progress);
    vec3 color = vec3(0.1, 0.1, 0.1);
    gl_FragColor = vec4(color, alpha);
  }
`;

const shockwaveFragmentShader = `
  varying vec2 vUv;
  uniform float progress;
  void main() {
    float dist = distance(vUv, vec2(0.5));
    float wave = smoothstep(0.5, 0.4, dist) * smoothstep(0.3, 0.4, dist);
    float alpha = wave * (1.0 - progress);
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.5);
  }
`;

export class AAAExplosion {
  group: THREE.Group;
  scene: THREE.Scene;
  life: number = 0;
  maxLife: number = 3.0;
  
  fireball: THREE.Mesh;
  smoke: THREE.Mesh;
  shockwave: THREE.Mesh;
  light: THREE.PointLight;
  sparks: THREE.Points;
  
  sparkVelocities: THREE.Vector3[] = [];
  
  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.userData.isExplosion = true;
    this.group.position.copy(position);
    this.scene.add(this.group);
    
    // 1. Light Flash
    this.light = new THREE.PointLight(0xffaa00, 50, 20);
    this.group.add(this.light);
    
    // 2. Fireball
    const fireGeo = new THREE.IcosahedronGeometry(1.5, 4);
    const fireMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, progress: { value: 0 } },
      vertexShader: fireballVertexShader,
      fragmentShader: fireballFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.fireball = new THREE.Mesh(fireGeo, fireMat);
    this.fireball.userData.isExplosion = true;
    this.fireball.visible = false;
    this.group.add(this.fireball);
    
    // 3. Smoke
    const smokeGeo = new THREE.IcosahedronGeometry(2.0, 4);
    const smokeMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, progress: { value: 0 } },
      vertexShader: fireballVertexShader,
      fragmentShader: smokeFragmentShader,
      transparent: true,
      depthWrite: false
    });
    this.smoke = new THREE.Mesh(smokeGeo, smokeMat);
    this.smoke.userData.isExplosion = true;
    this.smoke.visible = false;
    this.group.add(this.smoke);
    
    // 4. Shockwave
    const shockGeo = new THREE.PlaneGeometry(5, 5);
    const shockMat = new THREE.ShaderMaterial({
      uniforms: { progress: { value: 0 } },
      vertexShader: fireballVertexShader,
      fragmentShader: shockwaveFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.shockwave = new THREE.Mesh(shockGeo, shockMat);
    this.shockwave.userData.isExplosion = true;
    this.shockwave.rotation.x = -Math.PI / 2;
    this.shockwave.visible = false;
    this.group.add(this.shockwave);
    
    // 5. Sparks
    const sparkCount = 50;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i*3] = 0;
      sparkPositions[i*3+1] = 0;
      sparkPositions[i*3+2] = 0;
      
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        Math.random() * 20,
        (Math.random() - 0.5) * 20
      );
      this.sparkVelocities.push(vel);
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.2,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.sparks = new THREE.Points(sparkGeo, sparkMat);
    this.sparks.userData.isExplosion = true;
    this.sparks.visible = false;
    this.group.add(this.sparks);
  }
  
  update(delta: number) {
    this.life += delta;
    const t = this.life;
    
    // Light
    this.light.intensity = 50 * Math.exp(-t * 10.0);
    
    // Fireball
    if (t >= 0.05 && t < 1.0) {
      this.fireball.visible = true;
      const fireProgress = (t - 0.05) / 0.95;
      const mat = this.fireball.material as THREE.ShaderMaterial;
      mat.uniforms.time.value += delta;
      mat.uniforms.progress.value = fireProgress;
      this.fireball.scale.setScalar(1.0 + fireProgress * 0.5);
    } else {
      this.fireball.visible = false;
    }
    
    // Shockwave
    if (t >= 0.10 && t < 0.5) {
      this.shockwave.visible = true;
      const shockProgress = (t - 0.10) / 0.4;
      const mat = this.shockwave.material as THREE.ShaderMaterial;
      mat.uniforms.progress.value = shockProgress;
      this.shockwave.scale.setScalar(1.0 + shockProgress * 5.0);
    } else {
      this.shockwave.visible = false;
    }
    
    // Sparks
    if (t >= 0.20 && t < 1.5) {
      this.sparks.visible = true;
      const positions = this.sparks.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < this.sparkVelocities.length; i++) {
        const vel = this.sparkVelocities[i];
        vel.y -= 9.8 * delta; // Gravity
        
        positions[i*3] += vel.x * delta;
        positions[i*3+1] += vel.y * delta;
        positions[i*3+2] += vel.z * delta;
      }
      this.sparks.geometry.attributes.position.needsUpdate = true;
      const mat = this.sparks.material as THREE.PointsMaterial;
      mat.opacity = 1.0 - ((t - 0.20) / 1.3);
    } else {
      this.sparks.visible = false;
    }
    
    // Smoke
    if (t >= 0.30 && t < 3.0) {
      this.smoke.visible = true;
      const smokeProgress = (t - 0.30) / 2.7;
      const mat = this.smoke.material as THREE.ShaderMaterial;
      mat.uniforms.time.value += delta;
      mat.uniforms.progress.value = smokeProgress;
      this.smoke.scale.setScalar(1.0 + smokeProgress * 1.0);
      this.smoke.position.y += delta * 0.5; // Smoke rises slowly
    } else {
      this.smoke.visible = false;
    }
  }
  
  isDead() {
    return this.life >= this.maxLife;
  }
  
  dispose() {
    this.scene.remove(this.group);
    (this.fireball.material as THREE.Material).dispose();
    this.fireball.geometry.dispose();
    (this.smoke.material as THREE.Material).dispose();
    this.smoke.geometry.dispose();
    (this.shockwave.material as THREE.Material).dispose();
    this.shockwave.geometry.dispose();
    (this.sparks.material as THREE.Material).dispose();
    this.sparks.geometry.dispose();
  }
}
