
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


    // Integrator selector
    this.$('integrator')?.addEventListener('change', e => {
     s.integrator = e.target.value;
      this.onRebuild();
    });

    // Timestep slider
    this.$('dt')?.addEventListener('input', e => {
      s.dt = parseFloat(e.target.value);

    this.$('dt-out').textContent =
        `${s.dt.toFixed(3)} s`;

     this.onChange();
    });

// Simulation speed slider
this.$('speed')?.addEventListener('input', e => {
  s.speed = parseFloat(e.target.value);
  this.$('speed-out').textContent = `${s.speed.toFixed(2)}×`;
  this.onChange();
});

// Physics parameter sliders
for (const id of ['G', 'restitution', 'drag']) {
  this.$(id)?.addEventListener('input', e => {
    s[id] = parseFloat(e.target.value);

    const precision = id === 'G' ? 2 : id === 'restitution' ? 2 : 3;
    this.$(`${id}-out`).textContent = s[id].toFixed(precision);

    this.onChange();
  });
}

// Visualization toggles
for (const [id, key] of [
  ['show-force', 'showForce'],
  ['show-velocity', 'showVelocity'],
  ['show-trails', 'showTrails']
]) {
  this.$(id)?.addEventListener('change', e => {
    s[key] = e.target.checked;
    this.onChange();
  });
}

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

    for (const [id, key] of [
  ['show-force', 'showForce'],
  ['show-velocity', 'showVelocity'],
  ['show-trails', 'showTrails']
]) {
  const checkbox = this.$(id);
  if (checkbox) checkbox.checked = this.state[key];
}

    for (const id of ['G', 'restitution', 'drag']) {
  const slider = this.$(id);
  const output = this.$(`${id}-out`);

  if (slider) slider.value = this.state[id];

  if (output) {
    const precision = id === 'G' ? 2 : id === 'restitution' ? 2 : 3;
    output.textContent = this.state[id].toFixed(precision);
  }
}
  }

  setPlayLabel(paused) {
    const button = this.$('btn-play');

    if (!button) return;

    button.textContent = paused ? '▶ Play' : '⏸ Pause';
    button.setAttribute('aria-pressed', String(!paused));
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
    p.set('G',     String(s.G));
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
      G:           num('G', defaults.G),
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
