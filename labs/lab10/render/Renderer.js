// Renderer.js — draws a World. Reads the world, never mutates it.
export class Renderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.cam    = camera;
    this.dpr    = 1;
    this.showTrails = true;
    this.trails = new Map();             // body.id -> array of [x,y]
    this.maxTrail = 160;
    this.reducedMotion = false;
  }

  // Handle Retina / high-DPI screens: back the canvas with more device pixels
  // than CSS pixels, then scale the context once so all drawing stays in CSS units.
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width  = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
    this.cam.resize(w, h);
  }

  clearTrails() { this.trails.clear(); }

  recordTrails(world) {
    if (!this.showTrails || this.reducedMotion) return;
    for (const b of world.bodies) {
      if (!this.trails.has(b.id)) this.trails.set(b.id, []);
      const t = this.trails.get(b.id);
      t.push([b.pos.x, b.pos.y]);
      if (t.length > this.maxTrail) t.shift();
    }
  }

  draw(world, { grabbed = null, target = null } = {}) {
    const ctx = this.ctx, cam = this.cam;
    ctx.clearRect(0, 0, cam.w, cam.h);

    this._grid(world);
    if (world.bounds) this._bounds(world.bounds);

    if (this.showTrails && !this.reducedMotion) {
      ctx.lineWidth = 1.5;
      for (const b of world.bodies) {
        const t = this.trails.get(b.id);
        if (!t || t.length < 2) continue;
        ctx.strokeStyle = b.color + '66';
        ctx.beginPath();
        t.forEach(([x, y], i) => {
          const [px, py] = cam.toScreen(x, y);
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.stroke();
      }
    }

    for (const f of world.forces)
      if (f.constructor.name === 'Spring' && f.enabled) {
        const [ax, ay] = cam.toScreen(f.a.pos.x, f.a.pos.y);
        const [bx, by] = cam.toScreen(f.b.pos.x, f.b.pos.y);
        ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }

    for (const b of world.bodies) {
      const [px, py] = cam.toScreen(b.pos.x, b.pos.y);
      const r = Math.max(2.5, b.radius * cam.scale);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = b.defeated ? '#555555' : b.color;
      ctx.fill();
      if (b === grabbed) { ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
      else if (b.fixed)  { ctx.lineWidth = 2; ctx.strokeStyle = '#333';    ctx.stroke(); }
    }

    if (grabbed && target) {
  const b = grabbed;

  // Calculate launch velocity from the current pull distance
  const dx = b.pos.x - target.x;
  const dy = b.pos.y - target.y;

  const launchScale = 0.3;
  const vx = dx * launchScale;
  const vy = dy * launchScale;

  // Predict trajectory
  const points = [];
  const dt = 0.05;
  const steps = 100;

  let x = b.pos.x;
  let y = b.pos.y;
  let velX = vx;
  let velY = vy;

  for (let i = 0; i < steps; i++) {
    points.push(cam.toScreen(x, y));

    // Simple gravitational acceleration
    const ax = 0;
    const ay = 0;

    velX += ax * dt;
    velY += ay * dt;

    x += velX * dt;
    y += velY * dt;
  }

  // Draw predicted trajectory
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  ctx.beginPath();
  points.forEach(([sx, sy], i) => {
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.stroke();
  ctx.restore();
}
  }

  _grid(world) {
    const ctx = this.ctx, cam = this.cam;
    const [x0, y0] = cam.toWorld(0, cam.h);
    const [x1, y1] = cam.toWorld(cam.w, 0);
    let s = 1;
    while ((x1 - x0) / s > 22) s *= 2;
    ctx.strokeStyle = '#242424'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(x0 / s) * s; x <= x1; x += s) {
      const [px] = cam.toScreen(x, 0); ctx.moveTo(px, 0); ctx.lineTo(px, cam.h);
    }
    for (let y = Math.ceil(y0 / s) * s; y <= y1; y += s) {
      const [, py] = cam.toScreen(0, y); ctx.moveTo(0, py); ctx.lineTo(cam.w, py);
    }
    ctx.stroke();
  }

  _bounds(bn) {
    const ctx = this.ctx, cam = this.cam;
    const [x0, y1] = cam.toScreen(bn.xmin, bn.ymax);
    const [x1, y0] = cam.toScreen(bn.xmax, bn.ymin);
    ctx.strokeStyle = '#ff8200'; ctx.lineWidth = 2;
    ctx.strokeRect(x0, y1, x1 - x0, y0 - y1);
  }
}
