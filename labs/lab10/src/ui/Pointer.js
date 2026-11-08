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
    this.maxLaunchSpeed = 30;
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

      if (b) {
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
