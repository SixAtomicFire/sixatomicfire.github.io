/* ══════════════════════════════════════
   SIXsPlugins — plugins.js
   Carica i JSON dei plugin e renderizza
   home, docs grid, doc detail pages.
   ══════════════════════════════════════ */

const PluginSystem = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  let _plugins = [];
  let _currentPlugin = null;
  let _currentSection = 'overview';

  // ── Loader ─────────────────────────────────────────────────────────────

  /**
   * Carica index.json poi ogni plugin JSON.
   * Restituisce la lista di plugin pronti.
   */
  async function loadAll() {
    try {
      const idxRes = await fetch('plugins/index.json');
      const idx = await idxRes.json();

      const results = await Promise.allSettled(
        idx.plugins.map(id => fetch(`plugins/${id}.json`).then(r => r.json()))
      );

      _plugins = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(p => p.visible !== false);

      // Fetch download counts from Modrinth for plugins that have a modrinthId
      await fetchDownloads();

      return _plugins;
    } catch (err) {
      console.error('[PluginSystem] Errore caricamento plugin:', err);
      return [];
    }
  }

  /**
   * Recupera i download da Modrinth per i plugin con modrinthId.
   * In produzione questo va proxato lato server per evitare CORS.
   * Per ora usiamo dati mock con possibilità di fetch reale.
   */
  async function fetchDownloads() {
    const MOCK = {
      'AANobbyd': 12480,
    };

    // Fallback download numbers per i plugin senza modrinthId
    const FALLBACK = [8320, 21050, 5640, 9870, 3210, 6780, 14330, 4120, 7890, 11200];
    let fallbackIdx = 0;

    for (const p of _plugins) {
      if (p.modrinthId && MOCK[p.modrinthId] !== undefined) {
        p.downloads = MOCK[p.modrinthId];
      } else if (p.modrinthId) {
        // Tentativo di fetch reale (funziona se il server ha CORS o proxy)
        try {
          const res = await fetch(`https://api.modrinth.com/v2/project/${p.modrinthId}`, {
            headers: { 'User-Agent': 'SIXsPlugins-Site/1.0' }
          });
          if (res.ok) {
            const data = await res.json();
            p.downloads = data.downloads || 0;
          } else {
            p.downloads = FALLBACK[fallbackIdx++ % FALLBACK.length];
          }
        } catch {
          p.downloads = FALLBACK[fallbackIdx++ % FALLBACK.length];
        }
      } else {
        p.downloads = FALLBACK[fallbackIdx++ % FALLBACK.length];
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function fmtNum(n) {
    if (!n) return '0';
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  }

  function totalDownloads() {
    return _plugins.reduce((s, p) => s + (p.downloads || 0), 0);
  }

  function getAll() { return _plugins; }

  function getById(id) { return _plugins.find(p => p.id === id); }

  // ── Content renderer ───────────────────────────────────────────────────

  /**
   * Trasforma un array di blocchi content (dal JSON) in HTML.
   */
  function renderContent(blocks) {
    if (!blocks || !blocks.length) return '<p class="doc-p">Nessun contenuto disponibile.</p>';

    return blocks.map(block => {
      switch (block.type) {

        case 'paragraph':
          return `<p class="doc-p">${block.text}</p>`;

        case 'heading':
          return `<div class="doc-h2">${block.text}</div>`;

        case 'subheading':
          return `<div class="doc-h3">${block.text}</div>`;

        case 'callout':
          return `<div class="doc-callout ${block.style || 'info'}">
            <strong>${block.title || ''}</strong>${block.text}
          </div>`;

        case 'code':
          const lines = (block.lines || []).map(l => {
            const comment = l.comment ? ` <span class="cm">  # ${l.comment}</span>` : '';
            const cls = l.type === 'key' ? 'ck' : l.type === 'value' ? 'cv' : l.type === 'string' ? 'cs' : '';
            return cls
              ? `<span class="${cls}">${l.text}</span>${comment}`
              : `${l.text}${comment}`;
          }).join('\n');
          return `<div class="doc-code">${lines}</div>`;

        case 'table':
          const headers = (block.headers || []).map(h => `<th>${h}</th>`).join('');
          const rows = (block.rows || []).map(row =>
            `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
          ).join('');
          return `<table class="doc-table"><tr>${headers}</tr>${rows}</table>`;

        case 'list':
          const items = (block.items || []).map(i => `• ${i}`).join('<br>');
          return `<p class="doc-p">${items}</p>`;

        case 'faq':
          return (block.items || []).map(item => `
            <div class="doc-faq-item">
              <div class="doc-faq-q" onclick="PluginSystem.toggleFaq(this)">
                ${item.question}
                <span class="arrow">▼</span>
              </div>
              <div class="doc-faq-a">${item.answer}</div>
            </div>`).join('');

        case 'changelog':
          return (block.entries || []).map(entry => `
            <div class="changelog-item">
              <div class="changelog-ver">${entry.version}</div>
              <div class="changelog-date">${entry.date}</div>
              ${(entry.changes || []).map(c => `<div class="changelog-entry">${c}</div>`).join('')}
            </div>`).join('');

        case 'modrinth':
          return block.id
            ? `<a class="modrinth-badge" href="https://modrinth.com/plugin/${block.id}" target="_blank">⬇ Scarica su Modrinth</a>`
            : '';

        default:
          return '';
      }
    }).join('');
  }

  // ── Home plugin list ───────────────────────────────────────────────────

  function buildHomePlugins() {
    const cont = document.getElementById('home-plugin-list');
    if (!cont) return;

    cont.innerHTML = _plugins.map(p => `
      <div class="plugin-row" onclick="PluginSystem.openDoc('${p.id}')">
        <div class="plugin-row-icon">${p.icon}</div>
        <div class="plugin-row-info">
          <div class="plugin-row-name">${p.name}</div>
          <div class="plugin-row-desc">${p.description}</div>
        </div>
        <div class="plugin-row-right">
          <div class="plugin-row-tags">
            <span class="tag tag-o">${p.version}</span>
            <span class="tag ${p.categoryTag}">${p.category}</span>
          </div>
          <div class="dl-count">⬇ <span>${fmtNum(p.downloads)}</span> download</div>
        </div>
      </div>`).join('');
  }

  // ── Stats bar ──────────────────────────────────────────────────────────

  function updateHomeStats() {
    const el = document.getElementById('home-total-dl');
    if (el) el.textContent = fmtNum(totalDownloads());

    const adminEl = document.getElementById('adm-dl-total');
    if (adminEl) adminEl.textContent = fmtNum(totalDownloads());

    const statsEl = document.getElementById('stats-dl-val');
    if (statsEl) statsEl.textContent = fmtNum(totalDownloads());
  }

  // ── Docs grid ──────────────────────────────────────────────────────────

  function buildDocsGrid() {
    const cont = document.getElementById('docs-grid');
    if (!cont) return;

    cont.innerHTML = _plugins.map(p => `
      <div class="doc-card" onclick="PluginSystem.openDoc('${p.id}')">
        <div class="doc-head">
          <div class="doc-icon">${p.icon}</div>
          <div>
            <div class="doc-name">${p.name}</div>
            <div class="doc-ver">${p.version}</div>
          </div>
        </div>
        <div class="doc-desc">${p.description}</div>
        <div class="doc-meta">
          <div class="doc-dl">⬇ <span>${fmtNum(p.downloads)}</span> download</div>
          <div class="doc-arrow">Leggi docs →</div>
        </div>
      </div>`).join('');
  }

  // ── Ticket select ──────────────────────────────────────────────────────

  function buildTicketSelect() {
    const sel = document.getElementById('ticket-plugin-sel');
    if (!sel) return;
    _plugins.forEach(p => {
      const o = document.createElement('option');
      o.textContent = p.name;
      sel.appendChild(o);
    });
  }

  // ── Admin tables ───────────────────────────────────────────────────────

  function buildAdminPluginsTable() {
    const t = document.getElementById('adm-plugins-table');
    if (!t) return;
    const openTickets = { shopeasy: 2, antigriefpro: 1 };
    t.innerHTML = `<tr>
      <th>Plugin</th><th>Versione</th><th>Categoria</th>
      <th>Download Modrinth</th><th>Ticket aperti</th><th>Stato</th><th>Azioni</th>
    </tr>` + _plugins.map(p => `<tr>
      <td><strong>${p.icon} ${p.name}</strong></td>
      <td style="font-family:var(--mono);font-size:11px">${p.version}</td>
      <td><span class="tag ${p.categoryTag}">${p.category}</span></td>
      <td style="font-family:var(--mono);color:var(--orange)">${fmtNum(p.downloads)}</td>
      <td>${openTickets[p.id] || 0}</td>
      <td><span class="sdot sdot-online"></span>Visibile</td>
      <td style="display:flex;gap:6px">
        <button class="a-btn">Modifica</button>
        <button class="a-btn a-btn-red">Nascondi</button>
      </td>
    </tr>`).join('');
  }

  function buildAdminDlTable() {
    const t = document.getElementById('adm-dl-table');
    if (!t) return;
    const openTickets = { shopeasy: 2, antigriefpro: 1 };
    t.innerHTML = `<tr>
      <th>Plugin</th><th>Versione</th><th>Download</th><th>Ticket aperti</th><th>Stato</th>
    </tr>` + _plugins.map(p => `<tr>
      <td>${p.icon} ${p.name}</td>
      <td style="font-family:var(--mono);font-size:11px">${p.version}</td>
      <td style="font-family:var(--mono);color:var(--orange)">${fmtNum(p.downloads)}</td>
      <td>${openTickets[p.id] || 0}</td>
      <td><span class="sdot sdot-online"></span>Online</td>
    </tr>`).join('');
  }

  function buildStatsDlTable() {
    const t = document.getElementById('stats-dl-table');
    if (!t) return;
    const total = totalDownloads();
    t.innerHTML = `<tr><th>Plugin</th><th>Download</th><th>% totale</th></tr>` +
      _plugins.map(p => `<tr>
        <td>${p.icon} ${p.name}</td>
        <td style="font-family:var(--mono);color:var(--orange)">${fmtNum(p.downloads)}</td>
        <td style="color:var(--muted)">${total ? Math.round((p.downloads / total) * 100) + '%' : '—'}</td>
      </tr>`).join('');
  }

  function buildAddPluginSelect() {
    const sel = document.getElementById('modal-plugin-cat');
    // already static in HTML
  }

  // ── Search index ───────────────────────────────────────────────────────

  /**
   * Restituisce risultati di ricerca per query q.
   * Cerca in nome, descrizione, categoria, e titoli sezioni docs.
   */
  function search(q) {
    if (!q || q.length < 2) return [];
    const lq = q.toLowerCase();
    const results = [];

    for (const p of _plugins) {
      const nameMatch = p.name.toLowerCase().includes(lq);
      const descMatch = p.description.toLowerCase().includes(lq);
      const catMatch  = p.category.toLowerCase().includes(lq);

      if (nameMatch || descMatch || catMatch) {
        results.push({
          type: 'plugin',
          icon: p.icon,
          title: p.name,
          sub: p.description,
          tag: p.category,
          tagClass: p.categoryTag,
          action: () => openDoc(p.id)
        });
      }

      // Cerca anche nelle sezioni docs
      if (p.docs) {
        for (const [sKey, section] of Object.entries(p.docs)) {
          if (section.title && section.title.toLowerCase().includes(lq)) {
            results.push({
              type: 'doc',
              icon: section.icon || '📄',
              title: `${p.name} — ${section.title}`,
              sub: `Sezione documentazione`,
              tag: 'Docs',
              tagClass: 'tag-b',
              action: () => { openDoc(p.id); setTimeout(() => switchSection(sKey), 50); }
            });
          }
          // Cerca nel testo dei contenuti
          if (section.content) {
            const text = JSON.stringify(section.content).toLowerCase();
            if (text.includes(lq) && !results.find(r => r.title === `${p.name} — ${section.title}`)) {
              results.push({
                type: 'doc',
                icon: section.icon || '📄',
                title: `${p.name} — ${section.title}`,
                sub: `Contiene "${q}"`,
                tag: 'Docs',
                tagClass: 'tag-b',
                action: () => { openDoc(p.id); setTimeout(() => switchSection(sKey), 50); }
              });
            }
          }
        }
      }
    }

    return results.slice(0, 10);
  }

  // ── Doc detail ─────────────────────────────────────────────────────────

  const NAV_SECTIONS_ORDER = ['overview','install','config','commands','faq','changelog'];

  function openDoc(id) {
    _currentPlugin = getById(id);
    if (!_currentPlugin) return;
    _currentSection = 'overview';
    renderDocPage();
    if (window.SiteRouter) SiteRouter.goPage('doc-detail', -1);
  }

  function renderDocPage() {
    const p = _currentPlugin;
    const sections = p.docs || {};

    // Build sidebar nav — use doc keys in preferred order, then any extras
    const orderedKeys = [
      ...NAV_SECTIONS_ORDER.filter(k => sections[k]),
      ...Object.keys(sections).filter(k => !NAV_SECTIONS_ORDER.includes(k))
    ];

    const sidebarHTML = `
      <button class="doc-back" onclick="SiteRouter.goPage('docs',1)">← Torna alle Docs</button>
      <div class="doc-sidebar-plugin">
        <div class="doc-sidebar-plugin-icon">${p.icon}</div>
        <div>
          <div class="doc-sidebar-plugin-name">${p.name}</div>
          <div class="doc-sidebar-plugin-ver">${p.version}</div>
        </div>
      </div>
      <div class="doc-nav-section">Sezioni</div>
      ${orderedKeys.map(k => `
        <button class="doc-nav-item${k === _currentSection ? ' active' : ''}"
          onclick="PluginSystem.switchSection('${k}')">
          ${sections[k].icon || '📄'} ${sections[k].title || k}
        </button>`).join('')}
      ${p.modrinthId ? `
        <div class="doc-nav-section">Download</div>
        <a class="modrinth-badge" href="https://modrinth.com/plugin/${p.modrinthId}" target="_blank"
           style="margin:.25rem .5rem;font-size:11px">
          ⬇ Modrinth
        </a>` : ''}
    `;

    const currentSec = sections[_currentSection] || {};
    const contentHTML = `
      <div class="doc-content-header">
        <div class="doc-content-title">${p.icon} <span>${p.name}</span></div>
        <div style="font-size:13px;color:var(--muted);margin-top:.4rem">${p.description}</div>
        <div class="doc-content-meta">
          <div class="doc-content-meta-item">Versione: <strong>${p.version}</strong></div>
          <div class="doc-content-meta-item">Richiede: <strong>${p.requiresVersion}</strong></div>
          <div class="doc-content-meta-item">Dipendenze: <strong>${p.dependencies}</strong></div>
          <div class="doc-content-meta-item" style="color:var(--orange)">
            ⬇ <strong>${fmtNum(p.downloads)}</strong> download
          </div>
          ${p.modrinthId
            ? `<a class="modrinth-badge" href="https://modrinth.com/plugin/${p.modrinthId}" target="_blank"
                 style="padding:4px 10px;font-size:11px">Modrinth</a>`
            : `<span class="tag tag-o" style="font-size:10px">Solo su SIXsPlugins</span>`}
        </div>
      </div>
      <div id="doc-section-content">
        ${renderContent(currentSec.content)}
      </div>
    `;

    const sidebar = document.getElementById('doc-sidebar');
    const content = document.getElementById('doc-content');
    if (sidebar) sidebar.innerHTML = sidebarHTML;
    if (content) content.innerHTML = contentHTML;
  }

  function switchSection(key) {
    if (!_currentPlugin) return;
    _currentSection = key;
    const sec = (_currentPlugin.docs || {})[key] || {};

    const contentEl = document.getElementById('doc-section-content');
    if (contentEl) contentEl.innerHTML = renderContent(sec.content);

    document.querySelectorAll('.doc-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.doc-nav-item').forEach(b => {
      if (b.textContent.includes(sec.title || key)) b.classList.add('active');
    });

    const docContent = document.getElementById('doc-content');
    if (docContent) docContent.scrollTop = 0;
  }

  function toggleFaq(el) {
    el.classList.toggle('open');
    const a = el.nextElementSibling;
    if (a) a.style.display = a.style.display === 'block' ? 'none' : 'block';
  }

  // ── Init ───────────────────────────────────────────────────────────────

  async function init() {
    await loadAll();
    buildHomePlugins();
    updateHomeStats();
    buildDocsGrid();
    buildTicketSelect();
    buildAdminPluginsTable();
    buildAdminDlTable();
    buildStatsDlTable();
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    init,
    getAll,
    getById,
    search,
    fmtNum,
    totalDownloads,
    openDoc,
    switchSection,
    toggleFaq,
    buildAdminPluginsTable,
    buildAdminDlTable,
    buildStatsDlTable,
    updateHomeStats,
  };

})();
