// Body.js — one simulated object. Carries NO drawing information beyond a colour tag.
import { Vec2 } from './Vec2.js';

let _nextId = 1;

export class Body {
  constructor({ pos, vel = Vec2.zero(), shape = 'circle', width = 1.0, 
                height = 1.0, angle = 0, omega = 0, mass = 1, radius = 0.25,
                fixed = false, locked = false, breakable = false, defeated = false,
                breakThreshold = 8, color = '#ff8200', tag = '' } = {}) {
    this.id      = _nextId++;
    this.pos     = pos.clone();
    this.vel     = vel.clone();
    this.acc     = Vec2.zero();
    this.force   = Vec2.zero();
    this.mass    = mass;
    this.invMass = fixed ? 0 : 1 / mass;
    this.radius  = radius;
    this.fixed   = fixed;
    this.locked  = locked;
    this.color   = color;
    this.tag     = tag;

    this.breakable = breakable;
    this.breakThreshold = breakThreshold;
    this.destroyed = false;
    this.defeated = false;
    this.shape = shape;
    this.width = width;
    this.height = height;

    this.angle = angle;
    this.omega = omega;

    this.alpha = 0;
    this.torque = 0;

// Moment of inertia about the center of mass
if (shape === 'rectangle') {
  this.I = mass * (width ** 2 + height ** 2) / 12;
} else {
  this.I = 0.5 * mass * radius ** 2;
}

this.invI = fixed ? 0 : 1 / this.I;
    
  }

  clearForce()      { this.force.set(0, 0); }
  applyForce(F)     { this.force.addTo(F); }

  kinetic() {
  const KE_linear =
    0.5 * this.mass * this.vel.len2();

  const KE_rotational =
    0.5 * this.I * this.omega ** 2;

  return KE_linear + KE_rotational;
}
  momentum()        { return this.vel.mul(this.mass); }

  static resetIds() { _nextId = 1; }
}