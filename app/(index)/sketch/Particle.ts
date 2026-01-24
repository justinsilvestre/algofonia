import type P5 from "p5";

// ---- AUDIO (p5.sound) ----
// let osc: P5.Oscillator;
// let env: P5.Envelope;
// ---- constants from original (kept for compatibility) ----
const aConst: number = -1.7;
const bConst: number = 1.3;
const cConst: number = -0.1;
const dConst: number = -1.2;

export class Particle {
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
