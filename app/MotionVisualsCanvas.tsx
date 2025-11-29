import { useState, useRef, useEffect } from "react";

type CanvasInterface = ReturnType<typeof useCanvas>;

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
  const [beatPulse, setBeatPulse] = useState<number>(0);

  // Canvas rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  // Particle system state
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      color: string;
      linkedOrb?: { x: number; y: number };
    }>
  >([]);
  const particleIdRef = useRef(0);

  // Optimized Canvas rendering effect
  useEffect(() => {
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

    const render = () => {
      // Clear canvas efficiently
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Performance optimizations
      ctx.globalCompositeOperation = "source-over";

      // Enable glow effects
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Calculate current values
      const currentOrbYPercent = Math.max(
        0,
        Math.min(100, lastSentOrientationRef.current.frontToBack)
      );
      const currentOrbYPixels =
        typeof window !== "undefined"
          ? (currentOrbYPercent / 100) * (window.innerHeight - 64) + 32
          : 400;
      const currentGreen = Math.max(
        0,
        Math.min(
          255,
          Math.round((lastSentOrientationRef.current.around / 100) * 255)
        )
      );

      const orbitRadius = 48;
      const alphaRadians =
        lastSentOrientationRef.current.alpha !== null
          ? (lastSentOrientationRef.current.alpha * Math.PI) / 180
          : 0;
      const baseAngles = [0, Math.PI];
      const currentOrbPositions = baseAngles.map((baseAngle) => {
        const finalAngle = baseAngle + alphaRadians;
        return {
          x: 32 + orbitRadius * Math.cos(finalAngle),
          y: currentOrbYPixels + orbitRadius * Math.sin(finalAngle),
        };
      });

      // Draw particle connection lines
      particles.forEach((particle) => {
        if (!particle.linkedOrb) return;
        const opacity = 1.0; // Full opacity for testing
        ctx.strokeStyle = particle.color;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.linkedOrb.x, particle.linkedOrb.y);
        ctx.stroke();
      });

      // Draw particles
      particles.forEach((particle) => {
        const opacity = particle.life / particle.maxLife;

        // Glow effect
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = particle.size * 2;
        ctx.globalAlpha = opacity;

        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow
        ctx.shadowBlur = 0;
      });

      // Draw orbiting orbs
      const orbColors = [
        { r: 200, g: 200, b: 255 }, // Blue
        { r: 255, g: 200, b: 200 }, // Pink
      ];

      currentOrbPositions.forEach((pos, index) => {
        const color = orbColors[index];
        // Both orbs brighten when around value is higher
        const opacity = Math.max(
          0.2,
          Math.min(1.0, lastSentOrientationRef.current.around / 100)
        );
        const orbRadius = 12; // Fixed size, no beat scaling
        const baseGlow = 8;

        const orbX = canvas.width / 2 - 32 + pos.x;
        const orbY = pos.y;

        // Steady glow effect
        ctx.shadowColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.shadowBlur = baseGlow;
        ctx.globalAlpha = opacity;

        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw main gravity orb
      const mainOrbRadius = 32; // Fixed size, no beat scaling
      const mainOrbGlow = 20; // Steady glow

      ctx.shadowColor = `rgb(255, ${currentGreen}, 100)`;
      ctx.shadowBlur = mainOrbGlow;
      ctx.globalAlpha = 1;

      ctx.fillStyle = `rgb(255, ${currentGreen}, 100)`;
      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        currentOrbYPixels,
        mainOrbRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Reset canvas state
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [particles, lastSentOrientationRef, beatPulse]);

  // Particle system animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prevParticles) => {
        const mainOrbCenterX =
          typeof window !== "undefined" ? window.innerWidth / 2 : 400;
        const orbRadius = 32;
        const orbYPercent = Math.max(
          0,
          Math.min(100, lastSentOrientationRef.current.frontToBack)
        );
        const orbYPixels =
          typeof window !== "undefined"
            ? (orbYPercent / 100) * (window.innerHeight - 2 * orbRadius) +
              orbRadius
            : 400;

        // Calculate orb positions for particle attraction
        const orbitRadius = 48;
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

        // Update existing particles with radial motion and spin
        const updatedParticles = prevParticles
          .map((particle) => {
            // Calculate age factor for velocity decay (newer particles have higher friction)
            const ageRatio = 1 - particle.life / particle.maxLife;
            const isYoung = ageRatio < 0.15; // First 15% of lifetime

            // Apply stronger friction to young particles to fade the initial boost quickly
            const frictionRate = isYoung ? 0.92 : 0.985; // Much higher friction when young
            let newVx = particle.vx * frictionRate;
            let newVy = particle.vy * frictionRate;

            // Find nearest orb for reference
            let nearestOrb = currentOrbPositions[0];
            let minDistance = Math.sqrt(
              Math.pow(particle.x - nearestOrb.x, 2) +
                Math.pow(particle.y - nearestOrb.y, 2)
            );

            currentOrbPositions.forEach((orb) => {
              const distance = Math.sqrt(
                Math.pow(particle.x - orb.x, 2) +
                  Math.pow(particle.y - orb.y, 2)
              );
              if (distance < minDistance) {
                minDistance = distance;
                nearestOrb = orb;
              }
            });

            // Calculate radial outward force from nearest orb
            const dx = particle.x - nearestOrb.x;
            const dy = particle.y - nearestOrb.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
              // Outward radial force - increased for faster expansion
              const radialStrength = 0.035; // Increased from 0.015
              newVx += (dx / distance) * radialStrength;
              newVy += (dy / distance) * radialStrength;

              // Spin force based on 'around' value (0-100) - increased for faster spirals!
              const spinStrength =
                (lastSentOrientationRef.current.around / 100) * 0.5; // Use sent orientation data

              // Perpendicular vector for spin (rotate 90 degrees)
              const perpX = -dy / distance;
              const perpY = dx / distance;

              newVx += perpX * spinStrength;
              newVy += perpY * spinStrength;
            }

            return {
              ...particle,
              x: particle.x + newVx,
              y: particle.y + newVy,
              life: particle.life - 1,
              vx: newVx,
              vy: newVy,
              linkedOrb: nearestOrb,
            };
          })
          .filter((particle) => particle.life > 0);

        // Spawn new particles - optimized for performance
        const baseSpawnChance = 0.4; // Reduced for better performance
        const beatBoost = beatPulse * 2.0; // Moderate beat boost
        const shouldSpawn = Math.random() < baseSpawnChance + beatBoost;
        const maxParticles = beatPulse > 0.5 ? 200 : 100; // Reduced limits for performance

        if (shouldSpawn && updatedParticles.length < maxParticles) {
          // Choose random orb to spawn from
          const sourceOrb =
            currentOrbPositions[
              Math.floor(Math.random() * currentOrbPositions.length)
            ];

          // Spawn particles in a more radial pattern
          const angle = Math.random() * Math.PI * 2;
          const baseSpeed = 2 + Math.random() * 3; // Increased from 1-3 to 2-5
          const intensity =
            (lastSentOrientationRef.current.frontToBack +
              lastSentOrientationRef.current.around) /
            250; // Reduced divisor for higher intensity

          // Beat boost - particles get extra velocity during beats!
          const beatVelocityBoost = 1 + beatPulse * 2; // Up to 3x speed during beats

          // Initial radial velocity (outward from orb)
          const radialSpeed = baseSpeed * intensity * beatVelocityBoost;

          // Choose color based on which orb spawned it
          const orbIndex = currentOrbPositions.indexOf(sourceOrb);
          const orbColors = ["rgb(200, 200, 255)", "rgb(255, 200, 200)"];
          const baseColor = orbColors[orbIndex] || "rgb(255, 255, 255)";

          const newParticle = {
            id: particleIdRef.current++,
            x: sourceOrb.x + (Math.random() - 0.5) * 10, // Spawn closer to orb center
            y: sourceOrb.y + (Math.random() - 0.5) * 10,
            vx: Math.cos(angle) * radialSpeed,
            vy: Math.sin(angle) * radialSpeed,
            life: 120 + Math.random() * 120, // Longer life for better visibility
            maxLife: 120 + Math.random() * 120,
            size: 1.5 + Math.random() * 2.5,
            color: baseColor,
            linkedOrb: sourceOrb,
          };

          updatedParticles.push(newParticle);

          // During strong beats, spawn multiple particles at once for burst effect
          if (beatPulse > 0.7) {
            for (let burst = 0; burst < 4; burst++) {
              // Reduced for performance
              const burstAngle = Math.random() * Math.PI * 2;
              const burstVelocityBoost = 3 + beatPulse * 4; // Increased boost for burst particles
              const burstSpeed =
                baseSpeed *
                intensity *
                burstVelocityBoost *
                (1.5 + Math.random()); // Higher multiplier for faster burst particles

              const burstParticle = {
                id: particleIdRef.current++,
                x: sourceOrb.x + (Math.random() - 0.5) * 15,
                y: sourceOrb.y + (Math.random() - 0.5) * 15,
                vx: Math.cos(burstAngle) * burstSpeed,
                vy: Math.sin(burstAngle) * burstSpeed,
                life: 100 + Math.random() * 100,
                maxLife: 100 + Math.random() * 100,
                size: 2 + Math.random() * 3, // Slightly larger burst particles
                color: baseColor,
                linkedOrb: sourceOrb,
              };

              if (updatedParticles.length < maxParticles) {
                updatedParticles.push(burstParticle);
              }
            }
          }
        }

        return updatedParticles;
      });
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(interval);
  }, [lastSentOrientationRef, beatPulse]);

  return {
    canvasRef,
    setBeatPulse,
  };
}

export function MotionVisualsCanvas({ canvas }: { canvas: CanvasInterface }) {
  const { canvasRef } = canvas;
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
