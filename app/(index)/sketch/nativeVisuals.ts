import { ToneControls } from "../tone";
import { VisitorPosition, VisualsInterface } from "./VisualsInterface";

type Circle = {
  personId: number;
  x: number;
  y: number;
  normalizedX: number; // 0-1
  normalizedY: number; // 0-1
  targetX: number;
  targetY: number;
  radius: number;
  baseRadius: number;
  targetRadius: number;
  handsRaised: boolean;
  targetHandsRaised: boolean;
  color: string;
  isActive: boolean; // Whether this person is currently present
};

type VisualsState = {
  circles: Circle[];
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
export function getVisuals(
  container: HTMLElement,
  width: number,
  height: number,
  toneControls: ToneControls
): VisualsInterface<VisualsState> {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  let animationFrameId: number;

  // Position coordinate system bounds
  const POSITION_MAX_X = 3.5;
  const POSITION_MAX_Y = 3;

  // Create circle for a person
  function createCircle(personId: number): Circle {
    const hue = (personId * 137.5) % 360; // Golden angle for good color distribution
    return {
      personId,
      x: width * 0.5, // Start in center
      y: height * 0.5,
      normalizedX: 0.5,
      normalizedY: 0.5,
      targetX: width * 0.5,
      targetY: height * 0.5,
      radius: 25,
      baseRadius: 25,
      targetRadius: 25,
      handsRaised: false,
      targetHandsRaised: false,
      color: `hsl(${hue}, 70%, 60%)`,
      isActive: false,
    };
  }

  const state: VisualsState = {
    circles: [],
    cliffordPoints: [],
    attractorX: 0,
    attractorY: 0,
    params: {
      a: -1.4,
      b: 1.6,
      c: 1.0,
      d: 0.7,
    },
    maxPoints: 2000,
    iterationsPerFrame: 10,
  };

  // check if circle positions are < 200 px apart,
  // in which case play blip
  function onVisitorsContact() {
    const threshold = 200;
    for (let i = 0; i < state.circles.length; i++) {
      for (let j = i + 1; j < state.circles.length; j++) {
        const c1 = state.circles[i];
        const c2 = state.circles[j];
        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < threshold) {
          console.log("contact!");
          toneControls.emit("proximity", distance);
          return; // Only trigger one blip per frame
        }
      }
    }
  }

  // Update people positions from external data
  function onPositionsUpdate(positions: VisitorPosition[]) {
    // Mark all circles as inactive initially
    state.circles.forEach((circle) => {
      circle.isActive = false;
    });

    positions.forEach((position) => {
      let circle = state.circles.find((c) => c.personId === position.personId);

      // Create new circle if person doesn't exist
      if (!circle) {
        circle = createCircle(position.personId);
        state.circles.push(circle);
      }

      // Mark as active and update targets
      circle.isActive = true;
      // Map coordinates: x from [0, POSITION_MAX_X] to [0, width], y from [0, POSITION_MAX_Y] to [height, 0]
      circle.targetX = (position.x / POSITION_MAX_X) * width;
      circle.targetY = height - (position.y / POSITION_MAX_Y) * height;
      circle.targetHandsRaised = position.handsRaised;
    });

    // Remove circles for people who are no longer present
    state.circles = state.circles.filter((circle) => circle.isActive);
  }

  function updateCircleProperties() {
    state.circles.forEach((circle) => {
      // Smooth position interpolation
      const posLerp = 0.05; // Adjust for responsiveness vs smoothness
      circle.x += (circle.targetX - circle.x) * posLerp;
      circle.y += (circle.targetY - circle.y) * posLerp;

      // Update normalized positions
      circle.normalizedX = circle.x / width;
      circle.normalizedY = circle.y / height;

      // Smooth hands raised state
      const currentHandsRaised = circle.handsRaised;
      const targetHandsRaised = circle.targetHandsRaised;

      // Update hands raised state (for size calculation)
      if (targetHandsRaised !== currentHandsRaised) {
        circle.handsRaised = targetHandsRaised;
      }

      // Calculate target radius based on hands raised
      circle.targetRadius = circle.handsRaised
        ? circle.baseRadius * 2
        : circle.baseRadius;

      // Smooth radius interpolation
      const sizeLerp = 0.08; // Slightly faster for size changes
      circle.radius += (circle.targetRadius - circle.radius) * sizeLerp;
    });
  }

  function updateAttractorParams(state: VisualsState) {
    // Calculate average influence from all circles with weighted contribution
    let totalInfluenceX = 0;
    let totalInfluenceY = 0;
    let totalWeight = 0;

    state.circles.forEach((circle) => {
      // Weight circles by their radius (larger circles have more influence)
      const weight = circle.radius / 50; // Normalize radius to weight
      totalInfluenceX += circle.normalizedX * weight;
      totalInfluenceY += circle.normalizedY * weight;
      totalWeight += weight;
    });

    // Use defaults if no circles
    const avgInfluenceX = totalWeight > 0 ? totalInfluenceX / totalWeight : 0.5;
    const avgInfluenceY = totalWeight > 0 ? totalInfluenceY / totalWeight : 0.5;

    // Map average circle positions to attractor parameters
    const targetA = -2.5 + avgInfluenceX * 2.0; // Range: -2.5 to -0.5
    const targetB = 0.5 + avgInfluenceY * 2.0; // Range: 0.5 to 2.5
    const targetC = 0.5 + avgInfluenceX * 1.0; // Range: 0.5 to 1.5
    const targetD = 0.3 + avgInfluenceY * 0.8; // Range: 0.3 to 1.1

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
  }

  function draw() {
    // Clear canvas with fade effect for trails
    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    ctx.fillRect(0, 0, width, height);

    // Update circle properties
    updateCircleProperties();

    // Update attractor parameters based on circle positions
    updateAttractorParams(state);

    // Generate new points
    generateCliffordPoints(state);

    // Draw attractor points
    drawCliffordAttractor(state);

    // Draw circles
    drawCircles(state);

    // Check for visitor contact and trigger event
    onVisitorsContact();
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

  function drawCircles(state: VisualsState) {
    ctx.save();

    state.circles.forEach((circle) => {
      const isEnlarged = circle.radius > circle.baseRadius + 1;

      if (isEnlarged) {
        // Draw filled circle when hands raised (enlarged)
        ctx.fillStyle = circle.color;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Always draw circle outline
      ctx.strokeStyle = circle.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.restore();
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
    draw();
    animationFrameId = requestAnimationFrame(animate);
  };

  // Return cleanup function for the module consumer
  return {
    state,
    onResize,
    onPositionsUpdate, // Expose function to update positions
    start: animate,
    stop: () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      container.removeChild(canvas);
    },
  };
}
