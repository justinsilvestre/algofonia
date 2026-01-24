import type P5 from "p5";
import { Particle } from "./Particle";

export class Visitor {
  p5: P5;
  position: P5.Vector;
  col: P5.Color;
  particles: Particle[];
  targetVisitor: Visitor | null;
  spawnTimer: number;
  spawnInterval: number;
  maxParticles: number;
  radius: number;

  constructor(
    p5: P5,
    x: number,
    y: number,
    col: [number, number, number] = getRandomVisitorColor()
  ) {
    this.p5 = p5;
    this.position = p5.createVector(x, y);
    this.col = p5.color(col[0], col[1], col[2]);
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
export function getRandomVisitorColor(): [r: number, g: number, b: number] {
  const colors: [number, number, number][] = [
    [255, 0, 0], // Red
    [0, 255, 0], // Green
    [0, 0, 255], // Blue
    [255, 255, 0], // Yellow
    [255, 0, 255], // Magenta
    [0, 255, 255], // Cyan
    [255, 165, 0], // Orange
    [128, 0, 128], // Purple
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
