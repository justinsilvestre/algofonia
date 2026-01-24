"use client";
/**
 * p5.js rewrite of Processing sketch. (positioncollider.pde)
 * - Visuals: same visitors/particles + glow connections + collision flashes
 * - Audio: uses p5.Oscillator (no Minim equivalent in p5 core)
 * - OSC: optional via osc-js (see notes at bottom)
 *
 *
 * Does not have OSC for now, but structure is there to add it if needed. See notes at bottom.
 *
 *
 * Controls:
 * - Click to enable audio in browser
 * - Left-click: move nearest visitor
 * - Right-click: add new visitor
 * - R key: randomize visitor positions
 * - Space key: reset particles
 */

import P5 from "p5";
import { ToneControls } from "./tone";

const visitors: Visitor[] = [];

// ---- AUDIO (p5.sound) ----
// let osc: P5.Oscillator;
// let env: P5.Envelope;

// ---- constants from original (kept for compatibility) ----
const aConst: number = -1.7;
const bConst: number = 1.3;
const cConst: number = -0.1;
const dConst: number = -1.2;

class Particle {
  p5: P5;
  position: P5.Vector;
  col: P5.Color;
  velocity: P5.Vector;
  dt: number;
  v: number;
  t: number;
  w: number;
  distToTarget: number;
  isAlive: boolean;
  collisionCooldown: number;

  constructor(p5: P5, x: number, y: number, col: P5.Color) {
    this.p5 = p5;
    this.position = p5.createVector(x, y);
    this.col = col;

    this.velocity = p5.createVector(0, 0);

    this.dt = p5.random(-0.01, 0.01);
    this.v = p5.random(0.8, 3);
    this.t = 0;
    this.w = 0.1;

    this.distToTarget = this._diagDist();
    this.isAlive = true;

    // cooldown to prevent buzzing
    this.collisionCooldown = 0;
  }

  _diagDist() {
    const { p5 } = this;
    // matches your original intent (though original uses sqrt(w^2 - h^2), which can be NaN if h>w)
    // we’ll use true diagonal for stability.
    return p5.sqrt(p5.width * p5.width + p5.height * p5.height);
  }

  update(direction: P5.Vector, target: P5.Vector) {
    const { p5 } = this;
    if (this.collisionCooldown > 0) this.collisionCooldown--;

    const x = p5.map(this.position.x, 0, p5.width, -3, 3);
    const y = p5.map(this.position.y, 0, p5.height, -3, 3);

    // map based on distance-to-target range
    const maxD = this._diagDist() + 0.01;
    this.w = p5.map(this.distToTarget, 0, maxD, 1.5, 0.005, true);

    const dx = -p5.sin(aConst * this.t) + cConst * p5.cos(aConst * this.t * x);
    const dy = -p5.sin(bConst * this.t) + dConst * p5.cos(bConst * this.t * y);

    this.position.x -= this.v * direction.x + dx * this.w;
    this.position.y -= this.v * direction.y + dy * this.w;

    this.t += this.dt;

    this.distToTarget = p5.dist(
      this.position.x,
      this.position.y,
      target.x,
      target.y
    );
    if (this.distToTarget < 45) this.isAlive = false;
  }

  draw() {
    const { p5 } = this;
    p5.noStroke();
    p5.fill(this.col);
    p5.circle(this.position.x, this.position.y, 4);
  }
}

class Visitor {
  p5: P5;
  position: P5.Vector;
  col: P5.Color;
  particles: Particle[];
  targetVisitor: Visitor | null;
  spawnTimer: number;
  spawnInterval: number;
  maxParticles: number;
  radius: number;

  constructor(p5: P5, x: number, y: number, col: P5.Color) {
    this.p5 = p5;
    this.position = p5.createVector(x, y);
    this.col = col;
    this.particles = [];
    this.targetVisitor = null;

    this.spawnTimer = 0;
    this.spawnInterval = 4;
    this.maxParticles = 20;
    this.radius = 12;
  }

  setTarget(v: Visitor): void {
    this.targetVisitor = v;
  }

  update(): void {
    this.spawnTimer++;
    if (
      this.spawnTimer >= this.spawnInterval &&
      this.particles.length < this.maxParticles
    ) {
      const angle = this.p5.random(this.p5.TWO_PI);
      const spawnX = this.position.x + this.radius * this.p5.cos(angle);
      const spawnY = this.position.y + this.radius * this.p5.sin(angle);
      this.particles.push(new Particle(this.p5, spawnX, spawnY, this.col));
      this.spawnTimer = 0;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.isAlive && this.targetVisitor) {
        const direction = this.p5.createVector(
          p.position.x - this.targetVisitor.position.x,
          p.position.y - this.targetVisitor.position.y
        );
        direction.normalize();
        p.update(direction, this.targetVisitor.position);
      }
      if (!p.isAlive) this.particles.splice(i, 1);
    }
  }

  draw() {
    this.p5.noStroke();
    this.p5.fill(255);
    this.p5.circle(this.position.x, this.position.y, 20);
    this.p5.fill(this.col);
    this.p5.circle(this.position.x, this.position.y, 10);

    for (const p of this.particles) p.draw();
  }
}

export function setup(p5: P5, parent: string | object | P5.Element): void {
  const canvas = p5.createCanvas(p5.windowWidth, p5.windowHeight);
  canvas.parent(parent);

  p5.background(0);

  // // Audio setup (requires p5.sound)
  // // We’ll use one oscillator + envelope per collision trigger.
  // osc = new P5.Oscillator("sine");
  // osc.amp(0);
  // osc.start();

  // env = new P5.Envelope();
  // env.setADSR(0.001, 0.08, 0.0, 0.15);
  // env.setRange(0.35, 0);

  // Start with two visitors
  visitors.push(
    new Visitor(p5, p5.width * 0.25, p5.height * 0.25, p5.color(255, 100, 100))
  );
  visitors.push(
    new Visitor(p5, p5.width * 0.75, p5.height * 0.75, p5.color(100, 100, 255))
  );

  updateVisitorTargets();

  // OPTIONAL: setup OSC (see notes below)
  // setupOSC();
}

export function draw(p5: P5, tone: ToneControls): void {
  p5.noStroke();
  p5.fill(0, 30);
  p5.rect(0, 0, p5.width, p5.height);

  // update + draw visitors
  for (const v of visitors) {
    v.update();
    v.draw();
  }

  // lines between each visitor and its target
  p5.stroke(255, 50);
  p5.strokeWeight(1);
  for (const v of visitors) {
    if (v.targetVisitor) {
      p5.line(
        v.position.x,
        v.position.y,
        v.targetVisitor.position.x,
        v.targetVisitor.position.y
      );
    }
  }

  checkCrossings(p5, tone);

  // glow connections between particles across all visitors
  p5.blendMode(p5.ADD);
  p5.strokeWeight(1);

  for (let i = 0; i < visitors.length; i++) {
    for (let j = i + 1; j < visitors.length; j++) {
      const vi = visitors[i];
      const vj = visitors[j];

      for (const p1 of vi.particles) {
        for (const p2 of vj.particles) {
          const d = p1.position.dist(p2.position);
          if (d < 100) {
            const a = p5.map(d, 0, 100, 255, 0);
            p5.stroke(255, a);
            p5.line(p1.position.x, p1.position.y, p2.position.x, p2.position.y);
          }
        }
      }
    }
  }

  p5.blendMode(p5.BLEND);
}

function updateVisitorTargets() {
  if (visitors.length < 2) return;
  for (let i = 0; i < visitors.length; i++) {
    const current = visitors[i];
    const next = visitors[(i + 1) % visitors.length];
    current.setTarget(next);
  }
}

function checkCrossings(p5: P5, tone: ToneControls) {
  const collisionThreshold = 15.0;

  const collisionsThisFrame = new Set<P5.Vector>();
  for (let i = 0; i < visitors.length; i++) {
    for (let j = i + 1; j < visitors.length; j++) {
      const vi = visitors[i];
      const vj = visitors[j];

      for (const p1 of vi.particles) {
        for (const p2 of vj.particles) {
          if (p1.collisionCooldown === 0 && p2.collisionCooldown === 0) {
            const d = p1.position.dist(p2.position);
            if (d < collisionThreshold) {
              collisionsThisFrame.add(p1.position);
              p1.collisionCooldown = 30;
              p2.collisionCooldown = 30;
            }
          }
        }
      }
    }
  }

  // only trigger one event per frame
  // because currently, only one synth is being used
  // and triggering it twice in one frame causes an error.
  if (collisionsThisFrame.size > 0) {
    triggerEvent(p5, collisionsThisFrame.values().next().value!, tone);
  }
}

function triggerEvent(p5: P5, loc: P5.Vector, tone: ToneControls) {
  // visual flash
  p5.noStroke();
  p5.fill(255, 255);
  p5.circle(loc.x, loc.y, 15);
  p5.stroke(255);
  p5.noFill();
  p5.circle(loc.x, loc.y, 30);

  tone.blip();
}
