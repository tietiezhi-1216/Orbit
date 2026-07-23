import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

export type ProductMotionVariant =
  | "tietiezhi"
  | "workspace"
  | "automations"
  | "create";

type ParticleKind = "dot" | "ring" | "star" | "diamond" | "tick";

interface PathSpec {
  radiusX: number;
  radiusY: number;
  rotation: number;
}

interface MotionConfig {
  seed: number;
  centerY: number;
  paths: PathSpec[];
  particleCount: number;
  shapes: ParticleKind[];
  colors: [string, string, string];
  pathLight: string;
  pathDark: string;
  motionClassName: string;
  glowClassName: string;
  accentGlowClassName: string;
}

interface ParticleSpec {
  kind: ParticleKind;
  pathIndex: number;
  phase: number;
  speed: number;
  size: number;
  opacity: number;
  lifeOffset: number;
  lifeDuration: number;
  radialDrift: number;
  colorIndex: number;
}

const MOTION_CONFIGS: Record<ProductMotionVariant, MotionConfig> = {
  tietiezhi: {
    seed: 0x71e7a1,
    centerY: 0.5,
    paths: [
      { radiusX: 0.42, radiusY: 0.22, rotation: -0.09 },
      { radiusX: 0.34, radiusY: 0.3, rotation: 0.16 },
      { radiusX: 0.46, radiusY: 0.14, rotation: 0.05 },
    ],
    particleCount: 12,
    shapes: ["dot", "diamond", "star", "dot", "ring"],
    colors: ["63 205 213", "251 191 36", "249 115 22"],
    pathLight: "14 116 144",
    pathDark: "103 205 218",
    motionClassName: "animate-area-home-float",
    glowClassName: "bg-cyan-400/10 dark:bg-cyan-300/10",
    accentGlowClassName: "bg-amber-300/10 dark:bg-amber-300/10",
  },
  workspace: {
    seed: 0x4f6c77,
    centerY: 0.48,
    paths: [
      { radiusX: 0.43, radiusY: 0.19, rotation: -0.08 },
      { radiusX: 0.38, radiusY: 0.27, rotation: 0.13 },
      { radiusX: 0.47, radiusY: 0.13, rotation: 0.03 },
    ],
    particleCount: 10,
    shapes: ["ring", "dot", "dot", "dot", "star"],
    colors: ["113 215 235", "56 189 248", "249 115 22"],
    pathLight: "16 116 140",
    pathDark: "91 190 212",
    motionClassName: "animate-channel-breathe",
    glowClassName: "bg-cyan-400/10 dark:bg-cyan-300/10",
    accentGlowClassName: "bg-sky-400/10 dark:bg-sky-300/10",
  },
  automations: {
    seed: 0xa770aa,
    centerY: 0.5,
    paths: [
      { radiusX: 0.3, radiusY: 0.3, rotation: 0 },
      { radiusX: 0.43, radiusY: 0.18, rotation: -0.18 },
      { radiusX: 0.44, radiusY: 0.12, rotation: 0.2 },
    ],
    particleCount: 13,
    shapes: ["tick", "dot", "ring", "tick", "dot"],
    colors: ["251 146 60", "251 191 36", "56 189 248"],
    pathLight: "194 92 24",
    pathDark: "251 146 60",
    motionClassName: "animate-area-automation-float",
    glowClassName: "bg-orange-400/10 dark:bg-orange-300/10",
    accentGlowClassName: "bg-amber-300/15 dark:bg-amber-300/10",
  },
  create: {
    seed: 0xc4ea7e,
    centerY: 0.49,
    paths: [
      { radiusX: 0.45, radiusY: 0.16, rotation: -0.16 },
      { radiusX: 0.35, radiusY: 0.28, rotation: 0.19 },
      { radiusX: 0.47, radiusY: 0.11, rotation: 0.08 },
    ],
    particleCount: 12,
    shapes: ["diamond", "star", "dot", "diamond", "ring"],
    colors: ["244 114 182", "251 191 36", "34 211 238"],
    pathLight: "190 24 93",
    pathDark: "244 114 182",
    motionClassName: "animate-area-create-float",
    glowClassName: "bg-rose-400/10 dark:bg-rose-300/10",
    accentGlowClassName: "bg-amber-300/15 dark:bg-amber-300/10",
  },
};

const TAU = Math.PI * 2;

function seededRandom(seed: number) {
  let value = seed || 0x6d2b79f5;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4_294_967_296;
  };
}

function makeParticles(config: MotionConfig): ParticleSpec[] {
  const random = seededRandom(config.seed);
  return Array.from({ length: config.particleCount }, (_, index) => ({
    kind: config.shapes[index % config.shapes.length] ?? "dot",
    pathIndex: Math.floor(random() * config.paths.length),
    phase: random() * TAU,
    speed: (0.05 + random() * 0.08) * (random() > 0.24 ? 1 : -1),
    size: 1.8 + random() * 3.8,
    opacity: 0.34 + random() * 0.5,
    lifeOffset: random(),
    lifeDuration: 5.8 + random() * 7.2,
    radialDrift: random() * TAU,
    colorIndex: index % config.colors.length,
  }));
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function particleFade(life: number): number {
  const fadeIn = smoothstep(Math.min(1, life / 0.16));
  const fadeOut = smoothstep(Math.min(1, (1 - life) / 0.22));
  return Math.min(fadeIn, fadeOut);
}

function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  context.beginPath();
  context.moveTo(x, y - size);
  context.quadraticCurveTo(x + size * 0.18, y - size * 0.18, x + size, y);
  context.quadraticCurveTo(x + size * 0.18, y + size * 0.18, x, y + size);
  context.quadraticCurveTo(x - size * 0.18, y + size * 0.18, x - size, y);
  context.quadraticCurveTo(x - size * 0.18, y - size * 0.18, x, y - size);
  context.closePath();
  context.fill();
}

function drawParticle(
  context: CanvasRenderingContext2D,
  particle: ParticleSpec,
  x: number,
  y: number,
  angle: number,
) {
  const size = particle.size;
  if (particle.kind === "ring") {
    context.lineWidth = 0.9;
    context.beginPath();
    context.arc(x, y, size * 1.35, 0, TAU);
    context.stroke();
    return;
  }
  if (particle.kind === "star") {
    drawStar(context, x, y, size * 1.25);
    return;
  }
  if (particle.kind === "diamond") {
    context.save();
    context.translate(x, y);
    context.rotate(angle * 0.35 + Math.PI / 4);
    context.fillRect(-size * 0.75, -size * 0.75, size * 1.5, size * 1.5);
    context.restore();
    return;
  }
  if (particle.kind === "tick") {
    context.save();
    context.translate(x, y);
    context.rotate(angle + Math.PI / 2);
    context.lineWidth = 1.3;
    context.beginPath();
    context.moveTo(-size * 1.3, 0);
    context.lineTo(size * 1.3, 0);
    context.stroke();
    context.restore();
    return;
  }
  context.beginPath();
  context.arc(x, y, size, 0, TAU);
  context.fill();
}

export function ProductMotionStage({
  variant,
  children,
  className,
  mascotClassName,
  mascotRef,
  motionPaused = false,
}: {
  variant: ProductMotionVariant;
  children: ReactNode;
  className?: string;
  mascotClassName?: string;
  mascotRef?: Ref<HTMLSpanElement>;
  motionPaused?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = MOTION_CONFIGS[variant];
  const particlesRef = useRef<ParticleSpec[] | null>(null);
  if (!particlesRef.current) particlesRef.current = makeParticles(config);

  useEffect(() => {
    if (motionPaused) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const particles = particlesRef.current;
    if (!particles) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let startTime = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawPath = (path: PathSpec, dark: boolean) => {
      context.save();
      context.translate(width / 2, height * config.centerY);
      context.rotate(path.rotation);
      context.beginPath();
      context.ellipse(0, 0, width * path.radiusX, height * path.radiusY, 0, 0, TAU);
      context.strokeStyle = `rgb(${dark ? config.pathDark : config.pathLight} / 0.13)`;
      context.lineWidth = 0.75;
      context.stroke();
      context.restore();
    };

    const draw = (time: number) => {
      startTime ||= time;
      const seconds = motionQuery.matches ? 0 : (time - startTime) / 1_000;
      const dark = document.documentElement.classList.contains("dark");
      context.clearRect(0, 0, width, height);
      config.paths.forEach((path) => drawPath(path, dark));

      particles.forEach((particle) => {
        const path = config.paths[particle.pathIndex];
        if (!path) return;
        const life = motionQuery.matches
          ? (particle.lifeOffset + 0.42) % 1
          : (seconds / particle.lifeDuration + particle.lifeOffset) % 1;
        const fade = particleFade(life) * particle.opacity;
        if (fade <= 0.01) return;

        const angle = particle.phase + seconds * particle.speed;
        const radialPulse = 1 + Math.sin(seconds * 0.47 + particle.radialDrift) * 0.045;
        const pathX = Math.cos(angle) * width * path.radiusX * radialPulse;
        const pathY = Math.sin(angle) * height * path.radiusY * radialPulse;
        const rotationCos = Math.cos(path.rotation);
        const rotationSin = Math.sin(path.rotation);
        const x = width / 2 + pathX * rotationCos - pathY * rotationSin;
        const y = height * config.centerY + pathX * rotationSin + pathY * rotationCos;
        const color = config.colors[particle.colorIndex] ?? config.colors[0];

        context.save();
        context.globalAlpha = fade;
        context.fillStyle = `rgb(${color})`;
        context.strokeStyle = `rgb(${color})`;
        context.shadowColor = `rgb(${color} / 0.72)`;
        context.shadowBlur = particle.size * 2.2;
        drawParticle(context, particle, x, y, angle);
        context.restore();
      });

      if (!motionQuery.matches) animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    draw(0);
    const observer = new ResizeObserver(() => {
      resize();
      if (motionQuery.matches) draw(0);
    });
    observer.observe(canvas);

    const handleMotionChange = () => {
      window.cancelAnimationFrame(animationFrame);
      startTime = 0;
      draw(0);
    };
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      observer.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [config, motionPaused]);

  return (
    <span
      aria-hidden
      className={cn(
        "animate-channel-arrive pointer-events-none relative block h-72 w-[26rem] max-w-[calc(100vw-2rem)] shrink-0 select-none overflow-hidden motion-reduce:animate-none",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 left-1/2 h-24 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl",
          config.glowClassName,
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute top-[38%] left-[58%] h-16 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl",
          config.accentGlowClassName,
        )}
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center motion-reduce:animate-none",
          motionPaused ? "animate-none" : config.motionClassName,
        )}
      >
        <span
          ref={mascotRef}
          data-mascot-motion="float"
          className={cn(
            "pointer-events-none relative z-10 block size-56 drop-shadow-md will-change-transform motion-reduce:will-change-auto",
            mascotClassName,
          )}
        >
          {children}
        </span>
      </span>
    </span>
  );
}
