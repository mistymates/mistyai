import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAssistant, type AssistantStatus } from "@/lib/assistant-store";

type DottedSurfaceProps = {
  className?: string;
};

type ParticleConfig = {
  wave: number;
  audio: number;
  focus: number;
  brightness: number;
  ripple: number;
  speed: number;
};

const CONFIGS: Record<AssistantStatus, ParticleConfig> = {
  idle: { wave: 0.07, audio: 0.1, focus: 0.01, brightness: 0.18, ripple: 0.03, speed: 0.1 },
  listening: { wave: 0.1, audio: 0.35, focus: 0.1, brightness: 0.3, ripple: 0.06, speed: 0.16 },
  thinking: { wave: 0.11, audio: 0.16, focus: 0.04, brightness: 0.28, ripple: 0.2, speed: 0.2 },
  speaking: { wave: 0.1, audio: 0.28, focus: 0.04, brightness: 0.34, ripple: 0.24, speed: 0.18 },
  connecting: { wave: 0.08, audio: 0.12, focus: 0.04, brightness: 0.24, ripple: 0.12, speed: 0.16 },
  streaming_audio: { wave: 0.1, audio: 0.26, focus: 0.04, brightness: 0.34, ripple: 0.24, speed: 0.18 },
  processing: { wave: 0.1, audio: 0.16, focus: 0.05, brightness: 0.27, ripple: 0.18, speed: 0.19 },
};

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aTone;
  varying float vAlpha;
  varying float vTone;
  uniform float uPixelRatio;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (8.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = aAlpha;
    vTone = aTone;
  }
`;

const fragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vAlpha;
  varying float vTone;

  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float distanceToCenter = length(point);
    float softCircle = smoothstep(0.5, 0.16, distanceToCenter);
    if (softCircle <= 0.01) discard;

    vec3 color = mix(uColorA, uColorB, vTone);
    gl_FragColor = vec4(color, softCircle * vAlpha);
  }
`;

function lerp(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function linearToSrgb(value: number) {
  const clamped = clamp01(value);
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function colorFromOklch(input: string) {
  const match = input.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!match) return null;

  const lightness = match[1].endsWith("%") ? Number.parseFloat(match[1]) / 100 : Number.parseFloat(match[1]);
  const chroma = Number.parseFloat(match[2]);
  const hue = (Number.parseFloat(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const lmsL = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
  const lmsM = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
  const lmsS = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);

  return new THREE.Color(
    linearToSrgb(4.0767416621 * lmsL - 3.3077115913 * lmsM + 0.2309699292 * lmsS),
    linearToSrgb(-1.2684380046 * lmsL + 2.6097574011 * lmsM - 0.3413193965 * lmsS),
    linearToSrgb(-0.0041960863 * lmsL - 0.7034186147 * lmsM + 1.707614701 * lmsS),
  );
}

function resolveCssColor(variable: string, fallback: string) {
  const styles = window.getComputedStyle(document.documentElement);
  const raw = styles.getPropertyValue(variable).trim() || fallback;
  const oklch = colorFromOklch(raw);
  if (oklch) return oklch;
  return new THREE.Color(raw);
}

function currentConfig(status: AssistantStatus) {
  return CONFIGS[status] ?? CONFIGS.idle;
}

export function DottedSurface({ className }: DottedSurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const statusRef = { current: useAssistant.getState().status };
    const levelRef = { current: useAssistant.getState().micLevel };
    const unsubscribe = useAssistant.subscribe((state) => {
      statusRef.current = state.status;
      levelRef.current = state.micLevel;
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.z = 8.5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);

    const count = 1800;
    const positions = new Float32Array(count * 3);
    const bases = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const tones = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const gx = (i % 70) / 69;
      const gy = Math.floor(i / 70) / Math.floor(count / 70);
      const x = (gx - 0.5) * 12 + (Math.random() - 0.5) * 0.08;
      const y = (gy - 0.5) * 7.2 + (Math.random() - 0.5) * 0.08;
      const z = (Math.random() - 0.5) * 0.7;

      bases[i * 3] = x;
      bases[i * 3 + 1] = y;
      bases[i * 3 + 2] = z;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      sizes[i] = 5 + Math.random() * 5;
      alphas[i] = 0.16;
      tones[i] = Math.random();
      seeds[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aTone", new THREE.BufferAttribute(tones, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader,
      fragmentShader,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uColorA: { value: resolveCssColor("--foreground", "#f7f5ff") },
        uColorB: { value: resolveCssColor("--accent", "#88e7ff") },
      },
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let frame = 0;
    let width = 1;
    let height = 1;
    let smoothLevel = 0;
    let smoothWave = CONFIGS.idle.wave;
    let smoothFocus = CONFIGS.idle.focus;
    let smoothBrightness = CONFIGS.idle.brightness;
    let smoothRipple = CONFIGS.idle.ripple;
    let smoothSpeed = CONFIGS.idle.speed;

    const resize = () => {
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);
    };

    const updateThemeColors = () => {
      material.uniforms.uColorA.value = resolveCssColor("--foreground", "#f7f5ff");
      const accentVar = statusRef.current === "speaking" ? "--primary" : statusRef.current === "listening" ? "--accent" : "--cyan";
      material.uniforms.uColorB.value = resolveCssColor(accentVar, "#88e7ff");
    };

    const observer = new MutationObserver(updateThemeColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    window.addEventListener("resize", resize);
    resize();
    updateThemeColors();

    const animate = () => {
      const config = currentConfig(statusRef.current);
      const audioLevel = Math.min(1, levelRef.current);

      smoothLevel = lerp(smoothLevel, audioLevel, 0.12);
      smoothWave = lerp(smoothWave, config.wave + smoothLevel * config.audio, 0.035);
      smoothFocus = lerp(smoothFocus, config.focus, 0.035);
      smoothBrightness = lerp(smoothBrightness, config.brightness + smoothLevel * 0.14, 0.045);
      smoothRipple = lerp(smoothRipple, config.ripple, 0.04);
      smoothSpeed = lerp(smoothSpeed, config.speed + smoothLevel * 0.24, 0.04);

      const time = performance.now() * 0.001;
      const pulse = Math.sin(time * (1.3 + smoothSpeed * 2.2)) * 0.5 + 0.5;
      const aspectPush = Math.min(1.28, width / Math.max(1, height));

      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const baseX = bases[ix] * aspectPush;
        const baseY = bases[ix + 1];
        const baseZ = bases[ix + 2];
        const distance = Math.sqrt(baseX * baseX + baseY * baseY);
        const center = Math.max(0, 1 - distance / 5.8);
        const ripple = Math.sin(distance * 2.8 - time * (2.2 + smoothRipple * 4.5)) * smoothRipple;
        const wave =
          Math.sin(baseX * 1.4 + time * (1.1 + smoothSpeed) + seeds[i]) +
          Math.sin(baseY * 1.9 + time * (0.8 + smoothSpeed * 1.4));
        const focusPull = center * smoothFocus;

        positions[ix] = baseX * (1 - focusPull * 0.08);
        positions[ix + 1] = baseY * (1 - focusPull * 0.12) + wave * smoothWave * 0.08 + ripple * 0.08 * center;
        positions[ix + 2] = baseZ + wave * smoothWave * 0.16 + ripple * center * 0.28;
        sizes[i] = 4 + center * 5 + smoothLevel * 3 + pulse * smoothRipple * center * 3;
        alphas[i] = Math.min(0.52, 0.06 + smoothBrightness * (0.26 + center * 0.48));
        tones[i] = Math.min(1, 0.18 + center * 0.36 + smoothLevel * 0.12 + pulse * smoothRipple * 0.08);
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
      geometry.attributes.aTone.needsUpdate = true;

      points.rotation.z = Math.sin(time * 0.08) * 0.035;
      points.rotation.x = Math.sin(time * 0.11) * 0.04;

      if (glowRef.current) {
        const glow = 0.08 + smoothBrightness * 0.2 + smoothLevel * 0.08 + pulse * smoothRipple * 0.04;
        glowRef.current.style.opacity = String(Math.min(0.34, glow));
        glowRef.current.style.transform = `translate(-50%, -50%) scale(${0.92 + smoothLevel * 0.08 + smoothRipple * pulse * 0.04})`;
      }

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      unsubscribe();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frame);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[34vmin] w-[34vmin] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent) 22%, transparent), color-mix(in oklch, var(--primary) 10%, transparent) 42%, transparent 72%)",
        }}
      />
    </div>
  );
}
