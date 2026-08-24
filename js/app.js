/* ============================================================
   RiskLedger — vanilla JS build (no framework, no build step)
   Persistence: browser localStorage (this device / this browser only)
   AI advisor: calls the Anthropic API directly from the browser
   using a key you provide in Settings. That means the key sits in
   this browser's localStorage and is visible in Network requests —
   fine for a local personal tool, NOT safe for a deployed/shared app.
   For production, proxy this call through your own backend instead.
   ============================================================ */

/* ---------------- Icons (minimal inline SVG set) ---------------- */
const ICONS = {
  shield: '<path d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M12 8v5"/><circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5c1.7.4 3 2 3 3.9 0 1.9-1.3 3.5-3 3.9"/><path d="M21 20c0-2.8-2-5.1-4.7-5.8"/>',
  sparkles: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M19 6l-.8 13.2A2 2 0 0 1 16.2 21H7.8a2 2 0 0 1-2-1.8L5 6"/><path d="M10 11v6M14 11v6"/>',
  loader: '<circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l3 3M14 9l2.5 2.5"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M12 3 2 20h20z" /><path d="M12 10v4"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l-5-5 5-5"/><path d="M15 12H3"/>',
  userplus: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M19 8v5M16.5 10.5h5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h6M9 7h6"/>'
};
function icon(name, size) {
  size = size || 16;
  return '<svg class="icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||'')+'</svg>';
}

/* ---------------- Constants ---------------- */
const ASSET_CATEGORIES = ["Hardware","Software","Data","People","Facility","Third-Party / Vendor","Network"];
const STATUSES = ["Open","In Treatment","Mitigated","Accepted","Closed"];
const SCALE = [1,2,3,4,5];
const SCALE_LABELS = {
  likelihood: {1:"Rare",2:"Unlikely",3:"Possible",4:"Likely",5:"Almost Certain"},
  impact: {1:"Negligible",2:"Minor",3:"Moderate",4:"Major",5:"Severe"}
};

/* ---------------- Storage ---------------- */
const LS = {
  get(key, fallback){ try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e){ return fallback; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

let state = {
  org: LS.get('rl_org', null),
  admins: LS.get('rl_admins', []),
  risks: LS.get('rl_risks', []),
  session: LS.get('rl_session', null),
  apiKey: LS.get('rl_apikey', ''),
  view: 'register',
  matrixFilter: null,
  modal: null,
  toast: null
};

function persistOrg(){ LS.set('rl_org', state.org); }
function persistAdmins(){ LS.set('rl_admins', state.admins); }
function persistRisks(){ LS.set('rl_risks', state.risks); }
function persistSession(){ LS.set('rl_session', state.session); }
function persistApiKey(){ LS.set('rl_apikey', state.apiKey); }

/* ---------------- Helpers ---------------- */
function esc(str){ const d = document.createElement('div'); d.textContent = (str===undefined||str===null) ? '' : String(str); return d.innerHTML; }
function uid(){ return Math.random().toString(36).slice(2,10); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function levelForScore(score){
  if (score >= 16) return {name:"Critical", key:"critical"};
  if (score >= 10) return {name:"High", key:"high"};
  if (score >= 5) return {name:"Medium", key:"medium"};
  return {name:"Low", key:"low"};
}
function nextRiskId(){
  const nums = state.risks.map(r => parseInt((r.id||'').replace('RSK-',''),10)).filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'RSK-' + String(max+1).padStart(3,'0');
}
function statusClass(status){ return 'pill-' + status.toLowerCase().replace(/\s+/g,'-'); }

function showToast(msg, tone){
  tone = tone || 'ok';
  const id = uid();
  state.toast = {msg, tone, id};
  renderToast();
  setTimeout(() => { if (state.toast && state.toast.id === id) { state.toast = null; renderToast(); } }, 3200);
}
function renderToast(){
  const root = document.getElementById('toast-root');
  if (!state.toast) { root.innerHTML = ''; return; }
  const t = state.toast;
  root.innerHTML = '<div class="toast toast-'+t.tone+'">' + icon(t.tone==='err'?'alert':'check',15) + '<span>'+esc(t.msg)+'</span></div>';
}

/* ---------------- Root render ---------------- */
function renderApp(){
  const app = document.getElementById('app');
  if (!state.org) {
    app.innerHTML = renderSetup();
    attachSetupHandlers();
  } else if (!state.session) {
    app.innerHTML = renderLogin();
    attachLoginHandlers();
  } else {
    app.innerHTML = renderDashboard();
    attachDashboardHandlers();
  }
}

/* ---------------- Setup ---------------- */
function renderSetup(){
  return `
  <div class="auth-wrap">
    <div class="auth-brand">
      <div class="brand-mark">${icon('shield',22)}</div>
      <div>
        <div class="brand-name">RiskLedger</div>
        <div class="brand-sub">ISO/IEC 27001 risk register &amp; matrix</div>
      </div>
    </div>
    <form class="auth-card" id="setup-form">
      <div class="auth-eyebrow">SET UP · 01 OF 01</div>
      <h1>Create your organization</h1>
      <p class="auth-hint">This creates the first administrator account for your organization's risk register.</p>

      <label class="field"><span class="field-label">${icon('building',15)}Organization name</span>
        <input name="orgName" placeholder="Acme Holdings Ltd." autofocus required />
      </label>
      <label class="field"><span class="field-label">${icon('users',15)}Admin username</span>
        <input name="username" placeholder="e.g. j.doe" required />
      </label>
      <label class="field"><span class="field-label">${icon('key',15)}Password</span>
        <input type="password" name="password" placeholder="••••••••" required />
      </label>
      <label class="field"><span class="field-label">${icon('key',15)}Confirm password</span>
        <input type="password" name="confirm" placeholder="••••••••" required />
      </label>

      <div id="setup-error"></div>

      <button type="submit" class="btn btn-primary btn-block">Create organization ${icon('chevron',16)}</button>
      <p class="auth-footnote">Demo-grade storage: credentials are kept in this browser's local storage, not a real
      authentication backend. Don't reuse a real password here.</p>
    </form>
  </div>`;
}
function attachSetupHandlers(){
  document.getElementById('setup-form').addEventListener('submit', function(e){
    e.preventDefault();
    const f = new FormData(e.target);
    const orgName = (f.get('orgName')||'').trim();
    const username = (f.get('username')||'').trim();
    const password = f.get('password')||'';
    const confirm = f.get('confirm')||'';
    const errBox = document.getElementById('setup-error');
    if (!orgName || !username || !password) { errBox.innerHTML = '<div class="auth-error">All fields are required.</div>'; return; }
    if (password !== confirm) { errBox.innerHTML = '<div class="auth-error">Passwords don&#39;t match.</div>'; return; }
    if (password.length < 4) { errBox.innerHTML = '<div class="auth-error">Password must be at least 4 characters.</div>'; return; }

    state.org = { name: orgName };
    state.admins = [{ username, password }];
    state.session = username;
    persistOrg(); persistAdmins(); persistSession();
    renderApp();
    showToast('Organization "'+orgName+'" created');
  });
}

/* ---------------- Login ---------------- */
function renderLogin(){
  return `
  <div class="auth-wrap">
    <div class="auth-brand">
      <div class="brand-mark">${icon('shield',22)}</div>
      <div>
        <div class="brand-name">RiskLedger</div>
        <div class="brand-sub">${esc(state.org.name)}</div>
      </div>
    </div>
    <form class="auth-card" id="login-form">
      <div class="auth-eyebrow">SIGN IN</div>
      <h1>Welcome back</h1>
      <p class="auth-hint">Sign in with your administrator credentials.</p>

      <label class="field"><span class="field-label">${icon('users',15)}Username</span>
        <input name="username" autofocus placeholder="e.g. j.doe" required />
      </label>
      <label class="field"><span class="field-label">${icon('key',15)}Password</span>
        <input type="password" name="password" placeholder="••••••••" required />
      </label>

      <div id="login-error"></div>

      <button type="submit" class="btn btn-primary btn-block">${icon('login',16)} Sign in</button>
    </form>
  </div>`;
}
function attachLoginHandlers(){
  document.getElementById('login-form').addEventListener('submit', function(e){
    e.preventDefault();
    const f = new FormData(e.target);
    const username = (f.get('username')||'').trim();
    const password = f.get('password')||'';
    const match = state.admins.find(a => a.username === username && a.password === password);
    const errBox = document.getElementById('login-error');
    if (!match) { errBox.innerHTML = '<div class="auth-error">Incorrect username or password.</div>'; return; }
    state.session = match.username;
    persistSession();
    renderApp();
    showToast('Welcome back, '+match.username);
  });
}

/* ---------------- Dashboard shell ---------------- */
function renderDashboard(){
  const u = state.session;
  return `
  <div class="dash">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-mark small">${icon('shield',17)}</div>
        <div>
          <div class="brand-name small">RiskLedger</div>
          <div class="brand-sub tiny">${esc(state.org.name)}</div>
        </div>
      </div>
      <nav class="nav">
        <button class="nav-item ${state.view==='register'?'active':''}" data-view="register">${icon('clipboard',16)}<span>Risk Register</span></button>
        <button class="nav-item ${state.view==='matrix'?'active':''}" data-view="matrix">${icon('grid',16)}<span>Risk Matrix</span></button>
        <button class="nav-item ${state.view==='team'?'active':''}" data-view="team">${icon('users',16)}<span>Team</span></button>
        <button class="nav-item ${state.view==='settings'?'active':''}" data-view="settings">${icon('key',16)}<span>Settings</span></button>
      </nav>
      <button class="btn btn-primary btn-block sidebar-add" id="add-risk-btn">${icon('plus',16)} Add risk</button>
      <div class="sidebar-user">
        <div class="user-chip"><div class="user-avatar">${esc(u.slice(0,1).toUpperCase())}</div><span>${esc(u)}</span></div>
        <button class="icon-btn" id="logout-btn" title="Log out">${icon('logout',16)}</button>
      </div>
    </aside>
    <main class="main">
      <div id="view-content">${renderViewContent()}</div>
    </main>
  </div>
  ${state.modal ? renderModal() : ''}
  `;
}

function renderViewContent(){
  if (state.view === 'register') return renderRegisterView();
  if (state.view === 'matrix') return renderMatrixView();
  if (state.view === 'team') return renderTeamView();
  if (state.view === 'settings') return renderSettingsView();
  return '';
}

function attachDashboardHandlers(){
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => { state.view = btn.dataset.view; renderApp(); });
  });
  document.getElementById('add-risk-btn').addEventListener('click', () => { openRiskForm(null); });
  document.getElementById('logout-btn').addEventListener('click', () => {
    state.session = null; persistSession(); renderApp();
  });

  if (state.view === 'register') attachRegisterHandlers();
  if (state.view === 'matrix') attachMatrixHandlers();
  if (state.view === 'team') attachTeamHandlers();
  if (state.view === 'settings') attachSettingsHandlers();

  if (state.modal) attachModalHandlers();
}

/* ---------------- Register view ---------------- */
function filteredRisks(){
  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('status-filter')?.value || 'All';
  return state.risks.filter(r => {
    if (state.matrixFilter && (r.likelihood !== state.matrixFilter.likelihood || r.impact !== state.matrixFilter.impact)) return false;
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (query) {
      const hay = [r.id, r.asset, r.threat, r.vulnerability, r.owner].join(' ').toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  }).sort((a,b) => b.score - a.score);
}

function renderRegisterView(){
  const risks = state.risks;
  return `
  <div class="view">
    <div class="view-header">
      <div>
        <div class="eyebrow">LEDGER</div>
        <h1>Risk register</h1>
        <p>${risks.length} risk${risks.length===1?'':'s'} on file</p>
      </div>
      <div><button class="btn btn-primary" id="add-risk-btn-2">${icon('plus',15)} Add risk</button></div>
    </div>

    <div class="toolbar">
      <div class="search-box">${icon('search',14)}<input id="search-input" placeholder="Search asset, threat, owner…" /></div>
      <select id="status-filter">
        <option>All</option>
        ${STATUSES.map(s => `<option>${s}</option>`).join('')}
      </select>
      ${state.matrixFilter ? `<button class="chip chip-active" id="clear-filter-btn">Matrix: L${state.matrixFilter.likelihood} × I${state.matrixFilter.impact} ${icon('x',12)}</button>` : ''}
    </div>

    <div id="table-container">${renderTableSection()}</div>
  </div>`;
}

function renderTableSection(){
  const risks = filteredRisksSafe();
  if (risks.length === 0) {
    const noneAtAll = state.risks.length === 0;
    return `<div class="empty">
      ${icon('clipboard',26)}
      <h3>${noneAtAll ? 'No risks logged yet' : 'No risks match your filters'}</h3>
      <p>${noneAtAll ? "Add the first entry to start building the register." : "Try clearing a filter or search term."}</p>
      ${noneAtAll ? `<button class="btn btn-primary" id="empty-add-btn">${icon('plus',15)} Add risk</button>` : ''}
    </div>`;
  }
  return `<div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>Asset</th><th>Threat / Vulnerability</th><th>L</th><th>I</th><th>Score</th><th>Level</th><th>Owner</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${risks.map(r => {
        const lvl = levelForScore(r.score);
        return `<tr data-id="${esc(r.id)}">
          <td class="mono">${esc(r.id)}</td>
          <td>${esc(r.asset)}</td>
          <td class="truncate">${esc(r.threat)}</td>
          <td class="mono center">${r.likelihood}</td>
          <td class="mono center">${r.impact}</td>
          <td class="mono center">${r.score}</td>
          <td><span class="badge badge-${lvl.key}">${lvl.name}</span></td>
          <td>${esc(r.owner) || '—'}</td>
          <td><span class="pill ${statusClass(r.status)}">${esc(r.status)}</span></td>
          <td>${icon('chevron',15)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}
function filteredRisksSafe(){
  try { return filteredRisks(); } catch(e){ return state.risks; }
}

function attachRegisterHandlers(){
  document.getElementById('add-risk-btn-2')?.addEventListener('click', () => openRiskForm(null));
  document.getElementById('empty-add-btn')?.addEventListener('click', () => openRiskForm(null));
  document.getElementById('clear-filter-btn')?.addEventListener('click', () => { state.matrixFilter = null; renderApp(); });
  document.getElementById('status-filter')?.addEventListener('change', refreshTable);
  document.getElementById('search-input')?.addEventListener('input', refreshTable);
  attachTableRowHandlers();
}
function refreshTable(){
  document.getElementById('table-container').innerHTML = renderTableSection();
  document.getElementById('empty-add-btn')?.addEventListener('click', () => openRiskForm(null));
  attachTableRowHandlers();
}
function attachTableRowHandlers(){
  document.querySelectorAll('#table-container tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      const risk = state.risks.find(r => r.id === row.dataset.id);
      if (risk) openRiskDetail(risk.id);
    });
  });
}

/* ---------------- Matrix view ---------------- */
function renderMatrixView(){
  const grid = {};
  SCALE.forEach(l => SCALE.forEach(i => grid[l+'-'+i] = []));
  state.risks.forEach(r => { const k = r.likelihood+'-'+r.impact; if (grid[k]) grid[k].push(r); });

  const rowsHtml = [5,4,3,2,1].map(l => {
    const cells = SCALE.map(i => {
      const score = l*i;
      const lvl = levelForScore(score);
      const count = grid[l+'-'+i].length;
      return `<button class="matrix-cell cell-${lvl.key}" data-l="${l}" data-i="${i}" title="Likelihood ${l} × Impact ${i} = ${score}">
        <span class="cell-score">${score}</span>${count>0?`<span class="cell-count">${count}</span>`:''}
      </button>`;
    }).join('');
    return `<div class="matrix-row"><div class="matrix-row-label">${l}</div>${cells}</div>`;
  }).join('');

  return `
  <div class="view">
    <div class="view-header">
      <div>
        <div class="eyebrow">HEATMAP</div>
        <h1>Risk matrix</h1>
        <p>5 × 5 likelihood vs. impact grid — click a cell to filter the register.</p>
      </div>
    </div>
    <div class="matrix-wrap">
      <div class="matrix-axis-y">Likelihood</div>
      <div class="matrix-grid">
        ${rowsHtml}
        <div class="matrix-row matrix-x-labels"><div class="matrix-row-label"></div>${SCALE.map(i=>`<div class="matrix-x-label">${i}</div>`).join('')}</div>
      </div>
      <div class="matrix-axis-x-wrap"><div class="matrix-axis-x">Impact</div></div>
    </div>
    <div class="legend">
      <div class="legend-item"><span class="legend-dot dot-low"></span>Low (1–4)</div>
      <div class="legend-item"><span class="legend-dot dot-medium"></span>Medium (5–9)</div>
      <div class="legend-item"><span class="legend-dot dot-high"></span>High (10–15)</div>
      <div class="legend-item"><span class="legend-dot dot-critical"></span>Critical (16–25)</div>
    </div>
  </div>`;
}
function attachMatrixHandlers(){
  document.querySelectorAll('.matrix-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      state.matrixFilter = { likelihood: Number(cell.dataset.l), impact: Number(cell.dataset.i) };
      state.view = 'register';
      renderApp();
    });
  });
}

/* ---------------- Team view ---------------- */
function renderTeamView(){
  return `
  <div class="view">
    <div class="view-header">
      <div>
        <div class="eyebrow">ACCESS</div>
        <h1>Team</h1>
        <p>${state.admins.length} administrator${state.admins.length===1?'':'s'} with access</p>
      </div>
      <div><button class="btn btn-primary" id="toggle-add-admin">${icon('userplus',15)} Add admin</button></div>
    </div>
    <div id="add-admin-form-wrap"></div>
    <div class="team-list">
      ${state.admins.map(a => `
        <div class="team-row">
          <div class="user-chip"><div class="user-avatar">${esc(a.username.slice(0,1).toUpperCase())}</div><span>${esc(a.username)}</span></div>
          ${a.username === state.session
            ? `<span class="pill pill-open">You</span>`
            : `<button class="icon-btn danger" data-user="${esc(a.username)}" title="Remove admin">${icon('trash',15)}</button>`}
        </div>`).join('')}
    </div>
  </div>`;
}
function attachTeamHandlers(){
  document.getElementById('toggle-add-admin').addEventListener('click', () => {
    const wrap = document.getElementById('add-admin-form-wrap');
    if (wrap.innerHTML) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <form class="inline-card" id="add-admin-form">
        <label class="field"><span class="field-label">${icon('users',15)}Username</span><input name="username" autofocus required /></label>
        <label class="field"><span class="field-label">${icon('key',15)}Password</span><input type="password" name="password" required /></label>
        <div id="add-admin-error"></div>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost" id="cancel-add-admin">Cancel</button>
          <button type="submit" class="btn btn-primary">Add admin</button>
        </div>
      </form>`;
    document.getElementById('cancel-add-admin').addEventListener('click', () => { wrap.innerHTML = ''; });
    document.getElementById('add-admin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const username = (f.get('username')||'').trim();
      const password = f.get('password')||'';
      const errBox = document.getElementById('add-admin-error');
      if (!username || !password) { errBox.innerHTML = '<div class="auth-error">Both fields are required.</div>'; return; }
      if (state.admins.some(a => a.username === username)) { errBox.innerHTML = '<div class="auth-error">Username already exists.</div>'; return; }
      state.admins.push({ username, password });
      persistAdmins();
      renderApp();
      showToast('Admin "'+username+'" added');
    });
  });
  document.querySelectorAll('[data-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = btn.dataset.user;
      state.admins = state.admins.filter(a => a.username !== u);
      persistAdmins();
      renderApp();
      showToast('Admin "'+u+'" removed', 'err');
    });
  });
}

/* ---------------- Settings view ---------------- */
function renderSettingsView(){
  return `
  <div class="view">
    <div class="view-header">
      <div>
        <div class="eyebrow">CONFIGURATION</div>
        <h1>Settings</h1>
        <p>Connect the ISO 27001 AI advisor.</p>
      </div>
    </div>
    <div class="settings-note">${icon('alert',16)}
      <span>This app has no backend, so the AI advisor calls the Anthropic API directly from your browser using
      the key below. The key is stored in this browser's local storage and is visible in your browser's Network tab.
      That's fine on your own machine — never ship this pattern in a deployed or shared app; route it through a
      server instead.</span>
    </div>
    <form class="inline-card" id="settings-form">
      <label class="field"><span class="field-label">${icon('key',15)}Anthropic API key</span>
        <input type="password" id="api-key-input" placeholder="sk-ant-…" value="${esc(state.apiKey)}" />
      </label>
      <div class="row-actions"><button type="submit" class="btn btn-primary">Save key</button></div>
    </form>
  </div>`;
}
function attachSettingsHandlers(){
  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.apiKey = document.getElementById('api-key-input').value.trim();
    persistApiKey();
    showToast('API key saved');
  });
}

/* ---------------- Risk form modal (add/edit) ---------------- */
function openRiskForm(risk){
  state.modal = { type: risk ? 'edit' : 'add', risk: risk || null };
  renderApp();
}
function openRiskDetail(id){
  state.modal = { type: 'detail', riskId: id };
  renderApp();
}
function closeModal(){ state.modal = null; renderApp(); }

function renderModal(){
  if (state.modal.type === 'add' || state.modal.type === 'edit') return renderRiskFormModal(state.modal.risk);
  if (state.modal.type === 'detail') return renderDetailModal(state.risks.find(r => r.id === state.modal.riskId));
  return '';
}

function renderRiskFormModal(existing){
  const f = existing || {
    id: nextRiskId(), asset:'', assetCategory: ASSET_CATEGORIES[0], threat:'', vulnerability:'',
    existingControls:'', likelihood:3, impact:3, owner:'', status:'Open', treatmentPlan:'',
    dateIdentified: todayISO(), loggedBy: state.session, aiSuggestion: null
  };
  const score = f.likelihood * f.impact;
  const lvl = levelForScore(score);
  return `
  <div class="overlay" id="risk-form-overlay">
    <form class="modal wide" id="risk-form">
      <div class="modal-header">
        <div><div class="eyebrow">${existing ? 'EDIT ENTRY' : 'NEW ENTRY'}</div><h2>${esc(f.id)}</h2></div>
        <button type="button" class="icon-btn" id="risk-form-close">${icon('x',18)}</button>
      </div>
      <div class="modal-body form-grid">
        <input type="hidden" name="id" value="${esc(f.id)}" />
        <label class="field"><span class="field-label">Asset name</span><input name="asset" value="${esc(f.asset)}" placeholder="e.g. Customer database" required /></label>
        <label class="field"><span class="field-label">Asset category</span>
          <select name="assetCategory">${ASSET_CATEGORIES.map(c => `<option ${c===f.assetCategory?'selected':''}>${c}</option>`).join('')}</select>
        </label>

        <label class="field span-2"><span class="field-label">Threat</span><textarea name="threat" rows="2" placeholder="What could cause harm — e.g. unauthorized external access" required>${esc(f.threat)}</textarea></label>
        <label class="field span-2"><span class="field-label">Vulnerability</span><textarea name="vulnerability" rows="2" placeholder="What weakness allows the threat — e.g. no MFA on admin accounts" required>${esc(f.vulnerability)}</textarea></label>
        <label class="field span-2"><span class="field-label">Existing controls</span><textarea name="existingControls" rows="2" placeholder="Controls already in place, if any">${esc(f.existingControls)}</textarea></label>

        <label class="field"><span class="field-label" id="likelihood-label">Likelihood — ${SCALE_LABELS.likelihood[f.likelihood]}</span>
          <input type="range" min="1" max="5" name="likelihood" id="likelihood-slider" value="${f.likelihood}" /></label>
        <label class="field"><span class="field-label" id="impact-label">Impact — ${SCALE_LABELS.impact[f.impact]}</span>
          <input type="range" min="1" max="5" name="impact" id="impact-slider" value="${f.impact}" /></label>

        <div class="score-preview span-2">
          <span>Computed score</span>
          <span class="mono score-num" id="score-num">${score}</span>
          <span class="badge badge-${lvl.key}" id="score-badge">${lvl.name}</span>
        </div>

        <label class="field"><span class="field-label">Risk owner</span><input name="owner" value="${esc(f.owner)}" placeholder="Name or role" /></label>
        <label class="field"><span class="field-label">Status</span>
          <select name="status">${STATUSES.map(s => `<option ${s===f.status?'selected':''}>${s}</option>`).join('')}</select>
        </label>

        <label class="field span-2"><span class="field-label">Treatment plan</span><textarea name="treatmentPlan" rows="2" placeholder="Planned response — mitigate, accept, transfer, avoid">${esc(f.treatmentPlan)}</textarea></label>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="risk-form-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add to register'}</button>
      </div>
    </form>
  </div>`;
}

function renderDetailModal(risk){
  if (!risk) return '';
  const lvl = levelForScore(risk.score);
  return `
  <div class="overlay" id="detail-overlay">
    <div class="modal wide">
      <div class="modal-header">
        <div><div class="eyebrow">${esc(risk.id)}</div><h2>${esc(risk.asset)}</h2></div>
        <button class="icon-btn" id="detail-close">${icon('x',18)}</button>
      </div>
      <div class="modal-body detail-body">
        <div class="detail-stats">
          <span class="badge badge-${lvl.key}">${lvl.name}</span>
          <span class="pill ${statusClass(risk.status)}">${esc(risk.status)}</span>
          <span class="mono score-num">${risk.score}/25</span>
          <span class="text-muted">L${risk.likelihood} × I${risk.impact}</span>
        </div>
        ${detailRow('Category', risk.assetCategory)}
        ${detailRow('Threat', risk.threat)}
        ${detailRow('Vulnerability', risk.vulnerability)}
        ${detailRow('Existing controls', risk.existingControls || 'None stated')}
        ${detailRow('Treatment plan', risk.treatmentPlan || 'Not yet defined')}
        ${detailRow('Owner', risk.owner || 'Unassigned')}
        ${detailRow('Date identified', risk.dateIdentified)}
        ${detailRow('Logged by', risk.loggedBy || '—')}

        <div class="ai-panel" id="ai-panel">
          ${renderAiPanelInner(risk)}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger-ghost" id="detail-delete">${icon('trash',15)} Delete</button>
        <button class="btn btn-primary" id="detail-edit">${icon('pencil',15)} Edit entry</button>
      </div>
    </div>
  </div>`;
}
function detailRow(label, value){
  return `<div class="detail-row"><span class="detail-label">${esc(label)}</span><span class="detail-value">${esc(value)}</span></div>`;
}
function renderAiPanelInner(risk){
  return `
    <div class="ai-panel-header">
      <span class="ai-title">${icon('sparkles',15)} ISO 27001 control advisor</span>
      <button class="btn btn-ghost small" id="ai-btn">${icon('sparkles',14)} ${risk.aiSuggestion ? 'Re-run' : 'Get recommendation'}</button>
    </div>
    <div id="ai-error"></div>
    <div id="ai-body">
      ${risk.aiSuggestion ? renderControlList(risk.aiSuggestion) : `<p class="ai-empty">No recommendation yet — generate suggested Annex A controls based on this risk's details.</p>`}
    </div>`;
}
function renderControlList(controls){
  return `<div class="control-list">${controls.map(c => `
    <div class="control-item">
      <span class="control-id mono">${esc(c.id)}</span>
      <div><div class="control-name">${esc(c.name)}</div><div class="control-rationale">${esc(c.rationale)}</div></div>
    </div>`).join('')}</div>`;
}

function attachModalHandlers(){
  if (state.modal.type === 'add' || state.modal.type === 'edit') {
    const overlay = document.getElementById('risk-form-overlay');
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
    document.getElementById('risk-form-close').addEventListener('click', closeModal);
    document.getElementById('risk-form-cancel').addEventListener('click', closeModal);

    const lSlider = document.getElementById('likelihood-slider');
    const iSlider = document.getElementById('impact-slider');
    function updatePreview(){
      const l = Number(lSlider.value), i = Number(iSlider.value);
      document.getElementById('likelihood-label').textContent = 'Likelihood — ' + SCALE_LABELS.likelihood[l];
      document.getElementById('impact-label').textContent = 'Impact — ' + SCALE_LABELS.impact[i];
      const score = l * i;
      const lvl = levelForScore(score);
      document.getElementById('score-num').textContent = score;
      const badge = document.getElementById('score-badge');
      badge.textContent = lvl.name;
      badge.className = 'badge badge-' + lvl.key;
    }
    lSlider.addEventListener('input', updatePreview);
    iSlider.addEventListener('input', updatePreview);

    document.getElementById('risk-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const asset = (f.get('asset')||'').trim();
      const threat = (f.get('threat')||'').trim();
      const vulnerability = (f.get('vulnerability')||'').trim();
      if (!asset || !threat || !vulnerability) return;
      const likelihood = Number(f.get('likelihood'));
      const impact = Number(f.get('impact'));
      const score = likelihood * impact;
      const lvl = levelForScore(score);
      const isEdit = state.modal.type === 'edit';
      const existing = state.modal.risk;
      const risk = {
        id: f.get('id'),
        asset, threat, vulnerability,
        assetCategory: f.get('assetCategory'),
        existingControls: (f.get('existingControls')||'').trim(),
        likelihood, impact, score, level: lvl.name,
        owner: (f.get('owner')||'').trim(),
        status: f.get('status'),
        treatmentPlan: (f.get('treatmentPlan')||'').trim(),
        dateIdentified: isEdit ? existing.dateIdentified : todayISO(),
        loggedBy: isEdit ? existing.loggedBy : state.session,
        aiSuggestion: isEdit ? existing.aiSuggestion : null
      };
      if (isEdit) {
        state.risks = state.risks.map(r => r.id === risk.id ? risk : r);
        showToast(risk.id + ' updated');
      } else {
        state.risks.push(risk);
        showToast(risk.id + ' added to register');
      }
      persistRisks();
      state.modal = null;
      renderApp();
    });
  }

  if (state.modal.type === 'detail') {
    const overlay = document.getElementById('detail-overlay');
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
    document.getElementById('detail-close').addEventListener('click', closeModal);
    document.getElementById('detail-delete').addEventListener('click', () => {
      const id = state.modal.riskId;
      state.risks = state.risks.filter(r => r.id !== id);
      persistRisks();
      state.modal = null;
      renderApp();
      showToast(id + ' removed', 'err');
    });
    document.getElementById('detail-edit').addEventListener('click', () => {
      const risk = state.risks.find(r => r.id === state.modal.riskId);
      state.modal = { type: 'edit', risk };
      renderApp();
    });
    document.getElementById('ai-btn').addEventListener('click', () => runAiAdvisor(state.modal.riskId));
  }
}

/* ---------------- AI advisor ---------------- */
async function runAiAdvisor(riskId){
  const risk = state.risks.find(r => r.id === riskId);
  if (!risk) return;
  const btn = document.getElementById('ai-btn');
  const errBox = document.getElementById('ai-error');
  errBox.innerHTML = '';

  if (!state.apiKey) {
    errBox.innerHTML = '<div class="auth-error">Add your Anthropic API key in Settings first.</div>';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = icon('loader',14) + ' Thinking…';
  btn.querySelector('svg').classList.add('spin');

  const lvl = levelForScore(risk.score);
  const prompt = [
    'Asset: ' + risk.asset + ' (' + risk.assetCategory + ')',
    'Threat: ' + risk.threat,
    'Vulnerability: ' + risk.vulnerability,
    'Existing controls: ' + (risk.existingControls || 'None stated'),
    'Likelihood: ' + risk.likelihood + '/5, Impact: ' + risk.impact + '/5, Risk score: ' + risk.score + '/25 (' + lvl.name + ')'
  ].join('\\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system: 'You are an ISO/IEC 27001:2022 Annex A control advisor helping an organization complete its risk treatment plan. ' +
          'Given a risk description, identify the Annex A controls most relevant to mitigating it. ' +
          'Respond ONLY with valid JSON, no markdown fences, no preamble, in exactly this shape: ' +
          '{"controls":[{"id":"5.9","name":"Inventory of information and other associated assets","rationale":"one sentence, under 25 words"}]}. ' +
          'Return 2 to 4 controls, ordered by relevance, using real Annex A:2022 control numbers and names.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('API error ' + res.status + ': ' + errText.slice(0,200));
    }
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\\n');
    const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!parsed.controls || !Array.isArray(parsed.controls)) throw new Error('Unexpected response shape');

    risk.aiSuggestion = parsed.controls;
    persistRisks();
    document.getElementById('ai-body').innerHTML = renderControlList(parsed.controls);
    btn.disabled = false;
    btn.innerHTML = icon('sparkles',14) + ' Re-run';
  } catch (err) {
    errBox.innerHTML = '<div class="auth-error">Could not get a recommendation: ' + esc(err.message) + '</div>';
    btn.disabled = false;
    btn.innerHTML = icon('sparkles',14) + ' Get recommendation';
  }
}

/* ---------------- Boot ---------------- */
renderApp();
