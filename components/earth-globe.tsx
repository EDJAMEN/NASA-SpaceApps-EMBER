"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, useTexture } from "@react-three/drei";
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
  uniform sampler2D uDay;     // NASA Blue Marble surface
  uniform sampler2D uNight;   // NASA Black Marble city lights
  uniform sampler2D uClouds;  // cloud cover
  uniform sampler2D uSpec;    // ocean mask (water = bright)
  uniform float uTime;
  uniform float uStage1Weight;
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;

  void main() {
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(cameraPosition - vPositionWorld);
    vec3 sunDir = normalize(vec3(-1.15, 0.42, 0.72));
    float ndl = dot(N, sunDir);
    float dayFactor = smoothstep(-0.10, 0.22, ndl);
    float twilight = smoothstep(-0.22, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.28, ndl));

    // Day side: real surface, gently contrast-lifted, lit by the sun.
    vec3 surface = pow(texture2D(uDay, vUv).rgb, vec3(1.12)) * 1.22;
    vec3 day = surface * (0.05 + 1.08 * max(ndl, 0.0));

    // Clouds drift slowly east and cast a faint shadow on the ground below them.
    vec2 cloudUv = vUv + vec2(uTime * 0.0008, 0.0);
    float cloud = texture2D(uClouds, cloudUv).a; // this map stores cloud density in alpha (RGB is plain white)
    float cloudShadow = texture2D(uClouds, cloudUv + vec2(0.0025, 0.0012)).a;
    day *= 1.0 - cloudShadow * 0.32 * dayFactor;
    vec3 cloudColor = vec3(1.0, 0.99, 0.97) * cloud * (0.03 + 0.97 * max(ndl, 0.0));

    // Night side: warm sodium-vapour city lights, dimmed under cloud.
    vec3 lights = texture2D(uNight, vUv).rgb;
    vec3 night = lights * vec3(1.0, 0.70, 0.38) * 1.8 * (1.0 - dayFactor) * (1.0 - cloud * 0.75);

    // Sun glint on open ocean only.
    float ocean = texture2D(uSpec, vUv).r;
    vec3 H = normalize(sunDir + V);
    float glint = pow(max(dot(N, H), 0.0), 80.0) * ocean * (1.0 - cloud) * dayFactor;
    vec3 specular = vec3(1.0, 0.93, 0.80) * glint * 0.85;

    // Atmosphere: blue Rayleigh haze toward the limb, amber along the day/night line.
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    vec3 haze = mix(vec3(0.30, 0.58, 1.0), vec3(1.0, 0.52, 0.22), twilight * 0.7);
    float hazeStrength = mix(0.55, 0.95, uStage1Weight) * (0.15 + 0.85 * smoothstep(-0.35, 0.35, ndl));

    vec3 color = day + cloudColor + night + specular
      + vec3(1.0, 0.42, 0.14) * twilight * 0.10
      + haze * fresnel * hazeStrength;
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Outer atmosphere shell (rendered from inside, additive): the soft blue glow beyond the planet's edge.
const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  void main() {
    vNormalView = normalize(normalMatrix * normal);
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  void main() {
    float rim = pow(clamp(0.78 + dot(vNormalView, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.5);
    float sunlit = 0.35 + 0.65 * smoothstep(-0.4, 0.5, dot(vNormalWorld, normalize(vec3(-1.15, 0.42, 0.72))));
    gl_FragColor = vec4(vec3(0.32, 0.62, 1.0) * rim * sunlit * 1.35, 1.0);
  }
`;

/** Lat/lng (degrees) → point on a three.js SphereGeometry, matching how its UVs wrap an equirectangular map. */
function latLngToVector(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(lng + 180);
  const la = THREE.MathUtils.degToRad(lat);
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(la) * radius, Math.sin(la) * radius, Math.sin(phi) * Math.cos(la) * radius);
}

function createOrbitLoopGeometry(radius: number, segments = 200): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function createHotspotPointsGeometry(radius: number): THREE.BufferGeometry {
  // Real fire belts (lat, lng, points): concentrated on SE Asia / Mindanao, plus the big global burn regions.
  const clusterSeeds: Array<[number, number, number]> = [
    [8.0, 125.1, 22], // Bukidnon / Mindanao
    [16.0, 121.0, 14], // Luzon
    [-1.0, 114.0, 16], // Borneo / Kalimantan
    [-1.5, 103.0, 14], // Sumatra
    [18.0, 100.0, 14], // Mainland SE Asia
    [-15.0, 132.0, 14], // Northern Australia
    [-6.0, 22.0, 14], // Central Africa
    [-9.0, -60.0, 14], // Amazon basin
    [37.0, -120.0, 8], // California
  ];

  const positions: number[] = [];
  let seed = 42;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (const [lat, lng, count] of clusterSeeds) {
    for (let i = 0; i < count; i++) {
      const v = latLngToVector(lat + (nextRand() - 0.5) * 7, lng + (nextRand() - 0.5) * 9, radius * (1.003 + nextRand() * 0.003));
      positions.push(v.x, v.y, v.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** A small Earth-observation satellite (Terra/Aqua/NOAA-20 style): foil body, two solar wings, nadir antenna. */
function OrbitalMarkerNode({
  satelliteRef,
  accentColor,
}: {
  satelliteRef: React.RefObject<THREE.Group | null>;
  accentColor: string;
}) {
  const blinkRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (blinkRef.current) blinkRef.current.opacity = clock.getElapsedTime() % 1.6 < 0.12 ? 1 : 0.15;
  });
  return (
    // lookAt(earth) points +z at the planet: the antenna dish faces down, the wings span the x axis.
    <group ref={satelliteRef} scale={0.62}>
      {/* Bus wrapped in gold multi-layer insulation */}
      <mesh>
        <boxGeometry args={[0.05, 0.042, 0.064]} />
        <meshStandardMaterial color="#c99a2e" metalness={0.85} roughness={0.32} emissive="#3a2600" emissiveIntensity={0.25} />
      </mesh>
      {/* Instrument deck */}
      <mesh position={[0, 0, 0.036]}>
        <boxGeometry args={[0.034, 0.03, 0.008]} />
        <meshStandardMaterial color="#d7dbe0" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Nadir antenna dish */}
      <mesh position={[0, 0.002, 0.046]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.014, 0.01, 20, 1, true]} />
        <meshStandardMaterial color="#f1f3f5" metalness={0.3} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Solar wings: boom + panel with cell grid sheen */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.025, 0, 0]}>
          <mesh position={[side * 0.016, 0, 0]}>
            <boxGeometry args={[0.032, 0.003, 0.003]} />
            <meshStandardMaterial color="#9aa3ad" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[side * 0.085, 0, 0]}>
            <boxGeometry args={[0.11, 0.0025, 0.046]} />
            <meshStandardMaterial color="#173a7a" metalness={0.55} roughness={0.22} emissive="#0b1f4a" emissiveIntensity={0.35} />
          </mesh>
          {[-0.03, 0, 0.03].map((x) => (
            <mesh key={x} position={[side * 0.085 + x, 0.0016, 0]}>
              <boxGeometry args={[0.0012, 0.0004, 0.046]} />
              <meshBasicMaterial color="#5f86c9" />
            </mesh>
          ))}
        </group>
      ))}
      {/* Navigation light in the mission colour */}
      <mesh position={[0, 0.024, 0]}>
        <sphereGeometry args={[0.005, 10, 10]} />
        <meshBasicMaterial ref={blinkRef} color={accentColor} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function EarthScene() {
  const [dayMap, nightMap, cloudMap, specMap] = useTexture([
    "/textures/earth/earth_atmos_2048.jpg",
    "/textures/earth/earth_lights_2048.png",
    "/textures/earth/earth_clouds_1024.png",
    "/textures/earth/earth_specular_2048.jpg",
  ]);
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
          uDay: { value: dayMap },
          uNight: { value: nightMap },
          uClouds: { value: cloudMap },
          uSpec: { value: specMap },
          uTime: { value: 0 },
          uStage1Weight: { value: 1 },
        },
      }),
    [dayMap, nightMap, cloudMap, specMap]
  );
  useEffect(() => {
    for (const t of [dayMap, nightMap, cloudMap, specMap]) {
      t.anisotropy = 8; // crisp coastlines at grazing angles near the limb
      t.needsUpdate = true;
    }
    cloudMap.wrapS = THREE.RepeatWrapping; // drifting clouds wrap round the globe instead of smearing at the seam
  }, [dayMap, nightMap, cloudMap, specMap]);

  const atmosphereGeom = useMemo(() => new THREE.SphereGeometry(1.68 * 1.075, 96, 96), []);
  const atmosphereMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ATMOSPHERE_VERTEX_SHADER,
        fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
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
      atmosphereGeom.dispose();
      atmosphereMat.dispose();
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
    atmosphereGeom,
    atmosphereMat,
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
      // Turns lng 125°E (Mindanao) to face the camera: see latLngToVector's mapping.
      const lockedSeAsiaRotationY = THREE.MathUtils.degToRad(145);
      earthRef.current.rotation.y = THREE.MathUtils.lerp(
        freeRotationY,
        lockedSeAsiaRotationY,
        t23
      );
      earthRef.current.rotation.x = THREE.MathUtils.lerp(
        0.22 - t12 * 0.08,
        THREE.MathUtils.degToRad(8), // tilt Mindanao (8°N) to the centre
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
        <mesh geometry={atmosphereGeom} material={atmosphereMat} />

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
        {/* Textures stream in; until then only the starfield backdrop shows. */}
        <Suspense fallback={null}>
          <EarthScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
