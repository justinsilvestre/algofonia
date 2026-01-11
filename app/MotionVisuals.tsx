import { useRef, useEffect, useCallback, useMemo } from "react";

const Y_MIN_OFFSET = 75; // Pixels to offset minimum Y position for orbs

// Visual element classes
class MiddleOrb {
  constructor(
    private frontToBack: number,
    private mainOrbColor: { r: number; g: number; b: number },
    private currentOrbYPixels: number
  ) {}

  renderToCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    beatPulse = 0
  ) {
    // Apply warping based on beat pulse
    const warpFactor = beatPulse * 0.3; // 0-0.3 warping strength
    const mainOrbRadius = ORB_SETTINGS.MAIN_ORB_RADIUS * (1 + warpFactor);
    const orbCenterX = canvas.width / 2;
    const orbCenterY = this.currentOrbYPixels;
    const glowRadius = 80 * (1 + warpFactor * 1.5); // Glow expands more dramatically

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

    // Draw main orb on top with warping effect
    ctx.fillStyle = mainOrbColorString;
    ctx.beginPath();

    if (warpFactor > 0.05) {
      // Draw warped elliptical orb during beats
      ctx.save();
      ctx.translate(orbCenterX, orbCenterY);
      ctx.scale(1 + warpFactor * 0.5, 1 - warpFactor * 0.3); // Stretch horizontally, compress vertically
      ctx.arc(0, 0, mainOrbRadius, 0, Math.PI * 2);
      ctx.restore();
    } else {
      // Normal circular orb
      ctx.arc(orbCenterX, orbCenterY, mainOrbRadius, 0, Math.PI * 2);
    }
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
    beatPulse = 0
  ) {
    // Get attribute locations
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const sizeLocation = gl.getAttribLocation(program, "a_size");
    const colorLocation = gl.getAttribLocation(program, "a_color");

    if (positionLocation === -1 || sizeLocation === -1 || colorLocation === -1)
      return;

    // Calculate orb position
    const orbX = window.innerWidth / 2;
    const orbY = this.currentOrbYPixels;

    // Convert RGB to normalized values
    const r = this.mainOrbColor.r / 255;
    const g = this.mainOrbColor.g / 255;
    const b = this.mainOrbColor.b / 255;
    const a = 1.0;

    // Apply warping to size based on beat pulse
    const warpFactor = beatPulse * 0.3;
    const warpedSize =
      ORB_SETTINGS.MAIN_ORB_RADIUS * 2 * 2.0 * (1 + warpFactor);

    // Set up vertex data with warped size for WebGL
    const positions = new Float32Array([orbX, orbY]);
    const sizes = new Float32Array([warpedSize]);
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

  renderToCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    beatPulse = 0
  ) {
    const opacity = Math.max(
      ORB_SETTINGS.OPACITY_MIN,
      Math.min(1.0, this.around / 100)
    );
    // Apply warping to satellite orbs
    const warpFactor = beatPulse * 0.4; // Stronger warping for smaller orbs
    const orbRadius = ORB_SETTINGS.SATELLITE_ORB_RADIUS * (1 + warpFactor);
    const baseGlow = 8 * (1 + warpFactor);

    const orbX = canvas.width / 2 - 32 + this.pos.x;
    const orbY = this.pos.y;

    ctx.shadowColor = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
    ctx.shadowBlur = baseGlow;
    ctx.globalAlpha = opacity;

    ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
    ctx.beginPath();

    if (warpFactor > 0.05) {
      // Draw warped satellite orb during beats
      ctx.save();
      ctx.translate(orbX, orbY);
      ctx.scale(1 - warpFactor * 0.3, 1 + warpFactor * 0.6); // Compress horizontally, stretch vertically (opposite of main orb)
      ctx.arc(0, 0, orbRadius, 0, Math.PI * 2);
      ctx.restore();
    } else {
      // Normal circular orb
      ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  renderToWebGL(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    beatPulse = 0
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
    const orbX = window.innerWidth / 2 - 32 + this.pos.x;
    const orbY = this.pos.y;

    // Convert RGB to normalized values
    const r = this.color.r / 255;
    const g = this.color.g / 255;
    const b = this.color.b / 255;
    const a = opacity;

    // Apply warping to satellite orb size
    const warpFactor = beatPulse * 0.4;
    const warpedSize =
      ORB_SETTINGS.SATELLITE_ORB_RADIUS * 2 * 1.8 * (1 + warpFactor);

    // Set up vertex data with warped size for WebGL
    const positions = new Float32Array([orbX, orbY]);
    const sizes = new Float32Array([warpedSize]);
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
  private nucleusGlow = 0; // Comet nucleus brightness

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

    // Update comet properties based on velocity
    this.nucleusGlow = Math.min(velocityIntensity * 1.5 + 0.3, 1.0);

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

    // Render main particle
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

  renderToWebGL(gl: WebGLRenderingContext, program: WebGLProgram) {
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
    program: WebGLProgram
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
  // WebGL optimized limits
  WEBGL_MAX_PARTICLES_NORMAL: 150, // Increased count for denser effects
  WEBGL_MAX_PARTICLES_BEAT: 250, // Higher count during beats
  WEBGL_BURST_COUNT: 5, // More burst particles
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
  SIZE_MIN: 3.0, // Increased minimum particle size
  SIZE_RANGE: 4.0, // Increased size range for bigger particles
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
      const yMin = orbsGroupDiameter / 2 - Y_MIN_OFFSET;
      const yMax = window.innerHeight - yMin;
      const currentOrbYPercent = Math.max(0, Math.min(100, frontToBack));
      const currentOrbYPixels =
        yMax - (currentOrbYPercent / 100) * (yMax - yMin);
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

      // Draw orbiting orbs with beat warping
      const orbColors = [
        { r: 200, g: 200, b: 255 }, // Blue
        { r: 200, g: 200, b: 255 }, // Blue
      ];

      currentOrbPositions.forEach((pos, index) => {
        const color = orbColors[index];
        const sideOrb = new SideOrb(pos, around, color);
        sideOrb.renderToCanvas(ctx, canvas, pulsing.current);
      });

      // Draw main gravity orb with beat warping
      const middleOrb = new MiddleOrb(
        frontToBack,
        mainOrbColor,
        currentOrbYPixels
      );
      middleOrb.renderToCanvas(ctx, canvas, pulsing.current);
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
    [lastSentOrientationRef, elementRef, pulsing]
  );

  // Particle system animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      const particles = particlesRef.current;
      const mainOrbCenterX = window.innerWidth / 2;
      const orbsGroupDiameter =
        ORB_SETTINGS.ORBIT_RADIUS * 2 + 64 + ORB_SETTINGS.MAIN_ORB_RADIUS * 2;
      const yMin = orbsGroupDiameter / 2 - Y_MIN_OFFSET;
      const orbYPercent = Math.max(
        0,
        Math.min(100, lastSentOrientationRef.current.frontToBack)
      );
      const orbYPixels =
        window.innerHeight -
        yMin -
        (orbYPercent / 100) * (window.innerHeight - yMin * 2);

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
      const isWebGL = renderingMode === "webgl";
      const baseSpawnChance = isWebGL ? 0.3 : 0.4; // Slightly increased for better visuals
      const beatBoost = beatPulse * (isWebGL ? 1.5 : 2.0); // Moderately increased beat boost
      const shouldSpawn = Math.random() < baseSpawnChance + beatBoost;
      const maxParticles = isWebGL
        ? beatPulse > 0.5
          ? PARTICLE_SPAWNING.WEBGL_MAX_PARTICLES_BEAT
          : PARTICLE_SPAWNING.WEBGL_MAX_PARTICLES_NORMAL
        : beatPulse > 0.5
          ? PARTICLE_SPAWNING.MAX_PARTICLES_BEAT
          : PARTICLE_SPAWNING.MAX_PARTICLES_NORMAL;

      if (shouldSpawn && particles.size < maxParticles) {
        // Simplified spawning for WebGL performance - single orb only
        const orbsToSpawnFrom = [
          currentOrbPositions[
            Math.floor(Math.random() * currentOrbPositions.length)
          ],
        ]; // Always single orb for better performance

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

          // Create different types of comet particles with larger sizes
          const isMainComet = Math.random() < 0.4; // Increased chance for main comets
          const cometSize = isMainComet
            ? PARTICLE_APPEARANCE.SIZE_MIN * 2.0 +
              Math.random() * PARTICLE_APPEARANCE.SIZE_RANGE * 2.0 +
              velocityMagnitude * 0.6
            : PARTICLE_APPEARANCE.SIZE_MIN +
              Math.random() * PARTICLE_APPEARANCE.SIZE_RANGE +
              velocityMagnitude * 0.4;

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

          // Skip secondary particle spawning for WebGL performance

          // During strong beats, spawn burst particles (reduced for WebGL)
          if (beatPulse > PARTICLE_SPAWNING.BURST_THRESHOLD) {
            const burstCount = isWebGL
              ? PARTICLE_SPAWNING.WEBGL_BURST_COUNT
              : PARTICLE_SPAWNING.BURST_COUNT;
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
                3 + Math.random() * 4, // size - larger burst particles for more impact
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

      const program = shaderProgramRef.current;
      if (!program) return;
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
      const yMin = orbsGroupDiameter / 2 - Y_MIN_OFFSET;
      const yMax = window.innerHeight - yMin;
      const currentOrbYPercent = Math.max(0, Math.min(100, frontToBack));
      const currentOrbYPixels =
        yMax - (currentOrbYPercent / 100) * (yMax - yMin);

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
          particle.renderConnectionLineToWebGL(gl, program);
        });
      }

      // Switch back to particle shader for main particles
      gl.useProgram(program);
      const particleResolutionLocation = gl.getUniformLocation(
        program,
        "u_resolution"
      );
      gl.uniform2f(particleResolutionLocation, canvas.width, canvas.height);

      // Batch render particles for better WebGL performance
      if (particlesRef.current.size > 0) {
        const positions: number[] = [];
        const sizes: number[] = [];
        const colors: number[] = [];

        particlesRef.current.forEach((particle) => {
          // Parse color once per particle
          const colorMatch = particle.color.match(
            /rgb\((\d+),\s*(\d+),\s*(\d+)\)/
          );
          if (colorMatch) {
            const r = parseInt(colorMatch[1]) / 255;
            const g = parseInt(colorMatch[2]) / 255;
            const b = parseInt(colorMatch[3]) / 255;
            const alpha = particle.life / particle.maxLife;
            // Main particle
            positions.push(particle.x, particle.y);
            sizes.push(particle.size);
            colors.push(r, g, b, alpha);
          }
        });

        if (positions.length > 0) {
          // Get attribute locations
          const positionLocation = gl.getAttribLocation(program, "a_position");
          const sizeLocation = gl.getAttribLocation(program, "a_size");
          const colorLocation = gl.getAttribLocation(program, "a_color");

          // Create single buffers for all particles
          const positionBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(positions),
            gl.STATIC_DRAW
          );
          gl.enableVertexAttribArray(positionLocation);
          gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

          const sizeBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(sizes),
            gl.STATIC_DRAW
          );
          gl.enableVertexAttribArray(sizeLocation);
          gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

          const colorBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(colors),
            gl.STATIC_DRAW
          );
          gl.enableVertexAttribArray(colorLocation);
          gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

          // Draw all particles at once
          gl.drawArrays(gl.POINTS, 0, positions.length / 2);

          // Clean up
          gl.deleteBuffer(positionBuffer);
          gl.deleteBuffer(sizeBuffer);
          gl.deleteBuffer(colorBuffer);
        }
      }

      // Render satellite orbs using WebGL
      const orbColors = [
        { r: 200, g: 200, b: 255 }, // Blue
        { r: 200, g: 200, b: 255 }, // Blue
      ];

      currentOrbPositions.forEach((pos, index) => {
        const color = orbColors[index];
        const sideOrb = new SideOrb(pos, around, color);
        sideOrb.renderToWebGL(gl, program, pulsing.current);
      });

      // Create and render main orb with beat warping
      const middleOrb = new MiddleOrb(
        frontToBack,
        mainOrbColor,
        currentOrbYPixels
      );
      middleOrb.renderToWebGL(gl, program, pulsing.current);
    },
    [lastSentOrientationRef, elementRef, pulsing]
  );

  // WebGL rendering loop - reduced to 30 FPS for performance
  useEffect(() => {
    if (renderingMode !== "webgl" || !renderWebGL) return;

    const canvasElement = elementRef.current;
    if (!canvasElement) return;

    const gl =
      canvasElement.getContext("webgl") ||
      canvasElement.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext)) return;

    let lastTime = 0;
    const targetFPS = 30; // Reduced FPS for better performance
    const frameInterval = 1000 / targetFPS;
    let animationFrameId: number;

    const renderLoop = (currentTime: number) => {
      if (currentTime - lastTime >= frameInterval) {
        renderWebGL(gl);
        lastTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop(0);

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
