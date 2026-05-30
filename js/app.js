/* ══════════════════════════════════════
   SIXsPlugins — app.js
   Routing, auth, search, tickets, admin
   ══════════════════════════════════════ */

/* ── ROUTER ─────────────────────────────────────────────────────────────── */
const SiteRouter = (() => {
  let _current = 'home';

  function goPage(name, tabIdx) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    if (tabIdx >= 0) {
      const tab = document.querySelectorAll('.nav-tab')[tabIdx];
      if (tab) tab.classList.add('active');
    }
    _current = name;
    window.scrollTo(0, 0);
  }

  function current() { return _current; }
  return { goPage, current };
})();

/* ── AUTH ────────────────────────────────────────────────────────────────── */
const Auth = (() => {
  const STORAGE_KEY = 'six_user';

  // Demo users (in produzione vengono dal backend)
  const DEMO_USERS = [
    { username: 'Steve99',   email: 'steve99@mc.net',      password: 'demo123' },
    { username: 'Alex_MC',   email: 'alex@example.com',    password: 'demo123' },
  ];

  let _current = null;

  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) _current = JSON.parse(raw);
    } catch {}
  }

  function save() {
    if (_current) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_current));
    else sessionStorage.removeItem(STORAGE_KEY);
  }

  function login(emailOrUser, password) {
    const u = DEMO_USERS.find(u =>
      (u.email === emailOrUser || u.username === emailOrUser) && u.password === password
    );
    if (!u) return false;
    _current = { username: u.username, email: u.email };
    save();
    updateNavUser();
    return true;
  }

  function register(username, email, password) {
    if (DEMO_USERS.find(u => u.email === email || u.username === username)) return false;
    DEMO_USERS.push({ username, email, password });
    _current = { username, email };
    save();
    updateNavUser();
    return true;
  }

  function logout() {
    _current = null;
    save();
    updateNavUser();
    SiteRouter.goPage('home', 0);
  }

  function isLoggedIn() { return !!_current; }
  function user() { return _current; }

  function updateNavUser() {
    const btn = document.getElementById('nav-user-btn');
    if (!btn) return;
    if (_current) {
      btn.textContent = '👤 ' + _current.username;
      btn.classList.add('logged-in');
      btn.onclick = () => UserMenu.toggle();
    } else {
      btn.textContent = '🔑 Accedi';
      btn.classList.remove('logged-in');
      btn.onclick = () => AuthModal.open('login');
    }
  }

  return { load, login, register, logout, isLoggedIn, user, updateNavUser };
})();

/* ── AUTH MODAL ──────────────────────────────────────────────────────────── */
const AuthModal = (() => {
  function open(tab = 'login') {
    document.getElementById('modal-auth').classList.add('open');
    switchTab(tab);
    clearErrors();
  }

  function close() {
    document.getElementById('modal-auth').classList.remove('open');
    clearErrors();
  }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-panel').forEach(p => p.style.display = 'none');
    document.getElementById('auth-tab-' + tab).classList.add('active');
    document.getElementById('auth-panel-' + tab).style.display = 'block';
  }

  function clearErrors() {
    document.querySelectorAll('.auth-error').forEach(e => e.style.display = 'none');
  }

  function doLogin() {
    const id  = document.getElementById('login-identifier').value.trim();
    const pwd = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    if (!id || !pwd) { showError(err, 'Compila tutti i campi.'); return; }
    if (Auth.login(id, pwd)) {
      close();
      showToast('✓ Bentornato, ' + Auth.user().username + '!');
    } else {
      showError(err, 'Credenziali non valide.');
    }
  }

  function doRegister() {
    const user = document.getElementById('reg-username').value.trim();
    const email= document.getElementById('reg-email').value.trim();
    const pwd  = document.getElementById('reg-password').value;
    const err  = document.getElementById('reg-error');
    if (!user || !email || !pwd) { showError(err, 'Compila tutti i campi.'); return; }
    if (pwd.length < 6) { showError(err, 'Password minima 6 caratteri.'); return; }
    if (Auth.register(user, email, pwd)) {
      close();
      showToast('✓ Account creato! Benvenuto, ' + user + '!');
    } else {
      showError(err, 'Username o email già in uso.');
    }
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }

  return { open, close, switchTab, doLogin, doRegister };
})();

/* ── USER MENU ───────────────────────────────────────────────────────────── */
const UserMenu = (() => {
  function toggle() {
    document.getElementById('user-menu').classList.toggle('open');
  }

  function close() {
    document.getElementById('user-menu')?.classList.remove('open');
  }

  function goMyTickets() {
    close();
    if (!Auth.isLoggedIn()) { AuthModal.open('login'); return; }
    buildMyTickets();
    SiteRouter.goPage('my-tickets', -1);
  }

  return { toggle, close, goMyTickets };
})();

/* ── MY TICKETS ──────────────────────────────────────────────────────────── */
const MyTickets = (() => {
  // Demo ticket data per utente loggato
  const DEMO = {
    'Steve99': [
      { id:'#0042', plugin:'ShopEasy',   title:'Prezzi non si aggiornano su /reload', status:'open', date:'2h fa',      priority:'Media' },
      { id:'#0039', plugin:'CombatCore', title:'Cooldown non funziona con Velocity',  status:'closed', date:'5 giorni fa', priority:'Alta' },
    ],
    'Alex_MC': [
      { id:'#0043', plugin:'ShopEasy',   title:'GUI non si apre dopo /reload',        status:'open', date:'1h fa',      priority:'Media' },
    ],
  };

  function build() {
    const wrap = document.getElementById('my-tickets-list');
    if (!wrap) return;
    const user = Auth.user();
    if (!user) return;
    const tickets = DEMO[user.username] || [];

    if (!tickets.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎫</div>
          <h3>Nessun ticket aperto</h3>
          <p>Non hai ancora aperto nessun ticket.<br>Se hai un problema, aprine uno!</p>
          <button class="btn-primary" style="margin-top:1.25rem" onclick="SiteRouter.goPage('ticket',2)">
            Apri il primo ticket
          </button>
        </div>`;
      return;
    }

    wrap.innerHTML = tickets.map(t => `
      <div class="ticket-item">
        <div class="t-dot t-${t.status}"></div>
        <div class="t-info">
          <div class="t-title">${t.plugin} — ${t.title}</div>
          <div class="t-meta">${t.id} · ${t.date}</div>
        </div>
        <span class="tag tag-a" style="font-size:10px;margin-right:6px">${t.priority}</span>
        <span class="t-badge" style="${statusStyle(t.status)}">${statusLabel(t.status)}</span>
      </div>`).join('');
  }

  function statusLabel(s) { return s === 'open' ? 'Aperto' : s === 'wip' ? 'In corso' : 'Chiuso'; }
  function statusStyle(s) {
    if (s === 'open')   return 'background:var(--orange-dim);color:var(--orange)';
    if (s === 'wip')    return 'background:var(--amber-dim);color:var(--amber)';
    return 'background:rgba(100,116,139,.15);color:var(--muted)';
  }

  return { build };
})();

/* ── SEARCH ──────────────────────────────────────────────────────────────── */
const Search = (() => {
  // Static searchable items beyond plugins
  const STATIC = [
    { type:'page', icon:'🎫', title:'Apri un Ticket', sub:'Segnala un problema', tag:'Pagina', tagClass:'tag-o', action: () => SiteRouter.goPage('ticket', 2) },
    { type:'page', icon:'📖', title:'Documentazione', sub:'Guide per tutti i plugin', tag:'Pagina', tagClass:'tag-o', action: () => SiteRouter.goPage('docs', 1) },
    { type:'page', icon:'🏠', title:'Home',            sub:'Torna alla pagina principale', tag:'Pagina', tagClass:'tag-o', action: () => SiteRouter.goPage('home', 0) },
  ];

  let _debounce = null;

  function open() {
    document.getElementById('search-overlay').classList.add('open');
    setTimeout(() => document.getElementById('search-input')?.focus(), 50);
  }

  function close() {
    document.getElementById('search-overlay').classList.remove('open');
    const inp = document.getElementById('search-input');
    if (inp) inp.value = '';
    render([]);
  }

  function onInput(val) {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      if (!val || val.length < 2) { render([]); return; }
      const pluginResults = PluginSystem.search(val);
      const staticResults = STATIC.filter(s =>
        s.title.toLowerCase().includes(val.toLowerCase()) ||
        s.sub.toLowerCase().includes(val.toLowerCase())
      );
      render([...pluginResults, ...staticResults]);
    }, 120);
  }

  function render(results) {
    const cont = document.getElementById('search-results');
    if (!cont) return;

    if (!results.length) {
      const q = document.getElementById('search-input')?.value || '';
      cont.innerHTML = q.length >= 2
        ? `<div class="search-empty">Nessun risultato per "<strong>${q}</strong>"</div>`
        : '';
      return;
    }

    // Group by type
    const groups = {};
    results.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });

    const typeLabel = { plugin:'Plugin', doc:'Documentazione', page:'Pagine' };

    cont.innerHTML = Object.entries(groups).map(([type, items]) => `
      <div class="search-section-label">${typeLabel[type] || type}</div>
      ${items.map(item => `
        <div class="search-result-item" onclick="Search._pick(${results.indexOf(item)})">
          <div class="search-result-icon">${item.icon}</div>
          <div class="search-result-info">
            <div class="search-result-title">${item.title}</div>
            <div class="search-result-sub">${item.sub}</div>
          </div>
          <span class="search-result-tag tag ${item.tagClass}">${item.tag}</span>
        </div>`).join('')}
    `).join('');

    // Store for pick
    Search._results = results;
  }

  function _pick(idx) {
    const r = Search._results?.[idx];
    if (r) { close(); r.action(); }
  }

  return { open, close, onInput, render, _pick, _results: [] };
})();

/* ── TICKET FORM ─────────────────────────────────────────────────────────── */
const TicketForm = (() => {
  let _files = [];

  function selPrio(el, cls) {
    document.querySelectorAll('.prio-btn').forEach(b => b.className = 'prio-btn');
    el.classList.add(cls);
  }

  function handleFiles(input) {
    const newFiles = Array.from(input.files);
    _files = [..._files, ...newFiles].slice(0, 5); // max 5 allegati
    renderFileList();
  }

  function removeFile(idx) {
    _files.splice(idx, 1);
    renderFileList();
  }

  function renderFileList() {
    const cont = document.getElementById('file-list');
    if (!cont) return;
    cont.innerHTML = _files.map((f, i) => `
      <div class="file-item">
        <span style="font-size:14px">${fileIcon(f.name)}</span>
        <span class="file-item-name">${f.name}</span>
        <span style="font-size:11px;color:var(--muted);font-family:var(--mono);flex-shrink:0">${fmtSize(f.size)}</span>
        <button class="file-item-remove" onclick="TicketForm.removeFile(${i})">✕</button>
      </div>`).join('');
  }

  function fileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (['png','jpg','jpeg','gif','webp'].includes(ext)) return '🖼️';
    if (['txt','log'].includes(ext)) return '📄';
    if (ext === 'zip') return '📦';
    return '📎';
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function submit() {
    const plugin = document.getElementById('ticket-plugin-sel')?.value;
    const title  = document.getElementById('ticket-title')?.value.trim();
    const desc   = document.getElementById('ticket-desc')?.value.trim();

    if (!plugin || plugin.startsWith('—')) { showToast('⚠️ Seleziona un plugin.'); return; }
    if (!title)  { showToast('⚠️ Inserisci un titolo.'); return; }
    if (!desc)   { showToast('⚠️ Inserisci una descrizione.'); return; }

    // Reset form
    document.getElementById('ticket-title').value = '';
    document.getElementById('ticket-desc').value  = '';
    _files = [];
    renderFileList();
    document.querySelectorAll('.prio-btn').forEach(b => b.className = 'prio-btn');
    document.querySelector('.prio-btn')?.classList.add('sel-l');

    showToast('✓ Ticket inviato! Risposta entro 4 ore.');
  }

  return { selPrio, handleFiles, removeFile, submit };
})();

/* ── ADMIN ───────────────────────────────────────────────────────────────── */
const Admin = (() => {
  function showLogin() {
    document.getElementById('public-site').style.display   = 'none';
    document.getElementById('admin-login').style.display   = '';
    document.getElementById('admin-shell').style.display   = 'none';
  }

  function showShell() {
    document.getElementById('public-site').style.display   = 'none';
    document.getElementById('admin-login').style.display   = 'none';
    document.getElementById('admin-shell').style.display   = 'flex';
    buildCharts();
    PluginSystem.buildAdminPluginsTable();
    PluginSystem.buildAdminDlTable();
    PluginSystem.buildStatsDlTable();
    PluginSystem.updateHomeStats();
  }

  function showPublic() {
    document.getElementById('public-site').style.display   = '';
    document.getElementById('admin-login').style.display   = 'none';
    document.getElementById('admin-shell').style.display   = 'none';
  }

  function doLogin() {
    const u = document.getElementById('l-user').value.trim();
    const p = document.getElementById('l-pass').value;
    const err = document.getElementById('login-err');
    // In produzione: chiamata API al backend
    if (u === 'admin' && p === 'admin123') {
      err.style.display = 'none';
      sessionStorage.setItem('six_admin', '1');
      location.hash = '#/admin';
      showShell();
    } else {
      err.style.display = 'block';
    }
  }

  function doLogout() {
    sessionStorage.removeItem('six_admin');
    location.hash = '';
    showPublic();
  }

  function aPage(name, el) {
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    const pg = document.getElementById('ap-' + name);
    if (pg) pg.classList.add('active');
    if (el) el.classList.add('active');
  }

  function filterTickets(val) {
    document.querySelectorAll('#ap-tickets table tr[data-status]').forEach(r => {
      r.style.display = (val === 'all' || r.dataset.status === val) ? '' : 'none';
    });
  }

  function filterUsers(q) {
    document.querySelectorAll('#users-table tr:not(:first-child)').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  }

  function changeStatus(btn, st) {
    const map = { open:'Aperto', wip:'In corso', closed:'Chiuso' };
    const dot = { open:'sdot-open', wip:'sdot-wip', closed:'sdot-closed' };
    const tr = btn.closest('tr');
    const sdot = tr.querySelector('.sdot');
    if (sdot) sdot.className = 'sdot ' + dot[st];
    tr.querySelectorAll('td')[5].innerHTML = `<span class="sdot ${dot[st]}"></span>${map[st]}`;
    tr.dataset.status = st;
    showToast('Stato aggiornato: ' + map[st]);
  }

  // ── Ticket detail modal ──
  let _chatOpen = false;

  function openTicketDetail(user, plugin, title, status) {
    const map = { open:'Aperto', wip:'In corso', closed:'Chiuso' };
    document.getElementById('mt-title').textContent   = 'Ticket — ' + user;
    document.getElementById('mt-plugin').textContent  = plugin;
    document.getElementById('mt-status').textContent  = map[status] || status;
    document.getElementById('mt-desc').textContent    = `L'utente ${user} ha segnalato: "${title}"`;
    document.getElementById('cp-title').textContent   = 'Chat live · ' + user;
    document.getElementById('cp-msgs').innerHTML      =
      `<div class="cp-msg-user"><div class="cp-bubble">Ciao, ho un problema con ${plugin}...</div><div class="cp-time">${user} · adesso</div></div>`;
    _chatOpen = false;
    document.getElementById('chat-panel-wrap').style.display = 'none';
    document.getElementById('chat-toggle-btn').textContent   = 'Abilita Chat';
    document.getElementById('modal-ticket').classList.add('open');
  }

  function toggleChat() {
    _chatOpen = !_chatOpen;
    document.getElementById('chat-panel-wrap').style.display = _chatOpen ? 'block' : 'none';
    document.getElementById('chat-toggle-btn').textContent   = _chatOpen ? 'Disabilita Chat' : 'Abilita Chat';
  }

  function sendTicketReply() {
    const v = document.getElementById('mt-reply').value.trim();
    if (!v) return;
    document.getElementById('mt-reply').value = '';
    showToast('✓ Risposta inviata all\'utente!');
  }

  function changeTicketStatus(st) {
    const map = { open:'Aperto', wip:'In corso', closed:'Chiuso' };
    document.getElementById('mt-status').textContent = map[st];
    showToast('Ticket segnato come: ' + map[st]);
  }

  function sendChatMsg() {
    const inp = document.getElementById('cp-inp');
    const txt = inp.value.trim();
    if (!txt) return;
    const m = document.getElementById('cp-msgs');
    const now = new Date().toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' });
    m.innerHTML += `<div class="cp-msg-admin"><div class="cp-bubble">${txt}</div><div class="cp-time">admin · ${now}</div></div>`;
    inp.value = '';
    m.scrollTop = m.scrollHeight;
  }

  // ── Bar charts ──
  function buildCharts() {
    const weekly  = [2, 4, 1, 3, 5, 1, 2];
    const monthly = [8, 12, 7, 10, 5];

    function makeBar(id, data) {
      const el = document.getElementById(id);
      if (!el) return;
      const max = Math.max(...data);
      el.innerHTML = data.map(v =>
        `<div class="bar" style="height:${Math.round(v / max * 100)}%" title="${v} ticket"></div>`
      ).join('');
    }
    makeBar('bar-chart', weekly);
    makeBar('bar-monthly', monthly);
  }

  // ── Route check ──
  function checkRoute() {
    if (location.hash === '#/admin') {
      if (sessionStorage.getItem('six_admin')) showShell();
      else showLogin();
    }
  }

  return {
    showLogin, showShell, showPublic,
    doLogin, doLogout,
    aPage, filterTickets, filterUsers,
    changeStatus, openTicketDetail, toggleChat,
    sendTicketReply, changeTicketStatus, sendChatMsg,
    buildCharts, checkRoute,
  };
})();

/* ── GLOBAL TOAST ────────────────────────────────────────────────────────── */
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

/* ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  // Cmd/Ctrl+K → search
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    Search.open();
  }
  // Esc → close overlays
  if (e.key === 'Escape') {
    Search.close();
    UserMenu.close();
    document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
  }
});

// Close user menu on outside click
document.addEventListener('click', e => {
  const wrap = document.getElementById('user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) UserMenu.close();
});

// Close search on backdrop click
document.getElementById('search-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'search-overlay') Search.close();
});

/* ── BOOT ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Load auth state
  Auth.load();
  Auth.updateNavUser();

  // Load plugins from JSON files
  await PluginSystem.init();

  // Check if on admin route
  Admin.checkRoute();

  // Hash change (back button etc.)
  window.addEventListener('hashchange', Admin.checkRoute);
});
