
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
