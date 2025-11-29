import { useRef, useEffect, useCallback, useMemo } from "react";

// Visual element classes
class MiddleOrb {
  constructor(
    private frontToBack: number,
    private mainOrbColor: { r: number; g: number; b: number },
    private currentOrbYPixels: number
  ) {}

  renderToCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
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

  renderBackgroundGlowToCanvas(
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

  renderToWebGL(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    viewportWidth: number,
    viewportHeight: number
  ) {
    // Get attribute locations
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const sizeLocation = gl.getAttribLocation(program, "a_size");
    const colorLocation = gl.getAttribLocation(program, "a_color");

    if (positionLocation === -1 || sizeLocation === -1 || colorLocation === -1)
      return;

    // Calculate orb position
    const orbX = viewportWidth / 2;
    const orbY = this.currentOrbYPixels;

    // Convert RGB to normalized values
    const r = this.mainOrbColor.r / 255;
    const g = this.mainOrbColor.g / 255;
    const b = this.mainOrbColor.b / 255;
    const a = 1.0;

    // Set up vertex data with larger size for WebGL
    const positions = new Float32Array([orbX, orbY]);
    const sizes = new Float32Array([ORB_SETTINGS.MAIN_ORB_RADIUS * 2 * 2.0]); // 2x larger for WebGL
    const colors = new Float32Array([r, g, b, a]);

    // Create and bind buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Draw the main orb
    gl.drawArrays(gl.POINTS, 0, 1);

    // Clean up
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(sizeBuffer);
    gl.deleteBuffer(colorBuffer);
  }
}

class SideOrb {
  constructor(
    private pos: { x: number; y: number },
    private around: number,
    private color: { r: number; g: number; b: number }
  ) {}

  renderToCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
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

  renderToWebGL(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    viewportWidth: number,
    viewportHeight: number
  ) {
    // Get attribute locations
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const sizeLocation = gl.getAttribLocation(program, "a_size");
    const colorLocation = gl.getAttribLocation(program, "a_color");

    if (positionLocation === -1 || sizeLocation === -1 || colorLocation === -1)
      return;

    // Calculate opacity and position
    const opacity = Math.max(
      ORB_SETTINGS.OPACITY_MIN,
      Math.min(1.0, this.around / 100)
    );
    const orbX = viewportWidth / 2 - 32 + this.pos.x;
    const orbY = this.pos.y;

    // Convert RGB to normalized values
    const r = this.color.r / 255;
    const g = this.color.g / 255;
    const b = this.color.b / 255;
    const a = opacity;

    // Set up vertex data with larger size for WebGL
    const positions = new Float32Array([orbX, orbY]);
    const sizes = new Float32Array([
      ORB_SETTINGS.SATELLITE_ORB_RADIUS * 2 * 1.8,
    ]); // 1.8x larger for WebGL
    const colors = new Float32Array([r, g, b, a]);

    // Create and bind buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Draw the satellite orb
    gl.drawArrays(gl.POINTS, 0, 1);

    // Clean up
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(sizeBuffer);
    gl.deleteBuffer(colorBuffer);
  }
}

class Particle {
  public trailPositions: Array<{
    x: number;
    y: number;
    age: number;
    intensity: number;
  }> = [];
  private maxTrailLength = 20; // Much longer trail for dramatic comet effect
  private nucleusGlow = 0; // Comet nucleus brightness
  private tailWidth = 1; // Comet tail width

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

    // Calculate velocity for comet effects
    const velocity = Math.sqrt(newVx * newVx + newVy * newVy);
    const velocityIntensity = Math.min(velocity / 6, 1.0);

    // Add current position to trail with velocity-based intensity
    this.trailPositions.unshift({
      x: this.x,
      y: this.y,
      age: 0,
      intensity: velocityIntensity,
    });

    // Update trail ages and intensity decay
    this.trailPositions = this.trailPositions
      .map((pos) => ({
        ...pos,
        age: pos.age + 1,
        intensity: pos.intensity * 0.92, // Fade intensity over time
      }))
      .filter((_, index) => index < this.maxTrailLength);

    // Update comet properties based on velocity
    this.nucleusGlow = Math.min(velocityIntensity * 1.5 + 0.3, 1.0);
    this.tailWidth = Math.max(1, velocityIntensity * 3);

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

  renderToCanvas(ctx: CanvasRenderingContext2D) {
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

  renderToWebGL(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    viewportWidth: number,
    viewportHeight: number
  ) {
    // Get attribute locations including comet-specific attributes
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const sizeLocation = gl.getAttribLocation(program, "a_size");
    const colorLocation = gl.getAttribLocation(program, "a_color");
    const nucleusGlowLocation = gl.getAttribLocation(program, "a_nucleusGlow");
    const velocityLocation = gl.getAttribLocation(program, "a_velocity");

    if (positionLocation === -1 || sizeLocation === -1 || colorLocation === -1)
      return;

    // Parse color string to RGBA values
    const colorMatch = this.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!colorMatch) return;

    const r = parseInt(colorMatch[1]) / 255;
    const g = parseInt(colorMatch[2]) / 255;
    const b = parseInt(colorMatch[3]) / 255;
    const baseAlpha = this.life / this.maxLife;

    // Calculate comet nucleus properties
    const velocity = Math.sqrt(this.vx * this.vx + this.vy * this.vy) / 8;
    const nucleusSize = this.size * (1 + this.nucleusGlow);
    const nucleusAlpha = Math.min(
      baseAlpha * (1 + this.nucleusGlow * 0.5),
      1.0
    );

    // Enhanced nucleus colors based on velocity and glow
    const nucleusR = Math.min(r + this.nucleusGlow * 0.3, 1.0);
    const nucleusG = Math.min(g + this.nucleusGlow * 0.2, 1.0);
    const nucleusB = Math.max(b - this.nucleusGlow * 0.1, 0.3);

    // Set up vertex data with comet properties
    const positions = new Float32Array([this.x, this.y]);
    const sizes = new Float32Array([nucleusSize]);
    const colors = new Float32Array([
      nucleusR,
      nucleusG,
      nucleusB,
      nucleusAlpha,
    ]);
    const nucleusGlows = new Float32Array([this.nucleusGlow]);
    const velocities = new Float32Array([velocity]);

    // Create and bind buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Bind comet-specific attributes
    if (nucleusGlowLocation !== -1) {
      const glowBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, glowBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, nucleusGlows, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(nucleusGlowLocation);
      gl.vertexAttribPointer(nucleusGlowLocation, 1, gl.FLOAT, false, 0, 0);
    }

    if (velocityLocation !== -1) {
      const velocityBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(velocityLocation);
      gl.vertexAttribPointer(velocityLocation, 1, gl.FLOAT, false, 0, 0);
    }

    // Draw the comet nucleus
    gl.drawArrays(gl.POINTS, 0, 1);

    // Clean up
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(sizeBuffer);
    gl.deleteBuffer(colorBuffer);
  }

  renderConnectionLineToWebGL(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    viewportWidth: number,
    viewportHeight: number
  ) {
    if (!this.linkedOrb) return;

    // Get attribute locations
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const colorLocation = gl.getAttribLocation(program, "a_color");

    if (positionLocation === -1 || colorLocation === -1) return;

    // Parse color string to RGBA values
    const colorMatch = this.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!colorMatch) return;

    const r = parseInt(colorMatch[1]) / 255;
    const g = parseInt(colorMatch[2]) / 255;
    const b = parseInt(colorMatch[3]) / 255;
    const a = CONNECTION_LINES.OPACITY;

    // Set up line vertex data (two points)
    const positions = new Float32Array([
      this.x,
      this.y,
      this.linkedOrb.x,
      this.linkedOrb.y,
    ]);
    const colors = new Float32Array([r, g, b, a, r, g, b, a]);

    // Create and bind buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Set line width
    gl.lineWidth(CONNECTION_LINES.WIDTH);

    // Draw the line
    gl.drawArrays(gl.LINES, 0, 2);

    // Clean up
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(colorBuffer);
  }

  renderTrailStreakToWebGL(
    gl: WebGLRenderingContext,
    lineProgram: WebGLProgram,
    viewportWidth: number,
    viewportHeight: number
  ) {
    if (this.trailPositions.length < 3) return;

    // Get attribute locations for line shader
    const positionLocation = gl.getAttribLocation(lineProgram, "a_position");
    const colorLocation = gl.getAttribLocation(lineProgram, "a_color");

    if (positionLocation === -1 || colorLocation === -1) return;

    // Parse color
    const colorMatch = this.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!colorMatch) return;

    const r = parseInt(colorMatch[1]) / 255;
    const g = parseInt(colorMatch[2]) / 255;
    const b = parseInt(colorMatch[3]) / 255;

    // Calculate velocity for comet tail intensity
    const velocity = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const cometIntensity = Math.min(velocity / 6, 1.0);

    // Only render comet tail if moving fast enough
    if (cometIntensity < 0.15) return;

    // Create comet tail with multiple line segments for tapering effect
    const positions = [];
    const colors = [];

    // Start from current position (comet head)
    positions.push(this.x, this.y);
    colors.push(
      r + cometIntensity * 0.2,
      g + cometIntensity * 0.1,
      Math.max(b - cometIntensity * 0.1, 0.3),
      cometIntensity * 0.9
    );

    // Add trail positions with exponential fading (comet tail behavior)
    const maxTailSegments = Math.min(this.trailPositions.length, 8);
    for (let i = 0; i < maxTailSegments; i++) {
      const trailPos = this.trailPositions[i];
      const segmentRatio = i / maxTailSegments;
      const exponentialFade = Math.pow(1 - segmentRatio, 2.5); // Comet-like exponential fade
      const alpha = cometIntensity * exponentialFade * 0.7;

      if (alpha > 0.03) {
        positions.push(trailPos.x, trailPos.y);

        // Color shifts from hot orange/yellow to cool blue along the tail
        const coolFactor = segmentRatio * 0.8;
        const tailR = Math.max(r - coolFactor * 0.5, r * 0.2);
        const tailG = Math.max(g - coolFactor * 0.3, g * 0.3);
        const tailB = Math.min(b + coolFactor * 0.6, 1.0);

        colors.push(tailR, tailG, tailB, alpha);
      }
    }

    if (positions.length < 4) return;

    // Create buffers for comet tail
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Dynamic line width based on comet intensity and tail width
    gl.lineWidth(Math.max(1, this.tailWidth * cometIntensity));

    // Draw comet tail as connected line strip
    gl.drawArrays(gl.LINE_STRIP, 0, positions.length / 2);

    // Clean up
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(colorBuffer);
  }
}

// WebGL utility functions
function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createShaderProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

// Enhanced vertex shader for comet particles
const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute vec4 a_color;
  attribute float a_nucleusGlow;
  attribute float a_velocity;
  
  uniform vec2 u_resolution;
  
  varying vec4 v_color;
  varying float v_nucleusGlow;
  varying float v_velocity;
  
  void main() {
    vec2 position = ((a_position / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    gl_Position = vec4(position, 0, 1);
    gl_PointSize = a_size;
    v_color = a_color;
    v_nucleusGlow = a_nucleusGlow;
    v_velocity = a_velocity;
  }
`;

// Line vertex shader for trailing streaks
const LINE_VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  
  uniform vec2 u_resolution;
  
  varying vec4 v_color;
  
  void main() {
    vec2 position = ((a_position / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
    gl_Position = vec4(position, 0, 1);
    v_color = a_color;
  }
`;

// Line fragment shader for smooth trails
const LINE_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  
  varying vec4 v_color;
  
  void main() {
    gl_FragColor = v_color;
  }
`;

// Enhanced fragment shader for comet-like particles with dynamic attributes
const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  
  varying vec4 v_color;
  varying float v_nucleusGlow;
  varying float v_velocity;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    
    if (dist > 0.5) {
      discard;
    }
    
    // Dynamic comet nucleus structure based on velocity and glow
    float coreSize = 0.1 + (v_nucleusGlow * 0.1);              // Brighter = larger core
    float coronaSize = 0.25 + (v_velocity * 0.15);             // Faster = larger corona
    
    float nucleus = 1.0 - smoothstep(0.0, coreSize, dist);     // Dynamic bright core
    float corona = 1.0 - smoothstep(coreSize, coronaSize, dist); // Dynamic corona
    float coma = 1.0 - smoothstep(coronaSize, 0.5, dist);      // Outer coma
    
    // Velocity-based effects: faster comets flicker more
    float flickerSpeed = 20.0 + (v_velocity * 30.0);
    float flicker = sin(dist * flickerSpeed) * (0.1 + v_velocity * 0.2) + (0.9 - v_velocity * 0.1);
    float pulse = sin(dist * (5.0 + v_velocity * 10.0)) * 0.15 + 0.85;
    
    // Glow-based intensity modulation
    float glowBoost = 1.0 + (v_nucleusGlow * 0.8);
    float alpha = (nucleus * glowBoost) + (corona * 0.6 * flicker) + (coma * 0.25 * pulse);
    
    // Dynamic comet colors based on velocity and glow
    vec3 color = v_color.rgb;
    
    // Hot nucleus: more glow = whiter/yellower
    color += vec3(0.2 + v_nucleusGlow * 0.4, 0.15 + v_nucleusGlow * 0.3, v_nucleusGlow * 0.1) * nucleus;
    
    // Corona: velocity affects color temperature
    color += vec3(0.3 + v_velocity * 0.2, 0.15 + v_velocity * 0.1, -0.05) * corona;
    
    // Coma: cooler, more blue with velocity
    color += vec3(-0.1, 0.05, 0.1 + v_velocity * 0.3) * coma;
    
    // Ensure colors stay in valid range
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, v_color.a * alpha);
  }
`;

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
  const elementRef = useRef<HTMLCanvasElement>(null);

  return {
    elementRef,
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

export function MotionVisuals({ canvas }: { canvas: CanvasInterface }) {
  const { elementRef, lastSentOrientationRef, pulsing } = canvas;
  const particleIdRef = useRef(0);
  // Particle system state
  const particlesRef = useRef<Set<Particle>>(new Set());

  // Detect WebGL support once
  const renderingMode = useMemo(() => {
    if (typeof window === "undefined") return "canvas";

    try {
      // Create a temporary canvas to test WebGL support
      const testCanvas = document.createElement("canvas");
      const gl =
        testCanvas.getContext("webgl") ||
        testCanvas.getContext("experimental-webgl");

      if (gl && gl instanceof WebGLRenderingContext) {
        console.log("WebGL supported, using WebGL rendering");
        return "webgl";
      } else {
        console.log("WebGL not supported, falling back to Canvas 2D");
        return "canvas";
      }
    } catch (error) {
      console.warn("WebGL detection failed, using Canvas 2D fallback:", error);
      return "canvas";
    }
  }, []);

  const render = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const canvas = elementRef.current;
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
        particle.renderToCanvas(ctx);
      });

      // Draw orbiting orbs
      const orbColors = [
        { r: 200, g: 200, b: 255 }, // Blue
        { r: 200, g: 200, b: 255 }, // Blue
      ];

      currentOrbPositions.forEach((pos, index) => {
        const color = orbColors[index];
        const sideOrb = new SideOrb(pos, around, color);
        sideOrb.renderToCanvas(ctx, canvas);
      });

      // Draw main gravity orb
      const middleOrb = new MiddleOrb(
        frontToBack,
        mainOrbColor,
        currentOrbYPixels
      );
      middleOrb.renderToCanvas(ctx, canvas);
      middleOrb.renderBackgroundGlowToCanvas(
        ctx,
        around,
        canvas,
        currentOrbYPixels
      );

      // Reset canvas state
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    },
    [lastSentOrientationRef, elementRef]
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

      // Spawn new particles - enhanced rates for WebGL performance
      const isWebGL = renderingMode === "webgl";
      const baseSpawnChance = isWebGL ? 0.8 : 0.4; // Higher spawn rate for WebGL
      const beatBoost = beatPulse * (isWebGL ? 3.0 : 2.0); // Enhanced beat boost for WebGL
      const shouldSpawn = Math.random() < baseSpawnChance + beatBoost;
      const maxParticles = isWebGL
        ? beatPulse > 0.5
          ? 500
          : 300 // Much higher limits for WebGL
        : beatPulse > 0.5
        ? 200
        : 100; // Original limits for canvas

      if (shouldSpawn && particles.size < maxParticles) {
        // For WebGL, potentially spawn from multiple orbs in one frame
        const orbsToSpawnFrom =
          isWebGL && Math.random() < 0.4
            ? currentOrbPositions // Spawn from all orbs simultaneously
            : [
                currentOrbPositions[
                  Math.floor(Math.random() * currentOrbPositions.length)
                ],
              ]; // Single orb

        for (const sourceOrb of orbsToSpawnFrom) {
          if (particles.size >= maxParticles) break; // Check limit for each spawn

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

          // Enhanced comet particle with velocity-based properties
          const velocityMagnitude = Math.sqrt(
            (Math.cos(angle) * radialSpeed) ** 2 +
              (Math.sin(angle) * radialSpeed) ** 2
          );

          // Create different types of comet particles
          const isMainComet = Math.random() < 0.3; // 30% chance of being a main comet
          const cometSize = isMainComet
            ? PARTICLE_APPEARANCE.SIZE_MIN * 1.5 +
              Math.random() * PARTICLE_APPEARANCE.SIZE_RANGE * 1.5 +
              velocityMagnitude * 0.4
            : PARTICLE_APPEARANCE.SIZE_MIN +
              Math.random() * PARTICLE_APPEARANCE.SIZE_RANGE * 0.8 +
              velocityMagnitude * 0.2;

          // Comet life varies - larger comets live longer
          const cometLife = isMainComet
            ? PARTICLE_APPEARANCE.LIFE_MIN * 1.5 +
              Math.random() * PARTICLE_APPEARANCE.LIFE_RANGE * 1.2
            : PARTICLE_APPEARANCE.LIFE_MIN +
              Math.random() * PARTICLE_APPEARANCE.LIFE_RANGE;

          // Add slight velocity variation for more natural comet behavior
          const velocityVariation = (Math.random() - 0.5) * 0.3;
          const cometVx =
            Math.cos(angle) * radialSpeed * (1 + velocityVariation);
          const cometVy =
            Math.sin(angle) * radialSpeed * (1 + velocityVariation);

          const newParticle = new Particle(
            particleIdRef.current++,
            sourceOrb.x + (Math.random() - 0.5) * 20, // x - more spread for comet field
            sourceOrb.y + (Math.random() - 0.5) * 20, // y
            cometVx, // vx with variation
            cometVy, // vy with variation
            cometLife, // life
            cometLife, // maxLife
            cometSize, // size
            baseColor, // color
            sourceOrb // linkedOrb
          );

          particles.add(newParticle);

          // For WebGL, spawn additional particles per frame for denser particle fields
          if (isWebGL && Math.random() < 0.6 && particles.size < maxParticles) {
            // Create a second particle with slight variation
            const secondAngle = angle + (Math.random() - 0.5) * 0.5; // Small angle variation
            const secondSpeed = radialSpeed * (0.8 + Math.random() * 0.4); // Speed variation

            const secondParticle = new Particle(
              particleIdRef.current++,
              sourceOrb.x + (Math.random() - 0.5) * 25, // More spread
              sourceOrb.y + (Math.random() - 0.5) * 25,
              Math.cos(secondAngle) * secondSpeed,
              Math.sin(secondAngle) * secondSpeed,
              cometLife * (0.7 + Math.random() * 0.6), // Life variation
              cometLife * (0.7 + Math.random() * 0.6),
              cometSize * (0.6 + Math.random() * 0.8), // Size variation
              baseColor,
              sourceOrb
            );
            particles.add(secondParticle);
          }

          // During strong beats, spawn multiple particles at once for burst effect
          if (beatPulse > PARTICLE_SPAWNING.BURST_THRESHOLD) {
            const burstCount = isWebGL
              ? PARTICLE_SPAWNING.BURST_COUNT * 3
              : PARTICLE_SPAWNING.BURST_COUNT; // Triple bursts for WebGL
            for (let burst = 0; burst < burstCount; burst++) {
              // Enhanced burst effects for WebGL
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
        } // Close the for loop
      }
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(interval);
  }, [lastSentOrientationRef, pulsing, renderingMode]);

  // Cache shader programs for performance
  const shaderProgramRef = useRef<WebGLProgram | null>(null);
  const lineShaderProgramRef = useRef<WebGLProgram | null>(null);

  const renderWebGL = useCallback(
    (gl: WebGLRenderingContext) => {
      const canvas = elementRef.current;
      if (!canvas) return;

      // Create shader programs once and cache them
      if (!shaderProgramRef.current) {
        shaderProgramRef.current = createShaderProgram(
          gl,
          VERTEX_SHADER_SOURCE,
          FRAGMENT_SHADER_SOURCE
        );
      }

      if (!lineShaderProgramRef.current) {
        lineShaderProgramRef.current = createShaderProgram(
          gl,
          LINE_VERTEX_SHADER_SOURCE,
          LINE_FRAGMENT_SHADER_SOURCE
        );
      }

      const program = shaderProgramRef.current;
      const lineProgram = lineShaderProgramRef.current;
      if (!program || !lineProgram) return;
      const { frontToBack, around } = lastSentOrientationRef.current;

      // Clear WebGL canvas
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);

      // Use additive blending for particles to create impressive glow effects
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      // Use shader program
      gl.useProgram(program);

      // Set resolution uniform
      const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

      // Calculate current orb positions and colors (same as canvas version)
      const orbsGroupDiameter =
        ORB_SETTINGS.ORBIT_RADIUS * 2 + 64 + ORB_SETTINGS.MAIN_ORB_RADIUS * 2;
      const yMin = orbsGroupDiameter / 2;
      const yMax = window.innerHeight - yMin;
      const currentOrbYPercent = Math.max(0, Math.min(100, frontToBack));
      const currentOrbYPixels =
        (currentOrbYPercent / 100) * (yMax - yMin) + yMin;

      // Calculate orb positions and colors (same as canvas version)
      const colorLerpFactor = frontToBack / 100;
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

      const brightnessBoost = (around / 100) * 80;
      const mainOrbColor = {
        r: Math.min(255, baseMainOrbColor.r + brightnessBoost),
        g: Math.min(255, baseMainOrbColor.g + brightnessBoost),
        b: Math.min(255, baseMainOrbColor.b + brightnessBoost),
      };

      // Calculate satellite orb positions
      const orbitRadius = ORB_SETTINGS.ORBIT_RADIUS;
      const alpha = lastSentOrientationRef.current.alpha;
      const alphaRadians = alpha !== null ? (alpha * Math.PI) / 180 : 0;
      const baseAngles = [0, Math.PI];
      const currentOrbPositions = baseAngles.map((baseAngle) => {
        const finalAngle = baseAngle + alphaRadians;
        return {
          x: 32 + orbitRadius * Math.cos(finalAngle),
          y: currentOrbYPixels + orbitRadius * Math.sin(finalAngle),
        };
      });

      // Render particle connection lines using WebGL
      if (RENDER_LINES) {
        particlesRef.current.forEach((particle) => {
          particle.renderConnectionLineToWebGL(
            gl,
            program,
            canvas.width,
            canvas.height
          );
        });
      }

      // Render velocity-based trail streaks with line shader
      gl.useProgram(lineProgram);
      const lineResolutionLocation = gl.getUniformLocation(
        lineProgram,
        "u_resolution"
      );
      gl.uniform2f(lineResolutionLocation, canvas.width, canvas.height);

      particlesRef.current.forEach((particle) => {
        particle.renderTrailStreakToWebGL(
          gl,
          lineProgram,
          canvas.width,
          canvas.height
        );
      });

      // Switch back to particle shader for main particles
      gl.useProgram(program);
      const particleResolutionLocation = gl.getUniformLocation(
        program,
        "u_resolution"
      );
      gl.uniform2f(particleResolutionLocation, canvas.width, canvas.height);

      // Render particles using WebGL
      particlesRef.current.forEach((particle) => {
        particle.renderToWebGL(gl, program, canvas.width, canvas.height);
      });

      // Render satellite orbs using WebGL
      const orbColors = [
        { r: 200, g: 200, b: 255 }, // Blue
        { r: 200, g: 200, b: 255 }, // Blue
      ];

      currentOrbPositions.forEach((pos, index) => {
        const color = orbColors[index];
        const sideOrb = new SideOrb(pos, around, color);
        sideOrb.renderToWebGL(gl, program, canvas.width, canvas.height);
      });

      // Create and render main orb
      const middleOrb = new MiddleOrb(
        frontToBack,
        mainOrbColor,
        currentOrbYPixels
      );
      middleOrb.renderToWebGL(gl, program, canvas.width, canvas.height);
    },
    [lastSentOrientationRef, elementRef]
  );

  // WebGL rendering loop
  useEffect(() => {
    if (renderingMode !== "webgl" || !renderWebGL) return;

    const canvasElement = elementRef.current;
    if (!canvasElement) return;

    const gl =
      canvasElement.getContext("webgl") ||
      canvasElement.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext)) return;

    let animationFrameId: number;

    const renderLoop = () => {
      renderWebGL(gl);
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [elementRef, renderWebGL, renderingMode]);

  // Canvas 2D rendering loop (fallback)
  useEffect(() => {
    if (renderingMode !== "canvas") return;

    const canvasElement = elementRef.current;
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
  }, [elementRef, render, renderingMode]);

  // Canvas setup and resize handling
  useEffect(() => {
    const canvas = elementRef.current;
    if (!canvas) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      if (renderingMode === "webgl") {
        const gl =
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl && gl instanceof WebGLRenderingContext) {
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Canvas 2D optimizations (only if using canvas fallback)
    if (renderingMode === "canvas") {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [elementRef, renderingMode]);

  return (
    <>
      <canvas
        ref={elementRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />
    </>
  );
}
