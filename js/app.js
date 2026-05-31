/* ══════════════════════════════════════
   SIXsPlugins — app.js
   Routing, auth reale (Supabase), ticket,
   admin, search
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

/* ── AUTH (Supabase) ─────────────────────────────────────────────────────── */
const Auth = (() => {
  let _user    = null;   // supabase user object
  let _profile = null;   // { username }

  // Chiamato all'avvio per caricare la sessione esistente
  async function load() {
    const session = await SupaAuth.getSession();
    if (session) {
      _user = session.user;
      _profile = await SupaAuth.getProfile(_user.id);
    }
    updateNavUser();

    // Ascolta cambi auth in tempo reale
    SupaAuth.onAuthChange(async (event, session) => {
      if (session) {
        _user    = session.user;
        _profile = await SupaAuth.getProfile(_user.id);
      } else {
        _user    = null;
        _profile = null;
      }
      updateNavUser();
    });
  }

  async function login(emailOrUser, password) {
    // Supabase vuole email — se l'utente inserisce username, gestiscilo lato client
    const email = emailOrUser.includes('@') ? emailOrUser : emailOrUser + '@sixsplugins.local';
    try {
      await SupaAuth.signIn(email, password);
      return true;
    } catch {
      // Prova con email esatta
      try {
        await SupaAuth.signIn(emailOrUser, password);
        return true;
      } catch {
        return false;
      }
    }
  }

  async function register(username, email, password) {
    try {
      await SupaAuth.signUp(username, email, password);
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: err.message };
    }
  }

  async function logout() {
    await SupaAuth.signOut();
    _user    = null;
    _profile = null;
    updateNavUser();
    SiteRouter.goPage('home', 0);
  }

  function isLoggedIn() { return !!_user; }
  function user()       { return _user; }
  function username()   { return _profile?.username || _user?.email?.split('@')[0] || 'Utente'; }

  function updateNavUser() {
    const btn = document.getElementById('nav-user-btn');
    if (!btn) return;
    if (_user) {
      btn.textContent = '👤 ' + username();
      btn.classList.add('logged-in');
      btn.onclick = () => UserMenu.toggle();
      const n = document.getElementById('um-name');
      const e = document.getElementById('um-email');
      if (n) n.textContent = username();
      if (e) e.textContent = _user.email;
    } else {
      btn.textContent = '🔑 Accedi';
      btn.classList.remove('logged-in');
      btn.onclick = () => AuthModal.open('login');
    }
  }

  return { load, login, register, logout, isLoggedIn, user, username, updateNavUser };
})();

/* ── AUTH MODAL ──────────────────────────────────────────────────────────── */
const AuthModal = (() => {
  function open(tab = 'login') {
    document.getElementById('modal-auth').classList.add('open');
    switchTab(tab);
    clearErrors();
    setTimeout(() => {
      const first = document.getElementById(tab === 'login' ? 'login-identifier' : 'reg-username');
      if (first) first.focus();
    }, 60);
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
    clearErrors();
  }

  function clearErrors() {
    document.querySelectorAll('.auth-error').forEach(e => {
      e.style.display = 'none';
      e.textContent   = '';
    });
  }

  async function doLogin() {
    const id  = document.getElementById('login-identifier').value.trim();
    const pwd = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    if (!id || !pwd) { showError(err, 'Compila tutti i campi.'); return; }

    const btn = document.querySelector('#auth-panel-login .submit-btn');
    setLoading(btn, true, 'Accesso in corso...');

    const ok = await Auth.login(id, pwd);
    setLoading(btn, false, 'Accedi →');

    if (ok) {
      close();
      showToast('✓ Bentornato, ' + Auth.username() + '!');
    } else {
      showError(err, 'Email o password non validi.');
    }
  }

  async function doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const pwd      = document.getElementById('reg-password').value;
    const err      = document.getElementById('reg-error');

    if (!username || !email || !pwd) { showError(err, 'Compila tutti i campi.'); return; }
    if (pwd.length < 6)              { showError(err, 'Password minima 6 caratteri.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(err, 'Email non valida.'); return; }

    const btn = document.querySelector('#auth-panel-register .submit-btn');
    setLoading(btn, true, 'Registrazione...');

    const result = await Auth.register(username, email, pwd);
    setLoading(btn, false, 'Crea account →');

    if (result.ok) {
      close();
      showToast('✓ Account creato! Controlla la tua email per confermare.');
    } else {
      showError(err, result.msg || 'Errore durante la registrazione.');
    }
  }

  function showError(el, msg) {
    el.textContent   = msg;
    el.style.display = 'block';
  }

  function setLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled     = loading;
    btn.textContent  = label;
    btn.style.opacity = loading ? '0.7' : '1';
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
    MyTickets.build();
    SiteRouter.goPage('my-tickets', -1);
  }
  return { toggle, close, goMyTickets };
})();

/* ── MY TICKETS ──────────────────────────────────────────────────────────── */
const MyTickets = (() => {
  async function build() {
    const wrap = document.getElementById('my-tickets-list');
    if (!wrap) return;

    if (!Auth.isLoggedIn()) {
      wrap.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">🔑</div>
        <h3>Accedi per vedere i tuoi ticket</h3>
        <button class="btn-primary" style="margin-top:1rem" onclick="AuthModal.open('login')">Accedi</button>
      </div>`;
      return;
    }

    wrap.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--muted)">Caricamento...</div>`;

    try {
      const tickets = await SupaTickets.getMyTickets();

      if (!tickets.length) {
        wrap.innerHTML = `<div class="empty-state">
          <div class="empty-state-icon">🎫</div>
          <h3>Nessun ticket aperto</h3>
          <p>Non hai ancora aperto nessun ticket.</p>
          <button class="btn-primary" style="margin-top:1.25rem"
            onclick="SiteRouter.goPage('ticket',2)">Apri il primo ticket</button>
        </div>`;
        return;
      }

      wrap.innerHTML = tickets.map(t => `
        <div class="ticket-item">
          <div class="t-dot t-${t.status}"></div>
          <div class="t-info">
            <div class="t-title">${escHtml(t.plugin)} — ${escHtml(t.title)}</div>
            <div class="t-meta">#${t.id} · ${timeAgo(t.created_at)}</div>
          </div>
          <span class="tag tag-a" style="font-size:10px;margin-right:6px">${priorityLabel(t.priority)}</span>
          <span class="t-badge" style="${statusStyle(t.status)}">${statusLabel(t.status)}</span>
        </div>`).join('');
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Errore caricamento ticket</h3>
        <p>${escHtml(err.message)}</p>
      </div>`;
    }
  }

  function statusLabel(s)  { return s === 'open' ? 'Aperto' : s === 'wip' ? 'In corso' : 'Chiuso'; }
  function priorityLabel(p){ return p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Bassa'; }
  function statusStyle(s) {
    if (s === 'open') return 'background:var(--orange-dim);color:var(--orange)';
    if (s === 'wip')  return 'background:var(--amber-dim);color:var(--amber)';
    return 'background:rgba(100,116,139,.15);color:var(--muted)';
  }

  return { build };
})();

/* ── SEARCH ──────────────────────────────────────────────────────────────── */
const Search = (() => {
  const STATIC = [
    { type:'page', icon:'🎫', title:'Apri un Ticket',  sub:'Segnala un problema',          tag:'Pagina', tagClass:'tag-o', action: () => SiteRouter.goPage('ticket', 2) },
    { type:'page', icon:'📖', title:'Documentazione',  sub:'Guide per tutti i plugin',     tag:'Pagina', tagClass:'tag-o', action: () => SiteRouter.goPage('docs', 1)   },
    { type:'page', icon:'🏠', title:'Home',             sub:'Torna alla pagina principale', tag:'Pagina', tagClass:'tag-o', action: () => SiteRouter.goPage('home', 0)   },
  ];
  let _debounce = null;
  let _results  = [];

  function open() {
    document.getElementById('search-overlay').classList.add('open');
    setTimeout(() => document.getElementById('search-input')?.focus(), 50);
  }
  function close() {
    document.getElementById('search-overlay').classList.remove('open');
    const inp = document.getElementById('search-input');
    if (inp) inp.value = '';
    _render([]);
  }
  function onInput(val) {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      if (!val || val.length < 2) { _render([]); return; }
      const pluginResults = PluginSystem.search(val);
      const staticResults = STATIC.filter(s =>
        s.title.toLowerCase().includes(val.toLowerCase()) ||
        s.sub.toLowerCase().includes(val.toLowerCase())
      );
      _render([...pluginResults, ...staticResults]);
    }, 120);
  }
  function _render(results) {
    _results = results;
    const cont = document.getElementById('search-results');
    if (!cont) return;
    if (!results.length) {
      const q = document.getElementById('search-input')?.value || '';
      cont.innerHTML = q.length >= 2
        ? `<div class="search-empty">Nessun risultato per "<strong>${escHtml(q)}</strong>"</div>`
        : '';
      return;
    }
    const groups = {};
    results.forEach(r => { if (!groups[r.type]) groups[r.type] = []; groups[r.type].push(r); });
    const typeLabel = { plugin:'Plugin', doc:'Documentazione', page:'Pagine' };
    cont.innerHTML = Object.entries(groups).map(([type, items]) => `
      <div class="search-section-label">${typeLabel[type] || type}</div>
      ${items.map(item => {
        const idx = results.indexOf(item);
        return `<div class="search-result-item" onclick="Search.pick(${idx})">
          <div class="search-result-icon">${item.icon}</div>
          <div class="search-result-info">
            <div class="search-result-title">${escHtml(item.title)}</div>
            <div class="search-result-sub">${escHtml(item.sub)}</div>
          </div>
          <span class="search-result-tag tag ${item.tagClass}">${item.tag}</span>
        </div>`;
      }).join('')}`).join('');
  }
  function pick(idx) {
    const r = _results[idx];
    if (r) { close(); r.action(); }
  }
  return { open, close, onInput, pick };
})();

/* ── TICKET FORM ─────────────────────────────────────────────────────────── */
const TicketForm = (() => {
  let _files = [];

  function selPrio(el, cls) {
    document.querySelectorAll('.prio-btn').forEach(b => b.className = 'prio-btn');
    el.classList.add(cls);
    el.dataset.selected = cls;
  }

  function handleFiles(input) {
    const newFiles = Array.from(input.files);
    _files = [..._files, ...newFiles].slice(0, 5);
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
        <span class="file-item-name">${escHtml(f.name)}</span>
        <span style="font-size:11px;color:var(--muted);font-family:var(--mono);flex-shrink:0">${fmtSize(f.size)}</span>
        <button class="file-item-remove" onclick="TicketForm.removeFile(${i})">✕</button>
      </div>`).join('');
  }

  function getPriority() {
    const sel = document.querySelector('.prio-btn.sel-l, .prio-btn.sel-m, .prio-btn.sel-h');
    if (!sel) return 'low';
    if (sel.classList.contains('sel-h')) return 'high';
    if (sel.classList.contains('sel-m')) return 'medium';
    return 'low';
  }

  async function submit() {
    const userField  = document.getElementById('ticket-user')?.value.trim();
    const pluginSel  = document.getElementById('ticket-plugin-sel');
    const plugin     = pluginSel?.value;
    const mcVersion  = document.getElementById('ticket-mc-version')?.value.trim();
    const title      = document.getElementById('ticket-title')?.value.trim();
    const desc       = document.getElementById('ticket-desc')?.value.trim();
    const priority   = getPriority();

    if (!userField)                       { showToast('⚠️ Inserisci il tuo username o email.'); return; }
    if (!plugin || plugin.startsWith('—')){ showToast('⚠️ Seleziona un plugin.'); return; }
    if (!title)                           { showToast('⚠️ Inserisci un titolo.'); return; }
    if (!desc)                            { showToast('⚠️ Inserisci una descrizione.'); return; }

    const btn = document.querySelector('#page-ticket .submit-btn');
    setLoading(btn, true, 'Invio in corso...');

    try {
      const userId = Auth.isLoggedIn() ? Auth.user().id : null;
      const ticket = await SupaTickets.create({
        userId,
        username:    userField,
        plugin,
        mcVersion:   mcVersion || null,
        title,
        description: desc,
        priority,
      });

      // Upload allegati se presenti
      if (_files.length > 0) {
        await Promise.allSettled(_files.map(f => SupaStorage.upload(ticket.id, f)));
      }

      // Reset form
      document.getElementById('ticket-user').value  = '';
      document.getElementById('ticket-title').value = '';
      document.getElementById('ticket-desc').value  = '';
      if (document.getElementById('ticket-mc-version'))
        document.getElementById('ticket-mc-version').value = '';
      pluginSel.selectedIndex = 0;
      const fileInput = document.querySelector('.file-upload-area input[type=file]');
      if (fileInput) fileInput.value = '';
      _files = [];
      renderFileList();
      document.querySelectorAll('.prio-btn').forEach(b => b.className = 'prio-btn');
      document.querySelector('.prio-btn')?.classList.add('sel-l');

      showToast('✓ Ticket #' + ticket.id + ' inviato! Risposta entro 4 ore.');

      // Aggiorna lista ticket se loggato
      if (Auth.isLoggedIn()) MyTickets.build();

    } catch (err) {
      showToast('❌ Errore: ' + err.message);
    } finally {
      setLoading(btn, false, 'Invia Ticket →');
    }
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

  return { selPrio, handleFiles, removeFile, submit };
})();

/* ── ADMIN ───────────────────────────────────────────────────────────────── */
const Admin = (() => {
  let _chatChannel = null;
  let _currentTicketId = null;

  function showLogin() {
    document.getElementById('public-site').style.display  = 'none';
    document.getElementById('admin-login').style.display  = '';
    document.getElementById('admin-shell').style.display  = 'none';
    setTimeout(() => document.getElementById('l-user')?.focus(), 60);
  }
  function showPublic() {
    document.getElementById('public-site').style.display  = '';
    document.getElementById('admin-login').style.display  = 'none';
    document.getElementById('admin-shell').style.display  = 'none';
  }
  async function showShell() {
    document.getElementById('public-site').style.display  = 'none';
    document.getElementById('admin-login').style.display  = 'none';
    document.getElementById('admin-shell').style.display  = 'flex';
    buildCharts();
    await loadDashboard();
    if (PluginSystem.getAll().length > 0) {
      PluginSystem.buildAdminPluginsTable();
      PluginSystem.buildAdminDlTable();
      PluginSystem.buildStatsDlTable();
      PluginSystem.updateHomeStats();
    }
    // Realtime: aggiorna tabella ticket su nuovi inserimenti
    SupaRealtime.subscribeTickets(
      () => loadTicketsTable(),
      () => loadTicketsTable()
    );
  }

  function doLogin() {
    const u   = document.getElementById('l-user').value.trim();
    const p   = document.getElementById('l-pass').value;
    const err = document.getElementById('login-err');
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
    SupaRealtime.unsubscribe();
    location.hash = '';
    showPublic();
  }
  function aPage(name, el) {
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    const pg = document.getElementById('ap-' + name);
    if (pg) pg.classList.add('active');
    if (el) el.classList.add('active');
    // Carica dati per la tab
    if (name === 'tickets') loadTicketsTable();
    if (name === 'stats')   loadStats();
  }

  // ── Dashboard ──
  async function loadDashboard() {
    try {
      const counts = await SupaTickets.getCounts();
      const openEl   = document.getElementById('adm-count-open');
      const wipEl    = document.getElementById('adm-count-wip');
      const closedEl = document.getElementById('adm-count-closed');
      if (openEl)   openEl.textContent   = counts.open;
      if (wipEl)    wipEl.textContent    = counts.wip;
      if (closedEl) closedEl.textContent = counts.closed;
      await loadTicketsPreview();
    } catch {}
  }

  async function loadTicketsPreview() {
    const tbody = document.getElementById('adm-recent-tickets');
    if (!tbody) return;
    try {
      const tickets = await SupaTickets.getAll({ status: 'all' });
      const recent  = tickets.slice(0, 5);
      if (!recent.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);text-align:center">Nessun ticket ancora</td></tr>`;
        return;
      }
      tbody.innerHTML = recent.map(t => `
        <tr>
          <td style="color:var(--muted);font-family:var(--mono)">#${t.id}</td>
          <td>${escHtml(t.plugin)}</td>
          <td>${escHtml(t.title)}</td>
          <td><span class="tag ${priorityTagClass(t.priority)}" style="font-size:10px">${priorityLabel(t.priority)}</span></td>
          <td><span class="sdot sdot-${t.status}"></span>${statusLabel(t.status)}</td>
          <td><button class="a-btn a-btn-orange" onclick="Admin.openTicketDetail(${t.id})">Apri</button></td>
        </tr>`).join('');
    } catch {}
  }

  // ── Tickets table ──
  async function loadTicketsTable(filterStatus = 'all') {
    const tbody = document.getElementById('adm-tickets-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--muted);text-align:center;padding:1.5rem">Caricamento...</td></tr>`;
    try {
      const tickets = await SupaTickets.getAll({ status: filterStatus });
      if (!tickets.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="color:var(--muted);text-align:center;padding:1.5rem">Nessun ticket trovato</td></tr>`;
        return;
      }
      tbody.innerHTML = tickets.map(t => `
        <tr data-status="${t.status}" data-id="${t.id}">
          <td style="color:var(--muted);font-family:var(--mono)">#${t.id}</td>
          <td>${escHtml(t.username)}</td>
          <td>${escHtml(t.plugin)}</td>
          <td>${escHtml(t.title)}</td>
          <td><span class="tag ${priorityTagClass(t.priority)}" style="font-size:10px">${priorityLabel(t.priority)}</span></td>
          <td data-col="stato"><span class="sdot sdot-${t.status}"></span>${statusLabel(t.status)}</td>
          <td style="color:var(--muted);font-size:11px">${timeAgo(t.created_at)}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="a-btn a-btn-orange" onclick="Admin.openTicketDetail(${t.id})">Apri</button>
            ${t.status !== 'closed' ? `<button class="a-btn a-btn-red" onclick="Admin.quickClose(${t.id},this)">Chiudi</button>` : ''}
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red);padding:1rem">${escHtml(err.message)}</td></tr>`;
    }
  }

  async function filterTickets(val) {
    await loadTicketsTable(val);
  }

  async function quickClose(id, btn) {
    btn.disabled = true;
    try {
      await SupaTickets.updateStatus(id, 'closed');
      const tr = btn.closest('tr');
      if (tr) {
        tr.dataset.status = 'closed';
        const statoTd = tr.querySelector('td[data-col="stato"]');
        if (statoTd) statoTd.innerHTML = `<span class="sdot sdot-closed"></span>Chiuso`;
        btn.remove();
      }
      showToast('Ticket chiuso.');
    } catch (err) {
      showToast('❌ ' + err.message);
      btn.disabled = false;
    }
  }

  // ── Ticket detail modal ──
  let _chatOpen = false;

  async function openTicketDetail(id) {
    _currentTicketId = id;
    document.getElementById('mt-title').textContent   = 'Ticket #' + id;
    document.getElementById('mt-plugin').textContent  = '...';
    document.getElementById('mt-status').textContent  = '...';
    document.getElementById('mt-desc').textContent    = 'Caricamento...';
    document.getElementById('modal-ticket').classList.add('open');
    _chatOpen = false;
    document.getElementById('chat-panel-wrap').style.display = 'none';
    document.getElementById('chat-toggle-btn').textContent   = 'Abilita Chat';

    try {
      const ticket   = await SupaTickets.getById(id);
      const messages = await SupaMessages.getForTicket(id);

      document.getElementById('mt-title').textContent   = `Ticket #${ticket.id} — ${ticket.username}`;
      document.getElementById('mt-plugin').textContent  = ticket.plugin;
      document.getElementById('mt-status').textContent  = statusLabel(ticket.status);
      document.getElementById('mt-desc').textContent    = ticket.description;
      document.getElementById('cp-title').textContent   = `Chat live · ${ticket.username}`;

      // Carica messaggi nella chat
      const msgs = document.getElementById('cp-msgs');
      msgs.innerHTML = messages.map(m => `
        <div class="cp-msg-${m.sender === 'admin' ? 'admin' : 'user'}">
          <div class="cp-bubble"></div>
          <div class="cp-time">${m.sender_name} · ${timeAgo(m.created_at)}</div>
        </div>`).join('');
      // Testo sanitizzato via textContent
      msgs.querySelectorAll('.cp-bubble').forEach((el, i) => {
        el.textContent = messages[i].body;
      });
      msgs.scrollTop = msgs.scrollHeight;

    } catch (err) {
      document.getElementById('mt-desc').textContent = 'Errore: ' + err.message;
    }
  }

  function toggleChat() {
    _chatOpen = !_chatOpen;
    document.getElementById('chat-panel-wrap').style.display = _chatOpen ? 'block' : 'none';
    document.getElementById('chat-toggle-btn').textContent   = _chatOpen ? 'Disabilita Chat' : 'Abilita Chat';

    if (_chatOpen && _currentTicketId) {
      // Attiva realtime sulla chat di questo ticket
      if (_chatChannel) SupaMessages.unsubscribe(_chatChannel);
      _chatChannel = SupaMessages.subscribe(_currentTicketId, msg => {
        if (msg.sender !== 'admin') appendChatMsg(msg);
      });
    }
  }

  function appendChatMsg(msg) {
    const m   = document.getElementById('cp-msgs');
    const div = document.createElement('div');
    div.className = `cp-msg-${msg.sender === 'admin' ? 'admin' : 'user'}`;
    const bubble = document.createElement('div');
    bubble.className   = 'cp-bubble';
    bubble.textContent = msg.body;
    const time = document.createElement('div');
    time.className   = 'cp-time';
    time.textContent = `${msg.sender_name} · adesso`;
    div.appendChild(bubble);
    div.appendChild(time);
    m.appendChild(div);
    m.scrollTop = m.scrollHeight;
  }

  async function sendTicketReply() {
    const v = document.getElementById('mt-reply').value.trim();
    if (!v || !_currentTicketId) return;
    try {
      await SupaMessages.send(_currentTicketId, {
        sender:     'admin',
        senderName: 'Admin',
        body:       v,
      });
      document.getElementById('mt-reply').value = '';
      showToast('✓ Risposta inviata!');
    } catch (err) {
      showToast('❌ ' + err.message);
    }
  }

  async function changeTicketStatus(st) {
    if (!_currentTicketId) return;
    try {
      await SupaTickets.updateStatus(_currentTicketId, st);
      document.getElementById('mt-status').textContent = statusLabel(st);
      showToast('Ticket segnato come: ' + statusLabel(st));
      loadTicketsTable();
    } catch (err) {
      showToast('❌ ' + err.message);
    }
  }

  async function sendChatMsg() {
    const inp = document.getElementById('cp-inp');
    const txt = inp.value.trim();
    if (!txt || !_currentTicketId) return;
    inp.value = '';
    try {
      const msg = await SupaMessages.send(_currentTicketId, {
        sender:     'admin',
        senderName: 'Admin',
        body:       txt,
      });
      appendChatMsg(msg);
    } catch (err) {
      showToast('❌ ' + err.message);
    }
  }

  // ── Stats ──
  async function loadStats() {
    try {
      const counts = await SupaTickets.getCounts();
      const total  = counts.open + counts.wip + counts.closed;
      const rateEl = document.getElementById('adm-stat-resolution');
      if (rateEl && total > 0)
        rateEl.textContent = Math.round((counts.closed / total) * 100) + '%';
    } catch {}
  }

  // ── Users filter ──
  function filterUsers(q) {
    document.querySelectorAll('#users-table tr:not(:first-child)').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  }

  // ── Charts ──
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

  function checkRoute() {
    if (location.hash === '#/admin') {
      if (sessionStorage.getItem('six_admin')) showShell();
      else showLogin();
    }
  }

  return {
    showLogin, showPublic,
    doLogin, doLogout,
    aPage, filterTickets, filterUsers,
    openTicketDetail, toggleChat, quickClose,
    sendTicketReply, changeTicketStatus, sendChatMsg,
    buildCharts, checkRoute, loadDashboard,
  };
})();

/* ── UTILS ───────────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'adesso';
  if (mins  < 60) return `${mins} min fa`;
  if (hours < 24) return `${hours}h fa`;
  return `${days} giorni fa`;
}

function statusLabel(s)  { return s === 'open' ? 'Aperto' : s === 'wip' ? 'In corso' : 'Chiuso'; }
function priorityLabel(p){ return p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Bassa'; }
function priorityTagClass(p) {
  return p === 'high' ? '' : p === 'medium' ? 'tag-a' : 'tag-o';
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled      = loading;
  btn.textContent   = label;
  btn.style.opacity = loading ? '0.7' : '1';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

/* ── KEYBOARD ────────────────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault(); Search.open();
  }
  if (e.key === 'Escape') {
    const openModals = [...document.querySelectorAll('.modal-bg.open')];
    if (openModals.length) openModals[openModals.length - 1].classList.remove('open');
    else { Search.close(); UserMenu.close(); }
  }
});
document.addEventListener('click', e => {
  const wrap = document.getElementById('user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) UserMenu.close();
});
document.getElementById('search-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'search-overlay') Search.close();
});

/* ── BOOT ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await Auth.load();
  await PluginSystem.init();
  Admin.checkRoute();
  window.addEventListener('hashchange', Admin.checkRoute);
});
