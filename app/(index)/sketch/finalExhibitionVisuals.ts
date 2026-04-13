import { ToneControls } from "../tone";
import { VisitorPosition, VisualsInterface } from "./VisualsInterface";

type Circle = {
  personId: number;
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  targetX: number;
  targetY: number;
  radius: number;
  baseRadius: number;
  targetRadius: number;
  handsRaised: boolean;
  targetHandsRaised: boolean;
  color: string;
  isActive: boolean;
  hitCount: number; // New: tracks attractor particle collisions
};

type VisualsState = {
  circles: Circle[];
  cliffordPoints: Array<{
    x: number;
    y: number;
    age: number;
    px: number;
    py: number;
  }>;
  params: { a: number; b: number; c: number; d: number; targetD: number };
  entropyGrid: boolean[];
  entropyLevel: number;
  resonanceSlices: number[]; // Density per vertical column
  centroid: { x: number; y: number };
  lastSideMatrix: boolean[][];
};

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

  const ctx = canvas.getContext("2d")!;
  container.appendChild(canvas);

  // Constants from original logic
  const ITERATIONS_PER_FRAME = 10000;
  const G_STRENGTH = 0.15;
  const SOFTENING = 0.0002;
  const ENTROPY_RES = 30;
  const SLICE_COUNT = 6;

  const state: VisualsState = {
    circles: [],
    cliffordPoints: [],
    params: { a: 1.5, b: -1.8, c: 1.2, d: 0.9, targetD: 0.9 },
    entropyGrid: new Array(ENTROPY_RES * ENTROPY_RES).fill(false),
    entropyLevel: 0,
    resonanceSlices: new Array(SLICE_COUNT).fill(0),
    centroid: { x: 0, y: 0 },
    lastSideMatrix: [],
  };

  let xn = 0.1,
    yn = 0.1; // Attractor internal state

  function createCircle(personId: number): Circle {
    return {
      personId,
      x: width / 2,
      y: height / 2,
      normalizedX: 0.5,
      normalizedY: 0.5,
      targetX: width / 2,
      targetY: height / 2,
      radius: 40,
      baseRadius: 40,
      targetRadius: 40,
      handsRaised: false,
      targetHandsRaised: false,
      color: `white`,
      isActive: true,
      hitCount: 0,
    };
  }

  // Inside the draw() loop of getVisuals
  function updateProximityState() {
    const proximityMap: Record<string, number> = {};

    for (let i = 0; i < state.circles.length; i++) {
      for (let j = i + 1; j < state.circles.length; j++) {
        const v1 = state.circles[i];
        const v2 = state.circles[j];
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Use a unique key for the pair to track them in the sound module
        const pairId = `${v1.personId}-${v2.personId}`;
        proximityMap[pairId] = distance;
      }
    }

    // Emit the full map every frame
    toneControls.emit("proximityMapUpdate", proximityMap);
  }

  function runAttractorLogic() {
    state.cliffordPoints = [];
    state.entropyGrid.fill(false);
    state.resonanceSlices.fill(0);
    state.circles.forEach((c) => (c.hitCount = 0));

    let sumX = 0,
      sumY = 0;
    const { a, b, c, d } = state.params;

    for (let i = 0; i < ITERATIONS_PER_FRAME; i++) {
      // 1. Basic Clifford Math
      let nextX = Math.sin(a * yn) + c * Math.cos(a * xn);
      let nextY = Math.sin(b * xn) + d * Math.cos(b * yn);

      // 2. Gravitational Pull from Visitors
      state.circles.forEach((circle) => {
        // Map circle to attractor space (-3 to 3)
        const vax = (circle.x / width) * 6 - 3;
        const vay = (circle.y / height) * 7 - 3.5;
        const dx = vax - nextX;
        const dy = vay - nextY;
        const distSq = dx * dx + dy * dy + SOFTENING;

        nextX += (dx / distSq) * G_STRENGTH;
        nextY += (dy / distSq) * G_STRENGTH;

        // Collision detection (Screen Space)
        const px = ((nextX + 4) / 8) * width;
        const py = ((nextY + 4) / 8) * height;
        const pdx = circle.x - px;
        const pdy = circle.y - py;
        if (pdx * pdx + pdy * pdy < circle.radius * circle.radius) {
          circle.hitCount++;
        }
      });

      xn = nextX;
      yn = nextY;

      // Map to pixels for drawing and slices
      const px = ((xn + 4) / 8) * width;
      const py = ((yn + 4) / 8) * height;

      // Entropy Grid
      const gx = Math.floor((px / width) * (ENTROPY_RES - 1));
      const gy = Math.floor((py / height) * (ENTROPY_RES - 1));
      if (gx >= 0 && gx < ENTROPY_RES && gy >= 0 && gy < ENTROPY_RES) {
        state.entropyGrid[gx + gy * ENTROPY_RES] = true;
      }

      // Resonance Slices
      const sliceIdx = Math.floor((px / width) * SLICE_COUNT);
      if (sliceIdx >= 0 && sliceIdx < SLICE_COUNT)
        state.resonanceSlices[sliceIdx]++;

      sumX += px;
      sumY += py;

      // Store subset of points for rendering trails
      if (i % 5 === 0) {
        state.cliffordPoints.push({ x: xn, y: yn, age: 0, px, py });
      }
    }

    state.centroid = {
      x: sumX / ITERATIONS_PER_FRAME,
      y: sumY / ITERATIONS_PER_FRAME,
    };
    const occupied = state.entropyGrid.filter((v) => v).length;
    state.entropyLevel = occupied / (ENTROPY_RES * ENTROPY_RES);
  }

  function emitAudioEvents() {
    // Entropy / Ambient updates
    toneControls.emit("entropyUpdate", state.entropyLevel);
    toneControls.emit("centroidMove", state.centroid.x);

    // Visitor Collision Sound
    state.circles.forEach((circle, i) => {
      if (circle.hitCount > 5) {
        toneControls.emit("visitorHeat", {
          id: circle.personId,
          intensity: circle.hitCount,
        });
      }
    });

    // Resonance Slice Pads
    state.resonanceSlices.forEach((density, i) => {
      if (density > ITERATIONS_PER_FRAME * 0.05) {
        toneControls.emit("sliceActive", { index: i, density });
      }
    });

    // Poem Trigger (Centroid crossing line between visitors)
    handleCentroidCrossing();
  }

  function handleCentroidCrossing() {
    for (let i = 0; i < state.circles.length; i++) {
      for (let j = i + 1; j < state.circles.length; j++) {
        const v1 = state.circles[i];
        const v2 = state.circles[j];

        const sideVal =
          (state.centroid.x - v1.x) * (v2.y - v1.y) -
          (state.centroid.y - v1.y) * (v2.x - v1.x);
        const currentSide = sideVal > 0;

        if (!state.lastSideMatrix[i]) state.lastSideMatrix[i] = [];
        if (currentSide !== state.lastSideMatrix[i][j]) {
          toneControls.emit("poemTrigger", {
            pair: [v1.personId, v2.personId],
          });
        }
        state.lastSideMatrix[i][j] = currentSide;
      }
    }
  }

  function draw() {
    // Trail effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, 0, width, height);

    // 1. Update Params
    state.params.d =
      state.params.d + (state.params.targetD - state.params.d) * 0.02;

    // Update circle positions smoothly
    state.circles.forEach((circle) => {
      const lerpFactor = 0.08; // Adjust this value to control smoothness (0.02-0.2 range)
      circle.x = circle.x + (circle.targetX - circle.x) * lerpFactor;
      circle.y = circle.y + (circle.targetY - circle.y) * lerpFactor;
    });

    // 2. Physics & Logic
    updateProximityState();
    runAttractorLogic();
    emitAudioEvents();

    // 3. Render Attractor
    ctx.beginPath();
    state.cliffordPoints.forEach((p) => {
      ctx.fillStyle =
        state.entropyLevel < 0.05
          ? "rgba(100, 100, 255, 0.5)"
          : "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(p.px, p.py, 1.5, 1.5);
    });

    // 4. Render Visitors
    state.circles.forEach((c) => {
      ctx.strokeStyle = c.handsRaised ? "yellow" : "white";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (c.hitCount > 5) {
        ctx.fillStyle = c.handsRaised
          ? "rgba(255, 255, 0, 0.3)"
          : "rgba(255, 255, 255, 0.2)";
        ctx.fill();
      }
    });
  }

  // --- External Interface Implementation ---
  const onPositionsUpdate = (positions: VisitorPosition[]) => {
    state.circles.forEach((c) => (c.isActive = false));

    let anyHands = false;
    positions.forEach((pos) => {
      let circle = state.circles.find((c) => c.personId === pos.personId);
      if (!circle) {
        circle = createCircle(pos.personId);
        state.circles.push(circle);
      }
      circle.isActive = true;
      circle.targetX = (pos.x / 3) * width; // Floor map scale
      circle.targetY = height - (pos.y / 3.5) * height;
      circle.handsRaised = pos.handsRaised;
      if (pos.handsRaised) anyHands = true;
    });

    state.params.targetD = anyHands ? 2.0 : 0.9;
    state.circles = state.circles.filter((c) => c.isActive);
  };

  let animationId: number;
  const start = () => {
    draw();
    animationId = requestAnimationFrame(start);
  };

  const onResize = () => {
    // width = container.clientWidth;
    // height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
  };

  window.addEventListener("resize", onResize);

  // Set initial size
  onResize();

  return {
    state,
    onPositionsUpdate,
    onResize,
    start,
    stop: () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      container.removeChild(canvas);
    },
  };
}
