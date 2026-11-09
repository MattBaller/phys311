// Controls.js — binds the simplified control panel to the simulation state.

export class Controls {
  constructor(state, { onChange, onRebuild, onAction }) {
    this.state = state;
    this.onChange = onChange;
    this.onRebuild = onRebuild;
    this.onAction = onAction;

    this._wire();
    this.syncToDOM();
  }

  $(id) {
    return document.getElementById(id);
  }

  _wire() {
    const s = this.state;

    // Timestep slider
    this.$('dt')?.addEventListener('input', e => {
      s.dt = parseFloat(e.target.value);

    this.$('dt-out').textContent =
        `${s.dt.toFixed(3)} s`;

     this.onChange();
    });
    // Simulation buttons
    for (const [id, act] of [
      ['btn-play', 'togglePause'],
      ['btn-step', 'stepOnce'],
      ['btn-reset', 'reset'],
      ['btn-link', 'copyLink']
    ]) {
      this.$(id)?.addEventListener('click', () => {
        this.onAction(act);
      });
    }
  }

  // Synchronize the selected integrator with the simulation state.
  syncToDOM() {
    const integrator = this.$('integrator');

    if (integrator) {
      integrator.value = this.state.integrator;
    }
  }

  setPlayLabel(paused) {
    const button = this.$('btn-play');

    if (!button) return;

    button.textContent = paused ? '▶ Play' : '⏸ Pause';
    button.setAttribute('aria-pressed', String(!paused));
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


// StateURL.js — encode the control-panel state into the URL hash so a student
// can send a link that reproduces the EXACT configuration they are asking about.
// Deliberately tiny and human-readable: no base64, no JSON blob.
export const StateURL = {
  encode(s) {
    const p = new URLSearchParams();
    p.set('scene', s.scene);
    p.set('int',   s.integrator);
    p.set('dt',    String(s.dt));
    p.set('e',     String(s.restitution));
    p.set('g',     String(s.gravity));
    p.set('drag',  String(s.drag));
    p.set('speed', String(s.speed));
    p.set('n',     String(s.count));
    return '#' + p.toString();
  },

  decode(hash, defaults) {
    const p = new URLSearchParams((hash || '').replace(/^#/, ''));
    const num = (k, d) => {
      const v = parseFloat(p.get(k));
      return Number.isFinite(v) ? v : d;
    };
    return {
      scene:       p.get('scene') || defaults.scene,
      integrator:  p.get('int')   || defaults.integrator,
      dt:          num('dt',    defaults.dt),
      restitution: num('e',     defaults.restitution),
      gravity:     num('g',     defaults.gravity),
      drag:        num('drag',  defaults.drag),
      speed:       num('speed', defaults.speed),
      count:       Math.round(num('n', defaults.count))
    };
  },

  write(s) {
    // replaceState, not location.hash: no history entry per slider nudge.
    if (typeof history !== 'undefined' && history.replaceState)
      history.replaceState(null, '', StateURL.encode(s));
  }
};
