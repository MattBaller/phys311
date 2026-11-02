// render/HUD.js -- live conservation readout. Your most useful debugger.
//
// It compares against world.baseline, which was captured ONCE at reset.
// Recomputing E0 inside the frame callback would make the drift read
// 0.000% forever -- an instrument measuring a quantity against itself.

const fmt = (x, n = 3) =>
  (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(2) : x.toFixed(n);

export class HUD {
  constructor(el) { this.el = el; this.warn = 0.01; }   // 1% = red

 update(world, acc, perf = {}) {
    const d = world.drift();
    const k = world.kineticEnergy(), u = world.potentialEnergy();
    const p = d.p;
    const pMag = p.len();
    const cls = Math.abs(d.dE) > this.warn ? 'bad'
              : Math.abs(d.dE) > this.warn / 10 ? 'warn' : 'good';

    this.el.innerHTML = `
      <div class="hud-row"><span>t</span><b>${world.t.toFixed(2)} s</b></div>
      <div class="hud-row"><span>bodies</span><b>${world.bodies.length}</b></div>
      <div class="hud-row"><span>steps</span><b>${world.steps}</b></div>
      <div class="hud-row"><span>collisions</span><b>${world.collisionCount}</b></div>

      <hr>

      <div class="hud-row"><span>KE</span><b>${fmt(k)}</b></div>
      <div class="hud-row"><span>PE</span><b>${fmt(u)}</b></div>
      <div class="hud-row"><span>E</span><b>${fmt(d.E)}</b></div>
      <div class="hud-row ${cls}"><span>&Delta;E/E&#8320;</span>
        <b>${(d.dE * 100).toFixed(4)} %</b></div>

      <div class="hud-row"><span>p (x)</span>
        <b>${fmt(p.x)} kg·m/s</b></div>
      <div class="hud-row"><span>p (y)</span>
        <b>${fmt(p.y)} kg·m/s</b></div>
        
      <div class="hud-row"><span>|p|</span>
        <b>${fmt(pMag)} kg·m/s</b></div>
      <div class="hud-row"><span>|&Delta;p|/|p&#8320;|</span>
        <b>${d.dp.toExponential(2)}</b></div>
      <div class="hud-row"><span>&Delta;L/L&#8320;</span>
        <b>${d.dL.toExponential(2)}</b></div>

      <hr>

      <div class="hud-row"><span>pair checks</span>
        <b>${world.stats.checks}</b></div>
      <div class="hud-row"><span>step time</span>
        <b>${world.stats.lastStepMs.toFixed(3)} ms</b></div>
      <div class="hud-row"><span>steps/frame</span>
        <b>${acc ? acc.stepsLastFrame : '-'}</b></div>

      <hr>

      <div class="hud-row"><span>physics/frame</span>
        <b>${(perf.physicsMs ?? 0).toFixed(3)} ms</b></div>
      <div class="hud-row"><span>render/frame</span>
        <b>${(perf.renderMs ?? 0).toFixed(3)} ms</b></div>
      <div class="hud-row"><span>FPS</span>
        <b>${(perf.fps ?? 0).toFixed(1)}</b></div>`;
  }
}