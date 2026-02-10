type VisualsState = {
  mouseX: number;
  mouseY: number;
  mouseNormX: number; // 0-1
  mouseNormY: number; // 0-1
  cliffordPoints: Array<{ x: number; y: number; age: number }>;
  attractorX: number;
  attractorY: number;
  params: {
    a: number;
    b: number;
    c: number;
    d: number;
  };
  maxPoints: number;
  iterationsPerFrame: number;
};

/**
 * Starts the visuals on the provided HTML Element.
 * Returns a cleanup function to stop the animation and remove listeners.
 */
export function mountVisuals(
  container: HTMLElement,
  width: number,
  height: number
) {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  let frameCount = 0;
  let animationFrameId: number;

  const state: VisualsState = {
    mouseX: 0,
    mouseY: 0,
    mouseNormX: 0.5,
    mouseNormY: 0.5,
    cliffordPoints: [],
    attractorX: 0,
    attractorY: 0,
    params: {
      a: -1.4,
      b: 1.6,
      c: 1.0,
      d: 0.7,
    },
    maxPoints: 10000,
    iterationsPerFrame: 10000,
  };

  // Mouse event handlers
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = e.clientX - rect.left;
    state.mouseY = e.clientY - rect.top;
    state.mouseNormX = state.mouseX / width;
    state.mouseNormY = state.mouseY / height;

    // Update Clifford attractor parameters based on mouse position
    updateAttractorParams(state);
  };

  const onMouseLeave = () => {
    // Reset to center when mouse leaves
    state.mouseNormX = 0.5;
    state.mouseNormY = 0.5;
    updateAttractorParams(state);
  };

  function updateAttractorParams(state: VisualsState) {
    // Map mouse position to attractor parameters
    // Smooth interpolation for natural movement
    const targetA = -2.5 + state.mouseNormX * 2.0; // Range: -2.5 to -0.5
    const targetB = 0.5 + state.mouseNormY * 2.0; // Range: 0.5 to 2.5
    const targetC = 0.5 + state.mouseNormX * 1.0; // Range: 0.5 to 1.5
    const targetD = 0.3 + state.mouseNormY * 0.8; // Range: 0.3 to 1.1

    // Smooth interpolation for fluid movement
    const lerp = 0.02;
    state.params.a += (targetA - state.params.a) * lerp;
    state.params.b += (targetB - state.params.b) * lerp;
    state.params.c += (targetC - state.params.c) * lerp;
    state.params.d += (targetD - state.params.d) * lerp;
  }

  function generateCliffordPoints(state: VisualsState) {
    const { params } = state;
    let x = state.attractorX;
    let y = state.attractorY;

    for (let i = 0; i < state.iterationsPerFrame; i++) {
      // Clifford attractor equations
      const newX = Math.sin(params.a * y) + params.c * Math.cos(params.a * x);
      const newY = Math.sin(params.b * x) + params.d * Math.cos(params.b * y);

      x = newX;
      y = newY;

      // Add point to collection
      state.cliffordPoints.push({
        x,
        y,
        age: 0,
      });
    }

    // Update state
    state.attractorX = x;
    state.attractorY = y;

    // Remove old points to maintain performance
    if (state.cliffordPoints.length > state.maxPoints) {
      state.cliffordPoints.splice(
        0,
        state.cliffordPoints.length - state.maxPoints
      );
    }

    // Age existing points
    state.cliffordPoints.forEach((point) => point.age++);
  }

  function setup() {
    // Initialize canvas
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    // Add mouse event listeners
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
  }

  function draw() {
    // Clear canvas with fade effect for trails
    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    ctx.fillRect(0, 0, width, height);

    // Generate new points
    generateCliffordPoints(state);

    // Draw attractor points
    drawCliffordAttractor(state);

    // Draw mouse indicator (optional)
    drawMouseIndicator(state);
  }

  function drawCliffordAttractor(state: VisualsState) {
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) * 0.15; // Scale factor for visibility

    ctx.save();

    // Use batch drawing for performance
    ctx.beginPath();

    state.cliffordPoints.forEach((point, index) => {
      const screenX = centerX + point.x * scale;
      const screenY = centerY + point.y * scale;

      // Calculate alpha based on age (newer points are more visible)
      const maxAge = 200;
      const alpha = Math.max(0, 1 - point.age / maxAge);

      if (alpha > 0) {
        // Color based on position for visual interest
        const hue = ((point.x + point.y + 2) * 60) % 360;
        const saturation = 60 + alpha * 40;
        const lightness = 40 + alpha * 40;

        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha * 0.8})`;

        // Small circles for each point
        ctx.beginPath();
        ctx.arc(screenX, screenY, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  }

  function drawMouseIndicator(state: VisualsState) {
    if (state.mouseX > 0 && state.mouseY > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(state.mouseX, state.mouseY, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- RUNTIME ---

  const onResize = () => {
    // width = container.clientWidth;
    // height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
  };

  window.addEventListener("resize", onResize);

  // Set initial size
  onResize();

  // Initialize
  setup();

  // Animation Loop
  const animate = () => {
    frameCount++;
    draw();
    animationFrameId = requestAnimationFrame(animate);
  };

  // Return cleanup function for the module consumer
  return {
    state,
    start: animate,
    onResize,
    stop: () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      container.removeChild(canvas);
    },
  };
}
