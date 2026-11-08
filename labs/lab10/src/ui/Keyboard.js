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
