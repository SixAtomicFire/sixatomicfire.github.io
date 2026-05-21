// ─── STATE ───────────────────────────────────────────────────────────────────
const STATE_KEY = 'collab_session';

function loadState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) || null; } catch { return null; }
}
function saveState(s) { localStorage.setItem(STATE_KEY, JSON.stringify(s)); }

function defaultState() {
  return {
    phase: 0, // 0=setup, 1=fase1 (soluzioni), 2=fase2 (pro/contro/alt)
    problems: [],   // [{id, text, groupId}]
    groups: [],     // [{id, name}]
    assignments: [], // fase1: [{groupId, problemId}]
    rotations: [],   // fase2: [{groupId, problemId}] (rotated)
    responses: {},   // {`${groupId}_${problemId}`: {solution, pros, cons, altSolution}}
  };
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
function route() {
  const hash = location.hash.slice(1);
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const page = hash.split('?')[0];

  if (page === 'admin') return renderAdmin();
  if (page === 'group') {
    const gid = params.get('g');
    const phase = parseInt(params.get('p') || '1');
    return renderGroup(gid, phase);
  }
  renderHome();
}

window.addEventListener('hashchange', route);
window.addEventListener('load', route);

// ─── HOME ─────────────────────────────────────────────────────────────────────
function renderHome() {
  document.getElementById('app').innerHTML = `
    <div class="center-wrap">
      <div class="logo">⬡</div>
      <h1>Sessione collaborativa</h1>
      <p class="sub">Strumento per problem-solving in gruppo</p>
      <a href="#admin" class="btn-primary">Accedi come moderatore</a>
    </div>`;
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────
function renderAdmin() {
  let s = loadState() || defaultState();
  const app = document.getElementById('app');

  if (s.phase === 0) return renderSetup(s);
  if (s.phase === 1) return renderPhase1Admin(s);
  if (s.phase === 2) return renderPhase2Admin(s);
}

// SETUP
function renderSetup(s) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="admin-wrap">
      <header class="admin-header">
        <span class="logo-sm">⬡</span>
        <h2>Configurazione sessione</h2>
        <button class="btn-danger-sm" onclick="resetAll()">Reset</button>
      </header>

      <div class="grid2">
        <section class="card">
          <h3>Gruppi</h3>
          <div id="groups-list"></div>
          <div class="row-input">
            <input id="new-group" placeholder="Nome gruppo…" onkeydown="if(event.key==='Enter')addGroup()"/>
            <button onclick="addGroup()">Aggiungi</button>
          </div>
        </section>

        <section class="card">
          <h3>Problemi</h3>
          <div id="problems-list"></div>
          <div class="col-input">
            <textarea id="new-problem" placeholder="Descrivi il problema…" rows="3"></textarea>
            <button onclick="addProblem()">Aggiungi problema</button>
          </div>
        </section>
      </div>

      <section class="card">
        <h3>Assegnazioni — Fase 1</h3>
        <p class="hint">Ogni gruppo riceve un problema. Trascina o seleziona manualmente.</p>
        <div id="assignments-ui"></div>
        <button class="btn-ghost" onclick="autoAssign()">↺ Assegna automaticamente</button>
      </section>

      <div class="footer-actions">
        <button class="btn-primary" onclick="startPhase1()">Avvia Fase 1 →</button>
      </div>
    </div>`;

  renderGroupsList(s);
  renderProblemsList(s);
  renderAssignmentsUI(s);
}

function renderGroupsList(s) {
  const el = document.getElementById('groups-list');
  if (!el) return;
  el.innerHTML = s.groups.length === 0 ? '<p class="empty">Nessun gruppo</p>' :
    s.groups.map(g => `
      <div class="list-item">
        <span>${g.name}</span>
        <button class="icon-btn" onclick="removeGroup('${g.id}')">✕</button>
      </div>`).join('');
}

function renderProblemsList(s) {
  const el = document.getElementById('problems-list');
  if (!el) return;
  el.innerHTML = s.problems.length === 0 ? '<p class="empty">Nessun problema</p>' :
    s.problems.map((p, i) => `
      <div class="list-item">
        <span class="prob-label">P${i+1}</span>
        <span class="prob-text">${p.text}</span>
        <button class="icon-btn" onclick="removeProblem('${p.id}')">✕</button>
      </div>`).join('');
}

function renderAssignmentsUI(s) {
  const el = document.getElementById('assignments-ui');
  if (!el) return;
  if (s.groups.length === 0 || s.problems.length === 0) {
    el.innerHTML = '<p class="empty">Aggiungi gruppi e problemi per vedere le assegnazioni.</p>'; return;
  }
  el.innerHTML = s.groups.map(g => {
    const asgn = s.assignments.find(a => a.groupId === g.id);
    return `
      <div class="assign-row">
        <span class="assign-group">${g.name}</span>
        <span class="arrow">→</span>
        <select onchange="setAssignment('${g.id}', this.value)">
          <option value="">-- scegli problema --</option>
          ${s.problems.map((p,i) => `<option value="${p.id}" ${asgn && asgn.problemId===p.id?'selected':''}>P${i+1}: ${p.text.slice(0,50)}…</option>`).join('')}
        </select>
      </div>`;
  }).join('');
}

window.addGroup = function() {
  const inp = document.getElementById('new-group');
  const name = inp.value.trim();
  if (!name) return;
  const s = loadState() || defaultState();
  s.groups.push({id: uid(), name});
  saveState(s);
  inp.value = '';
  renderGroupsList(s);
  renderAssignmentsUI(s);
};

window.removeGroup = function(id) {
  const s = loadState();
  s.groups = s.groups.filter(g => g.id !== id);
  s.assignments = s.assignments.filter(a => a.groupId !== id);
  saveState(s);
  renderGroupsList(s);
  renderAssignmentsUI(s);
};

window.addProblem = function() {
  const ta = document.getElementById('new-problem');
  const text = ta.value.trim();
  if (!text) return;
  const s = loadState() || defaultState();
  s.problems.push({id: uid(), text});
  saveState(s);
  ta.value = '';
  renderProblemsList(s);
  renderAssignmentsUI(s);
};

window.removeProblem = function(id) {
  const s = loadState();
  s.problems = s.problems.filter(p => p.id !== id);
  s.assignments = s.assignments.filter(a => a.problemId !== id);
  saveState(s);
  renderProblemsList(s);
  renderAssignmentsUI(s);
};

window.setAssignment = function(groupId, problemId) {
  const s = loadState();
  s.assignments = s.assignments.filter(a => a.groupId !== groupId);
  if (problemId) s.assignments.push({groupId, problemId});
  saveState(s);
};

window.autoAssign = function() {
  const s = loadState();
  const problems = [...s.problems];
  shuffle(problems);
  s.assignments = [];
  s.groups.forEach((g, i) => {
    if (problems[i % problems.length])
      s.assignments.push({groupId: g.id, problemId: problems[i % problems.length].id});
  });
  saveState(s);
  renderAssignmentsUI(s);
};

window.startPhase1 = function() {
  const s = loadState();
  if (s.assignments.length === 0) { alert('Assegna almeno un problema a un gruppo.'); return; }
  s.phase = 1;
  saveState(s);
  renderAdmin();
};

// PHASE 1 ADMIN
function renderPhase1Admin(s) {
  const base = location.href.split('#')[0];
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="admin-wrap">
      <header class="admin-header">
        <span class="logo-sm">⬡</span>
        <h2>Fase 1 — Soluzioni in corso</h2>
        <button class="btn-danger-sm" onclick="resetAll()">Reset</button>
      </header>
      <p class="hint center-text">Condividi i QR / link con i rispettivi gruppi. Attendi che tutti completino, poi avanza.</p>

      <div class="qr-grid" id="qr-grid"></div>

      <div class="progress-section">
        <h3>Stato risposte</h3>
        <div id="progress-list"></div>
      </div>

      <div class="footer-actions">
        <button class="btn-primary" onclick="goPhase2()">Avanza a Fase 2 →</button>
      </div>
    </div>`;

  const grid = document.getElementById('qr-grid');
  s.assignments.forEach(a => {
    const g = s.groups.find(x => x.id === a.groupId);
    const p = s.problems.find(x => x.id === a.problemId);
    if (!g || !p) return;
    const url = `${base}#group?g=${a.groupId}&p=1`;
    const div = document.createElement('div');
    div.className = 'qr-card';
    div.innerHTML = `
      <div class="qr-title">${g.name}</div>
      <div class="qr-box" id="qr-${a.groupId}"></div>
      <div class="qr-url">${url}</div>
      <button class="btn-copy" onclick="copyLink('${url}')">Copia link</button>`;
    grid.appendChild(div);
    setTimeout(() => generateQR(`qr-${a.groupId}`, url), 100);
  });

  renderProgress(s);
  setInterval(() => { const ss = loadState(); renderProgress(ss); }, 3000);
}

function renderProgress(s) {
  const el = document.getElementById('progress-list');
  if (!el) return;
  el.innerHTML = s.assignments.map(a => {
    const g = s.groups.find(x => x.id === a.groupId);
    const key = `${a.groupId}_${a.problemId}_1`;
    const done = s.responses && s.responses[key];
    return `<div class="progress-row">
      <span>${g ? g.name : a.groupId}</span>
      <span class="${done ? 'badge-done' : 'badge-wait'}">${done ? '✓ Completato' : '⏳ In attesa'}</span>
    </div>`;
  }).join('');
}

window.goPhase2 = function() {
  const s = loadState();
  // Rotate: each group gets a different group's problem
  const assignments = [...s.assignments];
  const n = assignments.length;
  if (n < 2) { alert('Servono almeno 2 gruppi per la rotazione.'); return; }
  s.rotations = assignments.map((a, i) => ({
    groupId: a.groupId,
    problemId: assignments[(i + 1) % n].problemId
  }));
  s.phase = 2;
  saveState(s);
  renderAdmin();
};

// PHASE 2 ADMIN
function renderPhase2Admin(s) {
  const base = location.href.split('#')[0];
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="admin-wrap">
      <header class="admin-header">
        <span class="logo-sm">⬡</span>
        <h2>Fase 2 — Analisi in corso</h2>
        <button class="btn-danger-sm" onclick="resetAll()">Reset</button>
      </header>
      <p class="hint center-text">I gruppi ora analizzano il lavoro altrui. Condividi i nuovi QR.</p>

      <div class="qr-grid" id="qr-grid2"></div>

      <div class="progress-section">
        <h3>Stato risposte</h3>
        <div id="progress-list2"></div>
      </div>

      <div class="footer-actions">
        <button class="btn-primary" onclick="viewResults()">Visualizza risultati →</button>
      </div>
    </div>`;

  const grid = document.getElementById('qr-grid2');
  s.rotations.forEach(r => {
    const g = s.groups.find(x => x.id === r.groupId);
    const url = `${base}#group?g=${r.groupId}&p=2`;
    const div = document.createElement('div');
    div.className = 'qr-card';
    div.innerHTML = `
      <div class="qr-title">${g ? g.name : r.groupId}</div>
      <div class="qr-box" id="qr2-${r.groupId}"></div>
      <div class="qr-url">${url}</div>
      <button class="btn-copy" onclick="copyLink('${url}')">Copia link</button>`;
    grid.appendChild(div);
    setTimeout(() => generateQR(`qr2-${r.groupId}`, url), 100);
  });

  renderProgress2(s);
  setInterval(() => { const ss = loadState(); renderProgress2(ss); }, 3000);
}

function renderProgress2(s) {
  const el = document.getElementById('progress-list2');
  if (!el) return;
  el.innerHTML = (s.rotations || []).map(r => {
    const g = s.groups.find(x => x.id === r.groupId);
    const key = `${r.groupId}_${r.problemId}_2`;
    const done = s.responses && s.responses[key];
    return `<div class="progress-row">
      <span>${g ? g.name : r.groupId}</span>
      <span class="${done ? 'badge-done' : 'badge-wait'}">${done ? '✓ Completato' : '⏳ In attesa'}</span>
    </div>`;
  }).join('');
}

window.viewResults = function() {
  const s = loadState();
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="admin-wrap">
      <header class="admin-header">
        <span class="logo-sm">⬡</span>
        <h2>Risultati completi</h2>
        <button class="btn-ghost" onclick="renderAdmin()">← Torna</button>
        <button class="btn-danger-sm" onclick="resetAll()">Reset</button>
      </header>
      ${s.problems.map(p => buildResultCard(s, p)).join('')}
    </div>`;
};

function buildResultCard(s, p) {
  const phase1 = s.assignments.find(a => a.problemId === p.id);
  const phase2 = (s.rotations || []).find(r => r.problemId === p.id);
  const r1 = phase1 && s.responses ? s.responses[`${phase1.groupId}_${p.id}_1`] : null;
  const r2 = phase2 && s.responses ? s.responses[`${phase2.groupId}_${p.id}_2`] : null;
  const g1 = phase1 ? s.groups.find(g => g.id === phase1.groupId) : null;
  const g2 = phase2 ? s.groups.find(g => g.id === phase2.groupId) : null;

  const probIdx = s.problems.indexOf(p) + 1;

  return `
    <div class="result-card">
      <div class="result-problem">
        <span class="prob-badge">P${probIdx}</span>
        <p>${p.text}</p>
      </div>
      ${r1 ? `
        <div class="result-section">
          <div class="result-label">Soluzione — ${g1 ? g1.name : ''}</div>
          <p class="result-text">${r1.solution}</p>
        </div>` : '<div class="result-section empty-result">Nessuna soluzione ricevuta</div>'}
      ${r2 ? `
        <div class="result-grid3">
          <div class="result-section green-tint">
            <div class="result-label">✓ Vantaggi — ${g2 ? g2.name : ''}</div>
            <p class="result-text">${r2.pros}</p>
          </div>
          <div class="result-section red-tint">
            <div class="result-label">✕ Svantaggi</div>
            <p class="result-text">${r2.cons}</p>
          </div>
          ${r2.altSolution ? `
          <div class="result-section amber-tint">
            <div class="result-label">⟳ Soluzione alternativa</div>
            <p class="result-text">${r2.altSolution}</p>
          </div>` : ''}
        </div>` : '<div class="result-section empty-result">Nessuna analisi ricevuta</div>'}
    </div>`;
}

// ─── GROUP VIEW ───────────────────────────────────────────────────────────────
function renderGroup(gid, phase) {
  const s = loadState();
  if (!s) { document.getElementById('app').innerHTML = '<div class="center-wrap"><p>Sessione non trovata. Contatta il moderatore.</p></div>'; return; }

  const group = s.groups.find(g => g.id === gid);
  if (!group) { document.getElementById('app').innerHTML = '<div class="center-wrap"><p>Gruppo non trovato.</p></div>'; return; }

  if (phase === 1) renderGroupPhase1(s, group);
  else renderGroupPhase2(s, group);
}

function renderGroupPhase1(s, group) {
  const asgn = s.assignments.find(a => a.groupId === group.id);
  if (!asgn) { document.getElementById('app').innerHTML = '<div class="center-wrap"><p>Nessun problema assegnato.</p></div>'; return; }
  const prob = s.problems.find(p => p.id === asgn.problemId);
  const key = `${group.id}_${asgn.problemId}_1`;
  const existing = s.responses && s.responses[key];

  document.getElementById('app').innerHTML = `
    <div class="group-wrap">
      <header class="group-header">
        <span class="logo-sm">⬡</span>
        <div>
          <div class="group-name">${group.name}</div>
          <div class="phase-badge">Fase 1 · Proponi una soluzione</div>
        </div>
      </header>

      <div class="problem-box">
        <div class="problem-label">Il problema</div>
        <p class="problem-text">${prob ? prob.text : 'Problema non trovato'}</p>
      </div>

      ${existing ? `
        <div class="submitted-box">
          <div class="submitted-label">✓ Risposta inviata</div>
          <p>${existing.solution}</p>
          <p class="hint">Attendi che il moderatore avanzi alla fase 2.</p>
        </div>` : `
        <div class="card">
          <label class="field-label">La vostra soluzione</label>
          <textarea id="solution" rows="6" placeholder="Descrivete la soluzione che proponete…"></textarea>
          <button class="btn-primary" onclick="submitPhase1('${group.id}', '${asgn.problemId}')">Invia soluzione →</button>
        </div>`}
    </div>`;
}

window.submitPhase1 = function(groupId, problemId) {
  const solution = document.getElementById('solution').value.trim();
  if (!solution) { alert('Scrivi una soluzione prima di inviare.'); return; }
  const s = loadState();
  if (!s.responses) s.responses = {};
  s.responses[`${groupId}_${problemId}_1`] = { solution };
  saveState(s);
  renderGroup(groupId, 1);
};

function renderGroupPhase2(s, group) {
  const rot = (s.rotations || []).find(r => r.groupId === group.id);
  if (!rot) { document.getElementById('app').innerHTML = '<div class="center-wrap"><p>Rotazione non ancora avviata. Attendi il moderatore.</p></div>'; return; }

  const prob = s.problems.find(p => p.id === rot.problemId);
  const phase1Asgn = s.assignments.find(a => a.problemId === rot.problemId);
  const r1 = phase1Asgn && s.responses ? s.responses[`${phase1Asgn.groupId}_${rot.problemId}_1`] : null;
  const key = `${group.id}_${rot.problemId}_2`;
  const existing = s.responses && s.responses[key];

  document.getElementById('app').innerHTML = `
    <div class="group-wrap">
      <header class="group-header">
        <span class="logo-sm">⬡</span>
        <div>
          <div class="group-name">${group.name}</div>
          <div class="phase-badge phase-badge-2">Fase 2 · Analisi</div>
        </div>
      </header>

      <div class="problem-box">
        <div class="problem-label">Il problema</div>
        <p class="problem-text">${prob ? prob.text : ''}</p>
      </div>

      ${r1 ? `
        <div class="solution-box">
          <div class="solution-label">Soluzione proposta</div>
          <p class="solution-text">${r1.solution}</p>
        </div>` : ''}

      ${existing ? `
        <div class="submitted-box">
          <div class="submitted-label">✓ Analisi inviata</div>
          <p><strong>Vantaggi:</strong> ${existing.pros}</p>
          <p><strong>Svantaggi:</strong> ${existing.cons}</p>
          ${existing.altSolution ? `<p><strong>Soluzione alternativa:</strong> ${existing.altSolution}</p>` : ''}
        </div>` : `
        <div class="card">
          <label class="field-label">Vantaggi della soluzione</label>
          <textarea id="pros" rows="3" placeholder="Cosa funziona bene in questa soluzione?"></textarea>

          <label class="field-label mt">Svantaggi della soluzione</label>
          <textarea id="cons" rows="3" placeholder="Cosa potrebbe non funzionare?"></textarea>

          <label class="field-label mt">Soluzione alternativa <span class="optional">(opzionale)</span></label>
          <textarea id="alt" rows="3" placeholder="Se avete un'idea alternativa, descrivetela qui…"></textarea>

          <button class="btn-primary" onclick="submitPhase2('${group.id}', '${rot.problemId}')">Invia analisi →</button>
        </div>`}
    </div>`;
}

window.submitPhase2 = function(groupId, problemId) {
  const pros = document.getElementById('pros').value.trim();
  const cons = document.getElementById('cons').value.trim();
  const altSolution = document.getElementById('alt').value.trim();
  if (!pros || !cons) { alert('Compila almeno vantaggi e svantaggi.'); return; }
  const s = loadState();
  if (!s.responses) s.responses = {};
  s.responses[`${groupId}_${problemId}_2`] = { pros, cons, altSolution };
  saveState(s);
  renderGroup(groupId, 2);
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
window.resetAll = function() {
  if (!confirm('Vuoi davvero resettare tutta la sessione?')) return;
  localStorage.removeItem(STATE_KEY);
  location.hash = '#admin';
  renderAdmin();
};

window.copyLink = function(url) {
  navigator.clipboard.writeText(url).then(() => {
    const btns = document.querySelectorAll('.btn-copy');
    btns.forEach(b => { if (b.getAttribute('onclick').includes(url)) { b.textContent = 'Copiato!'; setTimeout(() => b.textContent = 'Copia link', 2000); } });
  });
};

function uid() { return Math.random().toString(36).slice(2, 10); }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }

function generateQR(containerId, url) {
  const el = document.getElementById(containerId);
  if (!el || !window.QRCode) return;
  el.innerHTML = '';
  new QRCode(el, { text: url, width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });
}
