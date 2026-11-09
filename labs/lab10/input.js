// Keyboard.js — ACCESSIBILITY. Every mouse action has a keyboard equivalent,
// so the simulation is usable without a pointing device.
//   Space  play/pause      S  single step      R  reset
//   Tab/Shift-Tab  cycle selected body
//   arrows  nudge the selected body (acts through the same PointerSpring)
//   +/-  zoom            T  trails            1..5  load preset
export class KeyboardInput {
  constructor(world, spring, camera, actions) {
    this.world = world; this.spring = spring; this.cam = camera;
    this.actions = actions;
    this.selected = null;
    this._held = null;
    window.addEventListener('keydown', (e) => this._down(e));
    window.addEventListener('keyup',   (e) => this._up(e));
  }

  _down(e) {
    if (e.target.matches('input, select, textarea')) return;  // don't hijack sliders
    const A = this.actions;
    switch (e.key) {
      case ' ':      A.togglePause(); e.preventDefault(); break;
      case 's': case 'S': A.stepOnce(); break;
      case 'r': case 'R': A.reset(); break;
      case 't': case 'T': A.toggleTrails(); break;
      case '+': case '=': this.cam.scale *= 1.15; break;
      case '-': case '_': this.cam.scale /= 1.15; break;
      case 'Tab':    this._cycle(e.shiftKey ? -1 : 1); e.preventDefault(); break;
      case 'ArrowUp': case 'ArrowDown':
      case 'ArrowLeft': case 'ArrowRight':
        this._nudge(e.key); e.preventDefault(); break;
      default:
        if ('12345'.includes(e.key)) A.preset(Number(e.key) - 1);
    }
  }
  _up(e) {
    if (e.key.startsWith('Arrow')) { this.spring.release(); this._held = null; }
  }

  _cycle(dir) {
    const bs = this.world.bodies.filter(b => !b.fixed);
    if (!bs.length) return;
    const i = bs.indexOf(this.selected);
    this.selected = bs[(i + dir + bs.length) % bs.length];
    this.actions.announce(`Selected body ${this.selected.id}, ` +
      `position ${this.selected.pos.x.toFixed(1)}, ${this.selected.pos.y.toFixed(1)} metres`);
  }

  _nudge(key) {
    if (!this.selected) this._cycle(1);
    if (!this.selected) return;
    const b = this.selected;
    const d = 0.35;
    if (this._held !== b) { this.spring.grab(b, b.pos.x, b.pos.y); this._held = b; }
    const t = this.spring.target;
    if (key === 'ArrowUp')    t.y += d;
    if (key === 'ArrowDown')  t.y -= d;
    if (key === 'ArrowLeft')  t.x -= d;
    if (key === 'ArrowRight') t.x += d;
  }
}


// Pointer.js — converts pixels to world coordinates and drives the
// engine's PointerSpring. Works for mouse, touch and stylus via Pointer Events,
// so there is exactly ONE code path instead of three.

// Pointer.js — mouse, touch and stylus interaction.
export class PointerInput {
  constructor(canvas, camera, world, spring, { onSpawn = null } = {}) {
    this.canvas = canvas;
    this.cam = camera;
    this.world = world;
    this.spring = spring;
    this.onSpawn = onSpawn;
    this.spawnMode = false;

    // Slingshot settings
    this.launchScale = 3.0;
    this.maxLaunchSpeed = 20;
    this.launchOrigin = null;

    this._bind();
  }

  _world(ev) {
    const r = this.canvas.getBoundingClientRect();
    return this.cam.toWorld(ev.clientX - r.left, ev.clientY - r.top);
  }

  _bind() {
    const c = this.canvas;

    c.addEventListener('pointerdown', (ev) => {
      c.setPointerCapture(ev.pointerId);

      const [x, y] = this._world(ev);

      if (this.spawnMode) {
        this.onSpawn && this.onSpawn(x, y);
        return;
      }

      const b = this.world.pick(x, y, 0.15);

// Only allow grabbing projectiles that have not been launched.
if (b && b.tag === 'projectile' && b.locked) {
  this.spring.grab(b, x, y);

  if (this.spring.slingshotMode) {
    this.launchOrigin = {
      x: b.pos.x,
      y: b.pos.y
    };
  }

  c.classList.add('grabbing');
}
    });

    c.addEventListener('pointermove', (ev) => {
      const [x, y] = this._world(ev);

      if (this.spring.active) {
        this.spring.moveTo(x, y);
      } else {
        c.style.cursor =
          this.world.pick(x, y, 0.15) ? 'grab' : 'crosshair';
      }
    });

    const end = (ev) => {
      if (this.spring.active) {
        const b = this.spring.grabbed;

        if (this.spring.slingshotMode && b && this.launchOrigin) {
          b.locked = false;;
          // Launch opposite the direction of the pull.
          const dx = this.launchOrigin.x - this.spring.target.x;
          const dy = this.launchOrigin.y - this.spring.target.y;

          let vx = dx * this.launchScale;
          let vy = dy * this.launchScale;

          // Limit maximum launch speed.
          const speed = Math.hypot(vx, vy);

          if (speed > this.maxLaunchSpeed) {
            const factor = this.maxLaunchSpeed / speed;
            vx *= factor;
            vy *= factor;
          }

          // Keep the projectile at its original launch position.
          b.pos.x = this.launchOrigin.x;
          b.pos.y = this.launchOrigin.y;

          b.vel.x = vx;
          b.vel.y = vy;
        }

        this.spring.release();
        this.launchOrigin = null;
        c.classList.remove('grabbing');
      }

      if (c.hasPointerCapture?.(ev.pointerId)) {
        c.releasePointerCapture(ev.pointerId);
      }
    };

    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);

    window.addEventListener('blur', () => {
      this.spring.release();
      this.launchOrigin = null;
      c.classList.remove('grabbing');
    });
  }
}