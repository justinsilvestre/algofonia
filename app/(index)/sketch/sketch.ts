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
import { ToneControls } from "../tone";
import { Visitor } from "./Visitor";

export function setup(
  p5: P5,
  parent: string | object | P5.Element,
  visitors: Visitor[]
): void {
  const canvas = p5.createCanvas(p5.windowWidth, p5.windowHeight);
  canvas.parent(parent);

  p5.background(0);

  visitors.push(new Visitor(p5, 100, 100), new Visitor(p5, 200, 100));
}

export function draw(
  p5: P5,
  tone: ToneControls,
  visitors: Visitor[],
  followMouse: boolean
): void {
  p5.noStroke();
  p5.fill(0, 30);
  p5.rect(0, 0, p5.width, p5.height);

  // Make the first visitor follow the mouse
  if (visitors.length > 0) {
    if (followMouse) visitors[0].position.set(p5.mouseX, p5.mouseY);
  }

  // update + draw visitors
  for (const v of visitors) {
    v.update();
    v.draw();
  }

  updateVisitorTargets(visitors);

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

  checkCrossings(p5, tone, visitors);

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

function updateVisitorTargets(visitors: Visitor[]) {
  if (visitors.length < 2) return;
  for (let i = 0; i < visitors.length; i++) {
    const current = visitors[i];
    const next = visitors[(i + 1) % visitors.length];
    current.setTarget(next);
  }
}

function checkCrossings(p5: P5, tone: ToneControls, visitors: Visitor[]) {
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
