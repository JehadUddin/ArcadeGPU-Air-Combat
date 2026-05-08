import * as THREE from 'three';

export const getExplosionMaterial = (color1Hex = 0xffaa00, color2Hex = 0xff0000) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color1: { value: new THREE.Color(color1Hex) },
      color2: { value: new THREE.Color(color2Hex) },
      opacity: { value: 1.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vNoise;
      uniform float time;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute( permute( permute(
                   i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                 + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      void main() {
        vUv = uv;
        float noise = snoise(position * 2.0 + time * 5.0);
        vNoise = noise;
        vec3 newPosition = position + normal * noise * 0.8;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vNoise;
      uniform vec3 color1;
      uniform vec3 color2;
      uniform float opacity;

      void main() {
        float intensity = (vNoise + 1.0) * 0.5;
        vec3 finalColor = mix(color2, color1, intensity);
        gl_FragColor = vec4(finalColor, opacity * (1.0 - intensity * 0.3));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
};

export const getFireMaterial = (
  colorRedHex = 0xe61919, 
  colorOrangeHex = 0xff8000, 
  colorYellowHex = 0xffe619
) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      globalAlpha: { value: 1.0 },
      colorRed: { value: new THREE.Color(colorRedHex) },
      colorOrange: { value: new THREE.Color(colorOrangeHex) },
      colorYellow: { value: new THREE.Color(colorYellowHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;
      uniform float globalAlpha;
      uniform vec3 colorRed;
      uniform vec3 colorOrange;
      uniform vec3 colorYellow;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

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
          for(int i=0; i<4; i++) {
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
          }
          return v;
      }

      void main() {
          vec2 uv = vUv;
          
          float t = time * 0.8;

          vec2 noiseUV1 = uv * 3.0 + vec2(0.0, -t * 0.8);
          vec2 noiseUV2 = uv * 4.0 + vec2(0.0, -t * 1.5);

          float distortionStrength = 0.15;
          vec2 distortion = vec2(fbm(noiseUV1)) - 0.5;
          
          vec2 distortedUV = noiseUV2 + (distortion * distortionStrength * 5.0);

          float fireNoise = fbm(distortedUV);

          float taperX = abs(uv.x - 0.5) * 1.5; 
          float gradientMask = (1.0 - uv.y * 1.2) - taperX;
          
          float fireValue = fireNoise * gradientMask;

          float feather = 0.02;
          
          float t1 = 0.1;
          float t2 = 0.25;
          float t3 = 0.35;
          float t4 = 0.45;

          float mask1 = smoothstep(t1 - feather, t1 + feather, fireValue);
          float mask2 = smoothstep(t2 - feather, t2 + feather, fireValue);
          float mask3 = smoothstep(t3 - feather, t3 + feather, fireValue);
          float mask4 = smoothstep(t4 - feather, t4 + feather, fireValue);

          vec3 colorBg = vec3(0.0);
          vec3 colorWhite = vec3(1.0, 1.0, 1.0);

          vec3 finalColor = mix(colorBg, colorRed, mask1);
          finalColor = mix(finalColor, colorOrange, mask2);
          finalColor = mix(finalColor, colorYellow, mask3);
          finalColor = mix(finalColor, colorWhite, mask4);

          float alpha = mask1 * globalAlpha;

          gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
};

export const getProjectileMaterial = (coreColorHex = 0xffffff, glowColorHex = 0x00aaff) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      coreColor: { value: new THREE.Color(coreColorHex) },
      glowColor: { value: new THREE.Color(glowColorHex) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 coreColor;
      uniform vec3 glowColor;
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float rim = 1.0 - max(dot(viewDir, normal), 0.0);
        rim = smoothstep(0.0, 1.0, rim);
        float pulse = sin(time * 20.0) * 0.5 + 0.5;
        vec3 finalColor = mix(coreColor, glowColor, rim + pulse * 0.8);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending
  });
};
