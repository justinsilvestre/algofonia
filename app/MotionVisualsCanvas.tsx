import { useRef, useEffect, useCallback, use } from "react";

// Visual element classes
class MiddleOrb {
  constructor(
    private frontToBack: number,
    private mainOrbColor: { r: number; g: number; b: number },
    private currentOrbYPixels: number
  ) {}

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const mainOrbRadius = ORB_SETTINGS.MAIN_ORB_RADIUS;
    const orbCenterX = canvas.width / 2;
    const orbCenterY = this.currentOrbYPixels;
    const glowRadius = 80;

    // Interpolate glow color based on frontToBack position
    const colorLerpFactor = this.frontToBack / 100;
    const glowColor = {
      r: Math.round(
        ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_LOW.r +
          (ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_HIGH.r -
            ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_LOW.r) *
            colorLerpFactor
      ),
      g: Math.round(
        ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_LOW.g +
          (ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_HIGH.g -
            ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_LOW.g) *
            colorLerpFactor
      ),
      b: Math.round(
        ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_LOW.b +
          (ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_HIGH.b -
            ORB_SETTINGS.MAIN_ORB_GLOW_COLOR_LOW.b) *
            colorLerpFactor
      ),
    };

    const mainOrbColorString = `rgb(${this.mainOrbColor.r}, ${this.mainOrbColor.g}, ${this.mainOrbColor.b})`;
    const glowColorString = `rgb(${glowColor.r}, ${glowColor.g}, ${glowColor.b})`;

    // Create radial gradient for glow effect
    const gradient = ctx.createRadialGradient(
      orbCenterX,
      orbCenterY,
      0,
      orbCenterX,
      orbCenterY,
      glowRadius
    );
    gradient.addColorStop(0, glowColorString);
    gradient.addColorStop(
      0.4,
      `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.8)`
    );
    gradient.addColorStop(
      0.7,
      `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.3)`
    );
    gradient.addColorStop(
      1,
      `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0)`
    );

    // Draw glow first
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(orbCenterX, orbCenterY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw main orb on top
    ctx.fillStyle = mainOrbColorString;
    ctx.beginPath();
    ctx.arc(orbCenterX, orbCenterY, mainOrbRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  renderBackgroundGlow(
    ctx: CanvasRenderingContext2D,
    around: number,
    canvas: HTMLCanvasElement,
    currentOrbYPixels: number
  ) {
    // Draw background white glow that intensifies with around value
    const backgroundGlowIntensity = around / 100; // 0-1 based on around value
    const backgroundGlowRadius = 70 + backgroundGlowIntensity * 100; // 150-250px radius
    const backgroundGlowOpacity = backgroundGlowIntensity * 0.75; // Up to 75% opacity

    if (backgroundGlowOpacity > 0) {
      const backgroundGradient = ctx.createRadialGradient(
        canvas.width / 2,
        currentOrbYPixels,
        0,
        canvas.width / 2,
        currentOrbYPixels,
        backgroundGlowRadius
      );
      backgroundGradient.addColorStop(
        0,
        `rgba(255, 255, 255, ${backgroundGlowOpacity})`
      );
      backgroundGradient.addColorStop(
        0.4,
        `rgba(255, 255, 255, ${backgroundGlowOpacity * 0.6})`
      );
      backgroundGradient.addColorStop(
        0.7,
        `rgba(255, 255, 255, ${backgroundGlowOpacity * 0.3})`
      );
      backgroundGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.globalAlpha = 1.0;
      ctx.fillStyle = backgroundGradient;
      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        currentOrbYPixels,
        backgroundGlowRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
}

class SideOrb {
  constructor(
    private pos: { x: number; y: number },
    private around: number,
    private color: { r: number; g: number; b: number }
  ) {}

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const opacity = Math.max(
      ORB_SETTINGS.OPACITY_MIN,
      Math.min(1.0, this.around / 100)
    );
    const orbRadius = ORB_SETTINGS.SATELLITE_ORB_RADIUS;
    const baseGlow = 8;

    const orbX = canvas.width / 2 - 32 + this.pos.x;
    const orbY = this.pos.y;

    ctx.shadowColor = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
    ctx.shadowBlur = baseGlow;
    ctx.globalAlpha = opacity;

    ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Particle {
  constructor(
    public id: number,
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public life: number,
    public maxLife: number,
    public size: number,
    public color: string,
    public linkedOrb?: { x: number; y: number }
  ) {}

  update(
    currentOrbPositions: Array<{ x: number; y: number }>,
    aroundValue: number
  ): boolean {
    // Calculate age factor for velocity decay (newer particles have higher friction)
    const ageRatio = 1 - this.life / this.maxLife;
    const isYoung = ageRatio < PARTICLE_PHYSICS.AGE_THRESHOLD;

    // Apply stronger friction to young particles to fade the initial boost quickly
    const frictionRate = isYoung
      ? PARTICLE_PHYSICS.FRICTION_YOUNG
      : PARTICLE_PHYSICS.FRICTION_MATURE;
    let newVx = this.vx * frictionRate;
    let newVy = this.vy * frictionRate;

    // Find nearest orb for reference
    let nearestOrb = currentOrbPositions[0];
    let minDistance = Math.sqrt(
      Math.pow(this.x - nearestOrb.x, 2) + Math.pow(this.y - nearestOrb.y, 2)
    );

    currentOrbPositions.forEach((orb) => {
      const distance = Math.sqrt(
        Math.pow(this.x - orb.x, 2) + Math.pow(this.y - orb.y, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestOrb = orb;
      }
    });

    // Calculate radial outward force from nearest orb
    const dx = this.x - nearestOrb.x;
    const dy = this.y - nearestOrb.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Outward radial force - increased for faster expansion
      const radialStrength = PARTICLE_PHYSICS.RADIAL_STRENGTH;
      newVx += (dx / distance) * radialStrength;
      newVy += (dy / distance) * radialStrength;

      // Spin force based on 'around' value (0-100) - increased for faster spirals!
      const spinStrength = (aroundValue / 100) * PARTICLE_PHYSICS.SPIN_STRENGTH;

      // Perpendicular vector for spin (rotate 90 degrees)
      const perpX = -dy / distance;
      const perpY = dx / distance;

      newVx += perpX * spinStrength;
      newVy += perpY * spinStrength;
    }

    // Update particle properties in place
    this.x = this.x + newVx;
    this.y = this.y + newVy;
    this.life = this.life - 1;
    this.vx = newVx;
    this.vy = newVy;
    this.linkedOrb = nearestOrb;

    // Return true if particle is still alive
    return this.life > 0;
  }

  render(ctx: CanvasRenderingContext2D) {
    const opacity = this.life / this.maxLife;

    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.size * 2;
    ctx.globalAlpha = opacity;

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  renderConnectionLine(ctx: CanvasRenderingContext2D) {
    if (!this.linkedOrb) return;

    ctx.strokeStyle = this.color;
    ctx.globalAlpha = CONNECTION_LINES.OPACITY;
    ctx.lineWidth = CONNECTION_LINES.WIDTH;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.linkedOrb.x, this.linkedOrb.y);
    ctx.stroke();
  }
}

// Visual Constants - adjust these to modify the appearance
const PARTICLE_PHYSICS = {
  FRICTION_YOUNG: 0.92, // Higher friction for new particles
  FRICTION_MATURE: 0.985, // Normal friction for older particles
  RADIAL_STRENGTH: 0.035, // Outward push force
  SPIN_STRENGTH: 0.5, // Rotational force multiplier
  AGE_THRESHOLD: 0.15, // When particles transition from young to mature
} as const;

const PARTICLE_SPAWNING = {
  BASE_SPAWN_CHANCE: 0.4, // Base probability per frame
  BEAT_BOOST: 2.0, // Beat spawn multiplier
  MAX_PARTICLES_NORMAL: 100, // Normal particle limit
  MAX_PARTICLES_BEAT: 200, // Beat particle limit
  BURST_COUNT: 4, // Particles per burst
  BURST_THRESHOLD: 0.7, // Beat pulse needed for burst
} as const;

const PARTICLE_APPEARANCE = {
  BASE_SPEED_MIN: 2, // Minimum initial speed
  BASE_SPEED_RANGE: 3, // Speed range (min + range = max)
  INTENSITY_DIVISOR: 250, // Higher = lower intensity
  BEAT_VELOCITY_BOOST: 2, // Beat speed multiplier
  BURST_VELOCITY_BASE: 3, // Base burst speed
  BURST_VELOCITY_BEAT: 4, // Beat burst speed multiplier
  BURST_SPEED_MULTIPLIER: 1.5, // Additional burst speed factor
  LIFE_MIN: 120, // Minimum particle life frames
  LIFE_RANGE: 120, // Life range (min + range = max)
  SIZE_MIN: 1.5, // Minimum particle size
  SIZE_RANGE: 2.5, // Size range
} as const;

const ORB_SETTINGS = {
  MAIN_ORB_RADIUS: 32, // Main orb radius in pixels
  SATELLITE_ORB_RADIUS: 12, // Small orb radius
  ORBIT_RADIUS: 80, // Distance from main orb
  OPACITY_MIN: 0.7, // Minimum orb opacity
  GLOW_SIZE: 8, // Base glow effect
  MAIN_ORB_COLOR_HIGH: { r: 255, g: 165, b: 0 }, // Color when frontToBack is high
  MAIN_ORB_COLOR_LOW: { r: 0, g: 100, b: 200 }, // Color when frontToBack is low
  MAIN_ORB_GLOW_COLOR_HIGH: { r: 255, g: 200, b: 50 }, // Glow color when frontToBack is high
  MAIN_ORB_GLOW_COLOR_LOW: { r: 100, g: 150, b: 255 }, // Glow color when frontToBack is low
} as const;

const CONNECTION_LINES = {
  OPACITY: 1.0, // Line opacity (1.0 for testing)
  WIDTH: 1, // Line thickness
} as const;

type CanvasInterface = ReturnType<typeof useCanvas>;

const RENDER_LINES = false; // Set to true to visualize particle connections

export function useCanvas(
  lastSentOrientationRef: React.RefObject<{
    frontToBack: number;
    around: number;
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  }>
) {
  // Beat visualization state
  const pulsing = useRef(0);

  // Canvas rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particle system state
  const particlesRef = useRef<Set<Particle>>(new Set());
  const particleIdRef = useRef(0);

  const render = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { frontToBack, around, alpha } = lastSentOrientationRef.current;
      // Clear canvas efficiently
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Performance optimizations
      ctx.globalCompositeOperation = "source-over";

      // Enable glow effects
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Calculate current values
      const orbsGroupDiameter =
        ORB_SETTINGS.ORBIT_RADIUS * 2 + 64 + ORB_SETTINGS.MAIN_ORB_RADIUS * 2;
      const yMin = orbsGroupDiameter / 2;
      const yMax = window.innerHeight - yMin;
      const currentOrbYPercent = Math.max(0, Math.min(100, frontToBack));
      const currentOrbYPixels =
        (currentOrbYPercent / 100) * (yMax - yMin) + yMin;
      // Interpolate main orb color based on frontToBack position
      const colorLerpFactor = frontToBack / 100; // 0 = low color, 1 = high color
      const baseMainOrbColor = {
        r: Math.round(
          ORB_SETTINGS.MAIN_ORB_COLOR_LOW.r +
            (ORB_SETTINGS.MAIN_ORB_COLOR_HIGH.r -
              ORB_SETTINGS.MAIN_ORB_COLOR_LOW.r) *
              colorLerpFactor
        ),
        g: Math.round(
          ORB_SETTINGS.MAIN_ORB_COLOR_LOW.g +
            (ORB_SETTINGS.MAIN_ORB_COLOR_HIGH.g -
              ORB_SETTINGS.MAIN_ORB_COLOR_LOW.g) *
              colorLerpFactor
        ),
        b: Math.round(
          ORB_SETTINGS.MAIN_ORB_COLOR_LOW.b +
            (ORB_SETTINGS.MAIN_ORB_COLOR_HIGH.b -
              ORB_SETTINGS.MAIN_ORB_COLOR_LOW.b) *
              colorLerpFactor
        ),
      };

      // Increase brightness/value based on around value
      const brightnessBoost = (around / 100) * 80; // Up to 80 additional brightness
      const mainOrbColor = {
        r: Math.min(255, baseMainOrbColor.r + brightnessBoost),
        g: Math.min(255, baseMainOrbColor.g + brightnessBoost),
        b: Math.min(255, baseMainOrbColor.b + brightnessBoost),
      };

      const orbitRadius = ORB_SETTINGS.ORBIT_RADIUS;
      const alphaRadians = alpha !== null ? (alpha * Math.PI) / 180 : 0;
      const baseAngles = [0, Math.PI];
      const currentOrbPositions = baseAngles.map((baseAngle) => {
        const finalAngle = baseAngle + alphaRadians;
        return {
          x: 32 + orbitRadius * Math.cos(finalAngle),
          y: currentOrbYPixels + orbitRadius * Math.sin(finalAngle),
        };
      });

      // Draw particle connection lines
      if (RENDER_LINES) {
        particlesRef.current.forEach((particle) => {
          particle.renderConnectionLine(ctx);
        });
      }

      // Draw particles
      particlesRef.current.forEach((particle) => {
        particle.render(ctx);
      });

      // Draw orbiting orbs
      const orbColors = [
        { r: 200, g: 200, b: 255 }, // Blue
        { r: 200, g: 200, b: 255 }, // Blue
      ];

      currentOrbPositions.forEach((pos, index) => {
        const color = orbColors[index];
        const sideOrb = new SideOrb(pos, around, color);
        sideOrb.render(ctx, canvas);
      });

      // Draw main gravity orb
      const middleOrb = new MiddleOrb(
        frontToBack,
        mainOrbColor,
        currentOrbYPixels
      );
      middleOrb.render(ctx, canvas);
      middleOrb.renderBackgroundGlow(ctx, around, canvas, currentOrbYPixels);

      // Reset canvas state
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    },
    [lastSentOrientationRef]
  );

  // Particle system animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      const particles = particlesRef.current;
      const mainOrbCenterX = window.innerWidth / 2;
      const orbsGroupDiameter =
        ORB_SETTINGS.ORBIT_RADIUS * 2 + 64 + ORB_SETTINGS.MAIN_ORB_RADIUS * 2;
      const yMin = orbsGroupDiameter / 2;
      const orbYPercent = Math.max(
        0,
        Math.min(100, lastSentOrientationRef.current.frontToBack)
      );
      const orbYPixels =
        yMin + (orbYPercent / 100) * (window.innerHeight - yMin * 2);

      // Calculate orb positions for particle attraction
      const orbitRadius = ORB_SETTINGS.ORBIT_RADIUS;
      const alphaRadians =
        lastSentOrientationRef.current.alpha !== null
          ? (lastSentOrientationRef.current.alpha * Math.PI) / 180
          : 0;
      const baseAngles = [0, Math.PI];
      const currentOrbPositions = baseAngles.map((baseAngle) => {
        const finalAngle = baseAngle + alphaRadians;
        return {
          x: mainOrbCenterX + orbitRadius * Math.cos(finalAngle),
          y: orbYPixels + orbitRadius * Math.sin(finalAngle),
        };
      });

      // Update existing particles with radial motion and spin - mutate in place
      particles.forEach((particle) => {
        const isAlive = particle.update(
          currentOrbPositions,
          lastSentOrientationRef.current.around
        );

        // Remove dead particles from Set
        if (!isAlive) {
          particles.delete(particle);
        }
      });

      const beatPulse = pulsing.current;

      // Spawn new particles - optimized for performance
      const baseSpawnChance = 0.4; // Reduced for better performance
      const beatBoost = beatPulse * 2.0; // Moderate beat boost
      const shouldSpawn = Math.random() < baseSpawnChance + beatBoost;
      const maxParticles = beatPulse > 0.5 ? 200 : 100; // Reduced limits for performance

      if (shouldSpawn && particles.size < maxParticles) {
        // Choose random orb to spawn from
        const sourceOrb =
          currentOrbPositions[
            Math.floor(Math.random() * currentOrbPositions.length)
          ];

        // Spawn particles in a more radial pattern
        const angle = Math.random() * Math.PI * 2;
        const baseSpeed =
          PARTICLE_APPEARANCE.BASE_SPEED_MIN +
          Math.random() * PARTICLE_APPEARANCE.BASE_SPEED_RANGE;
        const intensity =
          (lastSentOrientationRef.current.frontToBack +
            lastSentOrientationRef.current.around) /
          PARTICLE_APPEARANCE.INTENSITY_DIVISOR;

        // Beat boost - particles get extra velocity during beats!
        const beatVelocityBoost =
          1 + beatPulse * PARTICLE_APPEARANCE.BEAT_VELOCITY_BOOST;

        // Initial radial velocity (outward from orb)
        const radialSpeed = baseSpeed * intensity * beatVelocityBoost;

        // Choose color based on which orb spawned it
        const orbIndex = currentOrbPositions.indexOf(sourceOrb);
        const orbColors = ["rgb(200, 200, 255)", "rgb(255, 200, 200)"];
        const baseColor = orbColors[orbIndex] || "rgb(255, 255, 255)";

        const newParticle = new Particle(
          particleIdRef.current++,
          sourceOrb.x + (Math.random() - 0.5) * 10, // x
          sourceOrb.y + (Math.random() - 0.5) * 10, // y
          Math.cos(angle) * radialSpeed, // vx
          Math.sin(angle) * radialSpeed, // vy
          PARTICLE_APPEARANCE.LIFE_MIN +
            Math.random() * PARTICLE_APPEARANCE.LIFE_RANGE, // life
          PARTICLE_APPEARANCE.LIFE_MIN +
            Math.random() * PARTICLE_APPEARANCE.LIFE_RANGE, // maxLife
          PARTICLE_APPEARANCE.SIZE_MIN +
            Math.random() * PARTICLE_APPEARANCE.SIZE_RANGE, // size
          baseColor, // color
          sourceOrb // linkedOrb
        );

        particles.add(newParticle);

        // During strong beats, spawn multiple particles at once for burst effect
        if (beatPulse > PARTICLE_SPAWNING.BURST_THRESHOLD) {
          for (let burst = 0; burst < PARTICLE_SPAWNING.BURST_COUNT; burst++) {
            // Reduced for performance
            const burstAngle = Math.random() * Math.PI * 2;
            const burstVelocityBoost =
              PARTICLE_APPEARANCE.BURST_VELOCITY_BASE +
              beatPulse * PARTICLE_APPEARANCE.BURST_VELOCITY_BEAT;
            const burstSpeed =
              baseSpeed *
              intensity *
              burstVelocityBoost *
              (PARTICLE_APPEARANCE.BURST_SPEED_MULTIPLIER + Math.random());

            const burstParticle = new Particle(
              particleIdRef.current++,
              sourceOrb.x + (Math.random() - 0.5) * 15, // x
              sourceOrb.y + (Math.random() - 0.5) * 15, // y
              Math.cos(burstAngle) * burstSpeed, // vx
              Math.sin(burstAngle) * burstSpeed, // vy
              100 + Math.random() * 100, // life
              100 + Math.random() * 100, // maxLife
              2 + Math.random() * 3, // size - slightly larger burst particles
              baseColor, // color
              sourceOrb // linkedOrb
            );

            if (particles.size < maxParticles) {
              particles.add(burstParticle);
            }
          }
        }
      }
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(interval);
  }, [lastSentOrientationRef, pulsing]);

  return {
    canvasRef,
    render,
    particles: particlesRef,
    lastSentOrientationRef,
    pulsing,
    pulse: useCallback(() => {
      console.log("Canvas pulse triggered");
      pulsing.current = 1.0;
      setTimeout(() => {
        pulsing.current = 0;
      }, 150);
    }, []),
  };
}

export function MotionVisualsCanvas({ canvas }: { canvas: CanvasInterface }) {
  const { canvasRef, render, particles, lastSentOrientationRef, pulsing } =
    canvas;
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const renderLoop = () => {
      render(ctx);
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [canvasRef, render]);

  useEffect(() => {
    console.log(
      "Will start render?",
      canvasRef.current,
      canvasRef.current?.getContext("2d")
    );
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Performance optimizations for Canvas 2D
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [particles, lastSentOrientationRef, pulsing]);
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
