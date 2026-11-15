"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

const EARTH_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vObjectPos;

  void main() {
    vUv = uv;
    vObjectPos = normalize(position);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPositionWorld = worldPosition.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uStage1Weight;
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vObjectPos;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.05 + vec3(13.7, 29.3, 7.1);
      a *= 0.5;
    }
    return v;
  }

  float fbmFast(vec3 p) {
    return 0.55 * noise(p) + 0.30 * noise(p * 2.07 + vec3(5.2, 11.4, 3.8)) + 0.15 * noise(p * 4.15);
  }

  void main() {
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(cameraPosition - vPositionWorld);
    vec3 sunDir = normalize(vec3(-1.15, 0.42, 0.72));

    // Procedural continents & bathymetry
    float n = fbm(vObjectPos * 3.1 + vec3(1.4, -0.6, 2.1));
    float detail = noise(vObjectPos * 12.0);
    float elevation = n + detail * 0.14;
    float landMask = smoothstep(0.49, 0.53, elevation);
    float coastEdge = smoothstep(0.475, 0.505, elevation) - smoothstep(0.505, 0.54, elevation);

    // Subtle drifting cloud deck
    float cloudNoise = fbmFast(vObjectPos * 5.2 + vec3(uTime * 0.012, -uTime * 0.006, 1.2));
    float clouds = smoothstep(0.54, 0.72, cloudNoise) * 0.26;

    // Day / night terminator (lit western face, shadowed night hemisphere)
    float ndl = dot(N, sunDir);
    float dayFactor = smoothstep(-0.18, 0.26, ndl);
    float twilightFactor = smoothstep(-0.28, 0.06, ndl) * (1.0 - smoothstep(0.06, 0.34, ndl));

    // Day colors
    vec3 deepOcean = vec3(0.022, 0.068, 0.155);
    vec3 shallowOcean = vec3(0.045, 0.148, 0.285);
    vec3 oceanDay = mix(deepOcean, shallowOcean, smoothstep(0.32, 0.50, elevation));
    vec3 landLow = vec3(0.072, 0.132, 0.108);
    vec3 landHigh = vec3(0.165, 0.152, 0.13);
    vec3 landDay = mix(landLow, landHigh, smoothstep(0.52, 0.78, elevation));
    vec3 daySurface = mix(oceanDay, landDay, landMask) * (0.28 + 0.72 * max(ndl, 0.0));

    // Night colors
    vec3 oceanNight = vec3(0.007, 0.013, 0.026);
    vec3 landNight = vec3(0.021, 0.031, 0.052) + coastEdge * vec3(0.035, 0.058, 0.09);
    vec3 nightSurface = mix(oceanNight, landNight, landMask);

    // Ocean specular glint
    vec3 H = normalize(sunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 58.0) * (1.0 - landMask) * smoothstep(-0.05, 0.3, ndl);
    vec3 specularColor = vec3(0.38, 0.65, 0.98) * spec * 0.48;

    // Glowing orange thermal hotspot clusters on the night/twilight hemisphere
    float clusterField = fbmFast(vObjectPos * 9.5 + vec3(4.2, -1.7, 3.3));
    float fineSparks = noise(vObjectPos * 28.0 - vec3(0.0, uTime * 0.04, 0.0));
    float pulse = 0.85 + 0.15 * sin(uTime * 2.2 + vObjectPos.x * 15.0 + vObjectPos.y * 11.0);
    float nightWeight = smoothstep(0.24, -0.22, ndl);
    float hotspotCore = smoothstep(0.59, 0.74, clusterField) * smoothstep(0.53, 0.71, fineSparks);
    float hotspotHalo = smoothstep(0.53, 0.69, clusterField) * 0.34;
    float hotspotIntensity = (hotspotCore * 2.25 + hotspotHalo) * landMask * (0.35 + 0.65 * nightWeight) * pulse;
    vec3 hotspotGlow = mix(vec3(0.976, 0.451, 0.086), vec3(1.0, 0.85, 0.46), hotspotCore) * hotspotIntensity;

    // Vivid Rayleigh blue atmospheric limb glow on the surface curvature (stronger in Stage 1 Macro Horizon)
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.4);
    vec3 rayleighBlue = vec3(0.18, 0.54, 1.0);
    vec3 terminatorAmber = vec3(0.976, 0.451, 0.086);
    vec3 limbTint = mix(rayleighBlue, terminatorAmber, twilightFactor * 0.45);
    float limbStrength = mix(0.32, 0.68, uStage1Weight);

    vec3 cloudLayer = vec3(0.75, 0.86, 1.0) * clouds * (0.25 + 0.75 * dayFactor);
    vec3 finalColor = mix(nightSurface, daySurface, dayFactor) + cloudLayer + specularColor + hotspotGlow + limbTint * fresnel * limbStrength;
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function createOrbitLoopGeometry(radius: number, segments = 200): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function createHotspotPointsGeometry(radius: number): THREE.BufferGeometry {
  // Concentrated in SE Asia / Philippines / Mindanao / Kalimantan + global fire belts
  const clusterSeeds: Array<[number, number, number]> = [
    [0.14, 2.18, 22], // Bukidnon / Mindanao / Philippines
    [0.24, 2.11, 14], // Luzon / Mindoro
    [-0.03, 2.02, 16], // Borneo / Kalimantan
    [-0.11, 1.85, 14], // Sumatra / Java
    [0.29, 1.76, 12], // Mainland SE Asia
    [-0.32, 2.32, 14], // Northern Australia
    [-0.18, 0.42, 12], // Central Africa
    [-0.24, -0.95, 12], // Amazon Basin
  ];

  const positions: number[] = [];
  let seed = 42;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (const [baseLat, baseLon, count] of clusterSeeds) {
    for (let i = 0; i < count; i++) {
      const lat = baseLat + (nextRand() - 0.5) * 0.18;
      const lon = baseLon + (nextRand() - 0.5) * 0.22;
      const r = radius * (1.003 + nextRand() * 0.004);
      const x = r * Math.cos(lat) * Math.cos(lon);
      const y = r * Math.sin(lat);
      const z = r * Math.cos(lat) * Math.sin(lon);
      positions.push(x, y, z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function OrbitalMarkerNode({
  satelliteRef,
  accentColor,
}: {
  satelliteRef: React.RefObject<THREE.Group | null>;
  accentColor: string;
}) {
  return (
    <group ref={satelliteRef}>
      {/* Sleek pinpoint orbital telemetry node + soft atmospheric halo */}
      <mesh>
        <sphereGeometry args={[0.015, 16, 16]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.036, 16, 16]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function EarthScene() {
  const groupRef = useRef<THREE.Group>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  const modisSatRef = useRef<THREE.Group>(null);
  const viirsSatRef = useRef<THREE.Group>(null);

  const smoothScrollRef = useRef(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mediaQuery.matches;
    const handleChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const earthGeom = useMemo(() => new THREE.SphereGeometry(1.68, 128, 128), []);
  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EARTH_VERTEX_SHADER,
        fragmentShader: EARTH_FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uStage1Weight: { value: 1 },
        },
      }),
    []
  );

  const hotspotPointsGeom = useMemo(() => createHotspotPointsGeometry(1.68), []);
  const hotspotPointsMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color("#f97316"),
        size: 0.032,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const modisOrbitRadius = 1.96;
  const viirsOrbitRadius = 2.08;

  const modisOrbitLine = useMemo(() => {
    const geom = createOrbitLoopGeometry(modisOrbitRadius);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#f97316"),
      transparent: true,
      opacity: 0.25,
    });
    return new THREE.LineLoop(geom, mat);
  }, [modisOrbitRadius]);

  const viirsOrbitLine = useMemo(() => {
    const geom = createOrbitLoopGeometry(viirsOrbitRadius);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#38bdf8"),
      transparent: true,
      opacity: 0.22,
    });
    return new THREE.LineLoop(geom, mat);
  }, [viirsOrbitRadius]);

  useEffect(() => {
    return () => {
      earthGeom.dispose();
      earthMat.dispose();
      hotspotPointsGeom.dispose();
      hotspotPointsMat.dispose();
      modisOrbitLine.geometry.dispose();
      (modisOrbitLine.material as THREE.Material).dispose();
      viirsOrbitLine.geometry.dispose();
      (viirsOrbitLine.material as THREE.Material).dispose();
    };
  }, [
    earthGeom,
    earthMat,
    hotspotPointsGeom,
    hotspotPointsMat,
    modisOrbitLine,
    viirsOrbitLine,
  ]);

  useFrame((state, delta) => {
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const rawProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));

    const dt = Math.min(0.25, delta);
    if (reducedMotionRef.current || Math.abs(rawProgress - smoothScrollRef.current) > 0.35) {
      smoothScrollRef.current = rawProgress;
    } else {
      smoothScrollRef.current = THREE.MathUtils.damp(
        smoothScrollRef.current,
        rawProgress,
        7.5,
        dt
      );
    }
    const s = smoothScrollRef.current;

    const elapsed = state.clock.getElapsedTime();
    const idleSpin = reducedMotionRef.current ? 0.4 : elapsed * 0.06;
    earthMat.uniforms.uTime.value = reducedMotionRef.current ? 0 : elapsed;

    // Blend weights across the 3 camera stages:
    // Stage 1 (0.00 -> 0.30): Macro Horizon View (close curved horizon filling bottom-right & lower half)
    // Stage 2 (0.30 -> 0.65): Full Isolated Globe Zoom-Out at [x: 1.35, y: 0.0, z: 0]
    // Stage 3 (0.65 -> 1.00): Regional Target Zoom-In onto SE Asia / Mindanao corridor -> crossfade
    const t12 = smoothstep(0.08, 0.34, s); // 0 in Stage 1 -> 1 in Stage 2
    const t23 = smoothstep(0.62, 0.92, s); // 0 in Stage 2 -> 1 in Stage 3

    earthMat.uniforms.uStage1Weight.value = 1.0 - t12;

    const isCompact = window.innerWidth < 1024;

    // Globe center position & scale choreography (driven by damped scroll `s`)
    // Stage 1 (0.00 -> 0.30): Immense curved planetary horizon filling bottom-right & lower half
    // Stage 2 (0.30 -> 0.65): Full isolated sphere floating cleanly on right at [x: 1.45, y: 0.0, z: 0]
    // Stage 3 (0.65 -> 1.00): Plunging zoom onto SE Asia / Philippines / Mindanao corridor
    const stage1X = isCompact ? 0.2 : 0.92;
    const stage1Y = isCompact ? -1.15 : -1.12;
    const stage2X = isCompact ? 0.0 : 1.45;
    const stage2Y = 0.02;
    const stage3X = 0.18;
    const stage3Y = -0.05;

    const pos12X = THREE.MathUtils.lerp(stage1X, stage2X, t12);
    const pos12Y = THREE.MathUtils.lerp(stage1Y, stage2Y, t12);
    const targetGlobeX = THREE.MathUtils.lerp(pos12X, stage3X, t23);
    const targetGlobeY = THREE.MathUtils.lerp(pos12Y, stage3Y, t23);

    const scale12 = THREE.MathUtils.lerp(1.48, 0.86, t12);
    const targetScale = THREE.MathUtils.lerp(scale12, 1.9, t23);

    if (groupRef.current) {
      groupRef.current.position.set(targetGlobeX, targetGlobeY, 0);
      groupRef.current.scale.setScalar(targetScale);
    }

    // Camera zoom & position choreography
    const cam12Z = THREE.MathUtils.lerp(3.85, 5.35, t12);
    const targetCamZ = THREE.MathUtils.lerp(cam12Z, 2.25, t23);
    const targetCamX = THREE.MathUtils.lerp(-0.14, 0.0, t12);
    const targetCamY = THREE.MathUtils.lerp(0.08, 0.0, t12);

    state.camera.position.set(targetCamX, targetCamY, targetCamZ);

    // Axial rotation: slow spin in Stage 1 & 2, locking onto SE Asia / Mindanao in Stage 3
    if (earthRef.current) {
      const freeRotationY = idleSpin + s * Math.PI * 1.25;
      const lockedSeAsiaRotationY = -0.62;
      earthRef.current.rotation.y = THREE.MathUtils.lerp(
        freeRotationY,
        lockedSeAsiaRotationY,
        t23
      );
      earthRef.current.rotation.x = THREE.MathUtils.lerp(
        0.22 - t12 * 0.08,
        0.14,
        t23
      );
    }

    // Orbiting MODIS & VIIRS procedural satellites
    const modisAngle =
      (reducedMotionRef.current ? 0.85 : elapsed * 0.26) + s * Math.PI * 2.8;
    const viirsAngle =
      (reducedMotionRef.current ? 2.35 : -elapsed * 0.32 + 2.1) -
      s * Math.PI * 3.1;

    if (modisSatRef.current) {
      modisSatRef.current.position.set(
        Math.cos(modisAngle) * modisOrbitRadius,
        Math.sin(modisAngle) * modisOrbitRadius,
        0
      );
      modisSatRef.current.lookAt(0, 0, 0);
    }

    if (viirsSatRef.current) {
      viirsSatRef.current.position.set(
        Math.cos(viirsAngle) * viirsOrbitRadius,
        Math.sin(viirsAngle) * viirsOrbitRadius,
        0
      );
      viirsSatRef.current.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[-5, 3, 5]} intensity={1.85} color="#fff7ed" />
      <directionalLight position={[4, -2, 3]} intensity={0.65} color="#38bdf8" />

      <Stars
        radius={80}
        depth={45}
        count={1500}
        factor={2.4}
        saturation={0}
        fade
        speed={0.22}
      />

      <group ref={groupRef} position={[1.05, -1.55, 0]} scale={1.42}>
        <mesh ref={earthRef} geometry={earthGeom} material={earthMat}>
          <points geometry={hotspotPointsGeom} material={hotspotPointsMat} />
        </mesh>

        <group rotation={[1.28, 0.42, 0.24]}>
          <primitive object={modisOrbitLine} />
          <OrbitalMarkerNode
            satelliteRef={modisSatRef}
            accentColor="#fb923c"
          />
        </group>

        <group rotation={[1.38, -0.52, -0.22]}>
          <primitive object={viirsOrbitLine} />
          <OrbitalMarkerNode
            satelliteRef={viirsSatRef}
            accentColor="#38bdf8"
          />
        </group>
      </group>
    </>
  );
}

export function EarthGlobeCanvas({
  canvasOpacity = 1,
  stage2EditorialTone = 0,
}: {
  canvasOpacity?: number;
  stage2EditorialTone?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none transition-colors duration-300"
      style={{
        opacity: canvasOpacity,
        visibility: canvasOpacity <= 0.01 ? "hidden" : "visible",
        backgroundColor:
          stage2EditorialTone > 0.15
            ? `color-mix(in srgb, #141619 ${Math.round(stage2EditorialTone * 100)}%, #05070a)`
            : "#05070a",
      }}
      aria-hidden="true"
    >
      {/* Editorial matte slate/charcoal radial backdrop for Stage 2 */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: stage2EditorialTone,
          background:
            "radial-gradient(circle at 68% 50%, #1c1e22 0%, #141619 58%, #0c0e12 100%)",
        }}
      />

      {/* Stage 1 blue Rayleigh atmospheric horizon glow */}
      <div
        className="absolute inset-0"
        style={{
          opacity: Math.max(0, 1 - stage2EditorialTone * 0.7),
          background:
            "radial-gradient(circle at 66% 78%, rgba(37, 99, 235, 0.16) 0%, rgba(249, 115, 22, 0.04) 38%, rgba(5, 7, 10, 0.85) 76%)",
        }}
      />

      {/* Subtle architectural grid lines */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.45) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <Canvas
        camera={{ position: [-0.15, 0.12, 2.95], fov: 35 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <EarthScene />
      </Canvas>
    </div>
  );
}
