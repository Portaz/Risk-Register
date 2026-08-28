/* ============================================================
   RiskLedger — vanilla JS build (no framework, no build step)
   Persistence: browser localStorage (this device / this browser only)
   Multi-organization: each org is isolated (its own admins + risks),
   all stored in one browser's localStorage under 'rl_orgs'.
   AI advisor: calls the Google Gemini API directly from the browser
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
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h6M9 7h6"/>',
  helpcircle: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.7 2.7 0 0 1 5.2 1c0 1.7-2.5 2-2.5 3.6"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  arrowleft: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>'
};
function icon(name, size) {
  size = size || 16;
  return '<svg class="icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||'')+'</svg>';
}

/* ---------------- Constants ---------------- */
const ASSET_CATEGORIES = ["Hardware","Software","Data","People","Facility","Third-Party / Vendor","Network"];
const STATUSES = ["Open","In Treatment","Mitigated","Accepted","Closed"];
const SCALE = [1,2,3,4,5];

/* ISO/IEC 27001:2022 Annex A control list — id, short title, theme.
   Used to build the Statement of Applicability. */
const ANNEX_A_CONTROLS = [
  ...["5.1 Policies for information security","5.2 Information security roles and responsibilities","5.3 Segregation of duties","5.4 Management responsibilities","5.5 Contact with authorities","5.6 Contact with special interest groups","5.7 Threat intelligence","5.8 Information security in project management","5.9 Inventory of information and other associated assets","5.10 Acceptable use of information and other associated assets","5.11 Return of assets","5.12 Classification of information","5.13 Labelling of information","5.14 Information transfer","5.15 Access control","5.16 Identity management","5.17 Authentication information","5.18 Access rights","5.19 Information security in supplier relationships","5.20 Addressing information security within supplier agreements","5.21 Managing information security in the ICT supply chain","5.22 Monitoring, review and change management of supplier services","5.23 Information security for use of cloud services","5.24 Information security incident management planning and preparation","5.25 Assessment and decision on information security events","5.26 Response to information security incidents","5.27 Learning from information security incidents","5.28 Collection of evidence","5.29 Information security during disruption","5.30 ICT readiness for business continuity","5.31 Legal, statutory, regulatory and contractual requirements","5.32 Intellectual property rights","5.33 Protection of records","5.34 Privacy and protection of PII","5.35 Independent review of information security","5.36 Compliance with policies, rules and standards for information security","5.37 Documented operating procedures"].map(s => toControl(s, "Organizational")),
  ...["6.1 Screening","6.2 Terms and conditions of employment","6.3 Information security awareness, education and training","6.4 Disciplinary process","6.5 Responsibilities after termination or change of employment","6.6 Confidentiality or non-disclosure agreements","6.7 Remote working","6.8 Information security event reporting"].map(s => toControl(s, "People")),
  ...["7.1 Physical security perimeters","7.2 Physical entry","7.3 Securing offices, rooms and facilities","7.4 Physical security monitoring","7.5 Protecting against physical and environmental threats","7.6 Working in secure areas","7.7 Clear desk and clear screen","7.8 Equipment siting and protection","7.9 Security of assets off-premises","7.10 Storage media","7.11 Supporting utilities","7.12 Cabling security","7.13 Equipment maintenance","7.14 Secure disposal or re-use of equipment"].map(s => toControl(s, "Physical")),
  ...["8.1 User endpoint devices","8.2 Privileged access rights","8.3 Information access restriction","8.4 Access to source code","8.5 Secure authentication","8.6 Capacity management","8.7 Protection against malware","8.8 Management of technical vulnerabilities","8.9 Configuration management","8.10 Information deletion","8.11 Data masking","8.12 Data leakage prevention","8.13 Information backup","8.14 Redundancy of information processing facilities","8.15 Logging","8.16 Monitoring activities","8.17 Clock synchronization","8.18 Use of privileged utility programs","8.19 Installation of software on operational systems","8.20 Networks security","8.21 Security of network services","8.22 Segregation of networks","8.23 Web filtering","8.24 Use of cryptography","8.25 Secure development life cycle","8.26 Application security requirements","8.27 Secure system architecture and engineering principles","8.28 Secure coding","8.29 Security testing in development and acceptance","8.30 Outsourced development","8.31 Separation of development, test and production environments","8.32 Change management","8.33 Test information","8.34 Protection of information systems during audit testing"].map(s => toControl(s, "Technological"))
];
function toControl(str, theme){
  const idx = str.indexOf(' ');
  return { id: str.slice(0, idx), name: str.slice(idx+1), theme };
}
const SOA_THEMES = ["Organizational","People","Physical","Technological"];
const APPLICABILITY_OPTIONS = ["Not reviewed","Applicable","Not applicable"];
const IMPLEMENTATION_STATUSES = ["Not started","In progress","Implemented"];

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
  orgs: LS.get('rl_orgs', []),          // [{id, name, admins:[{username,password,role,securityQuestion,securityAnswer}], risks:[...]}]
  session: LS.get('rl_session', null),   // {orgId, username}
  apiKey: LS.get('rl_apikey', ''),
  view: 'register',
  matrixFilter: null,
  modal: null,
  toast: null,
  authMode: 'signin'                     // 'signin' | 'signup' | 'forgot' (not persisted — resets each load)
};

/* ---- One-time migration from the old single-org format, if present ---- */
(function migrateLegacyData(){
  if (state.orgs.length > 0) return;
  const oldOrg = LS.get('rl_org', null);
  if (!oldOrg) return;
  const oldAdmins = LS.get('rl_admins', []);
  const oldRisks = LS.get('rl_risks', []);
  const migratedAdmins = oldAdmins.map((a, idx) => ({
    username: a.username, password: a.password,
    role: idx === 0 ? 'head' : 'admin',
    securityQuestion: '', securityAnswer: ''
  }));
  const newOrg = { id: uid(), name: oldOrg.name, admins: migratedAdmins, risks: oldRisks };
  state.orgs = [newOrg];
  LS.set('rl_orgs', state.orgs);
  let oldSessionUser = null;
  try { oldSessionUser = JSON.parse(localStorage.getItem('rl_session') || 'null'); } catch(e){}
  if (oldSessionUser && migratedAdmins.some(a => a.username === oldSessionUser)) {
    state.session = { orgId: newOrg.id, username: oldSessionUser };
    LS.set('rl_session', state.session);
  }
})();

function persistOrgs(){ LS.set('rl_orgs', state.orgs); }
function persistSession(){ LS.set('rl_session', state.session); }
function persistApiKey(){ LS.set('rl_apikey', state.apiKey); }

/* ---------------- Session / org helpers ---------------- */
function currentOrg(){
  if (!state.session) return null;
  const org = state.orgs.find(o => o.id === state.session.orgId) || null;
  if (org) ensureOrgExtras(org);
  return org;
}
function currentAdmin(){
  const org = currentOrg();
  if (!org) return null;
  return org.admins.find(a => a.username === state.session.username) || null;
}
function isHeadAdmin(){
  const a = currentAdmin();
  return !!a && a.role === 'head';
}
function findOrgByName(name){
  const n = (name || '').trim().toLowerCase();
  return state.orgs.find(o => o.name.trim().toLowerCase() === n) || null;
}

/* Lazily initialize newer org fields so orgs created before this feature still work. */
function ensureOrgExtras(org){
  if (!org.soa) org.soa = {};       // { [controlId]: {applicable, justification, status} }
  if (!org.policies) org.policies = {}; // { [policyNameLower]: {name, status} }
  return org;
}

/* Normalize risk.aiSuggestion across the old shape (plain array of controls)
   and the new shape ({controls, policies}) so the rest of the app can treat it uniformly. */
function getRiskControls(risk){
  if (!risk.aiSuggestion) return [];
  if (Array.isArray(risk.aiSuggestion)) return risk.aiSuggestion;
  return risk.aiSuggestion.controls || [];
}
function getRiskPolicies(risk){
  if (!risk.aiSuggestion || Array.isArray(risk.aiSuggestion)) return [];
  return risk.aiSuggestion.policies || [];
}

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
  const risks = currentOrg() ? currentOrg().risks : [];
  const nums = risks.map(r => parseInt((r.id||'').replace('RSK-',''),10)).filter(n => !isNaN(n));
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
  if (!state.session) {
    app.innerHTML = renderAuth();
    attachAuthHandlers();
  } else {
    app.innerHTML = renderDashboard();
    attachDashboardHandlers();
  }
}

/* ================================================================
   AUTH — Sign in / Sign up / Forgot password
   ================================================================ */
function renderAuth(){
  return `
  <div class="auth-wrap">
    <div class="auth-brand">
      <div class="brand-mark">${icon('shield',22)}</div>
      <div>
        <div class="brand-name">RiskLedger</div>
        <div class="brand-sub">ISO/IEC 27001 risk register &amp; matrix</div>
      </div>
    </div>
    <div class="auth-card">
      ${state.authMode === 'forgot' ? renderForgotPassword() : renderSignInUp()}
    </div>
  </div>`;
}

function renderSignInUp(){
  return `
    <div class="auth-tabs">
      <button class="auth-tab ${state.authMode==='signin'?'active':''}" data-mode="signin">Sign in</button>
      <button class="auth-tab ${state.authMode==='signup'?'active':''}" data-mode="signup">Sign up</button>
    </div>
    ${state.authMode === 'signup' ? renderSignUpForm() : renderSignInForm()}
  `;
}

function renderSignInForm(){
  return `
    <form id="signin-form">
      <div class="auth-eyebrow">SIGN IN</div>
      <h1>Welcome back</h1>
      <p class="auth-hint">Sign in to your organization's risk register.</p>

      <label class="field"><span class="field-label">${icon('building',15)}Organization name</span>
        <input name="orgName" autofocus placeholder="Acme Holdings Ltd." required /></label>
      <label class="field"><span class="field-label">${icon('users',15)}Username</span>
        <input name="username" placeholder="e.g. j.doe" required /></label>
      <label class="field"><span class="field-label">${icon('key',15)}Password</span>
        <input type="password" name="password" placeholder="••••••••" required /></label>

      <div id="signin-error"></div>

      <button type="submit" class="btn btn-primary btn-block">${icon('login',16)} Sign in</button>
      <button type="button" class="link-btn" id="forgot-link">Forgot password?</button>
    </form>`;
}

function renderSignUpForm(){
  return `
    <form id="signup-form">
      <div class="auth-eyebrow">SIGN UP</div>
      <h1>Create your organization</h1>
      <p class="auth-hint">This creates a new organization and its head administrator account.</p>

      <label class="field"><span class="field-label">${icon('building',15)}Organization name</span>
        <input name="orgName" autofocus placeholder="Acme Holdings Ltd." required /></label>
      <label class="field"><span class="field-label">${icon('users',15)}Your username</span>
        <input name="username" placeholder="e.g. j.doe" required /></label>
      <label class="field"><span class="field-label">${icon('key',15)}Password</span>
        <input type="password" name="password" placeholder="••••••••" required /></label>
      <label class="field"><span class="field-label">${icon('key',15)}Confirm password</span>
        <input type="password" name="confirm" placeholder="••••••••" required /></label>
      <label class="field"><span class="field-label">${icon('helpcircle',15)}Security question</span>
        <input name="securityQuestion" placeholder="e.g. What was your first pet's name?" required /></label>
      <label class="field"><span class="field-label">${icon('helpcircle',15)}Answer</span>
        <input name="securityAnswer" placeholder="Used only to reset your password" required /></label>

      <div id="signup-error"></div>

      <button type="submit" class="btn btn-primary btn-block">Create organization ${icon('chevron',16)}</button>
      <p class="auth-footnote">Demo-grade storage: everything above is kept in this browser's local storage, not a
      real authentication backend. Don't reuse a real password here.</p>
    </form>`;
}

function renderForgotPassword(){
  return `
    <div class="auth-eyebrow">RESET PASSWORD</div>
    <h1>Forgot your password?</h1>
    <p class="auth-hint">Look up your account, then answer your security question to set a new password.</p>
    <div id="forgot-stage">${renderForgotStage1()}</div>
    <button type="button" class="link-btn" id="back-to-signin"><span style="display:inline-flex;align-items:center;gap:5px;">${icon('arrowleft',13)} Back to sign in</span></button>
  `;
}
function renderForgotStage1(){
  return `
    <form id="forgot-lookup-form">
      <label class="field"><span class="field-label">${icon('building',15)}Organization name</span><input name="orgName" autofocus required /></label>
      <label class="field"><span class="field-label">${icon('users',15)}Username</span><input name="username" required /></label>
      <div id="forgot-error"></div>
      <button type="submit" class="btn btn-primary btn-block">Find account</button>
    </form>`;
}
function renderForgotStage2(org, admin){
  return `
    <div class="auth-error" style="background:var(--elevated-2); border-color:var(--border); color:var(--text-muted);">
      Account found: <strong style="color:var(--text)">${esc(admin.username)}</strong> at <strong style="color:var(--text)">${esc(org.name)}</strong>
    </div>
    <form id="forgot-reset-form">
      <label class="field"><span class="field-label">${icon('helpcircle',15)}${esc(admin.securityQuestion)}</span>
        <input name="answer" autofocus required /></label>
      <label class="field"><span class="field-label">${icon('key',15)}New password</span>
        <input type="password" name="newPassword" required /></label>
      <label class="field"><span class="field-label">${icon('key',15)}Confirm new password</span>
        <input type="password" name="confirmPassword" required /></label>
      <div id="forgot-error-2"></div>
      <button type="submit" class="btn btn-primary btn-block">Reset password</button>
    </form>`;
}
function renderForgotNoRecovery(org, admin){
  return `<div class="auth-error">
    "${esc(admin.username)}" doesn't have recovery info on file. Ask ${esc(org.name)}'s head administrator to reset
    this password from the Team tab instead.
  </div>`;
}

function attachAuthHandlers(){
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => { state.authMode = tab.dataset.mode; renderApp(); });
  });

  const signinForm = document.getElementById('signin-form');
  if (signinForm) signinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const org = findOrgByName(f.get('orgName'));
    const errBox = document.getElementById('signin-error');
    if (!org) { errBox.innerHTML = '<div class="auth-error">No organization found with that name.</div>'; return; }
    const username = (f.get('username')||'').trim();
    const password = f.get('password')||'';
    const admin = org.admins.find(a => a.username === username && a.password === password);
    if (!admin) { errBox.innerHTML = '<div class="auth-error">Incorrect username or password.</div>'; return; }
    state.session = { orgId: org.id, username: admin.username };
    state.view = 'register';
    persistSession();
    renderApp();
    showToast('Welcome back, ' + admin.username);
  });

  const signupForm = document.getElementById('signup-form');
  if (signupForm) signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const orgName = (f.get('orgName')||'').trim();
    const username = (f.get('username')||'').trim();
    const password = f.get('password')||'';
    const confirm = f.get('confirm')||'';
    const securityQuestion = (f.get('securityQuestion')||'').trim();
    const securityAnswer = (f.get('securityAnswer')||'').trim();
    const errBox = document.getElementById('signup-error');
    if (!orgName || !username || !password || !securityQuestion || !securityAnswer) { errBox.innerHTML = '<div class="auth-error">All fields are required.</div>'; return; }
    if (password !== confirm) { errBox.innerHTML = '<div class="auth-error">Passwords do not match.</div>'; return; }
    if (password.length < 4) { errBox.innerHTML = '<div class="auth-error">Password must be at least 4 characters.</div>'; return; }
    if (findOrgByName(orgName)) { errBox.innerHTML = '<div class="auth-error">An organization with that name already exists.</div>'; return; }

    const org = {
      id: uid(), name: orgName,
      admins: [{ username, password, role: 'head', securityQuestion, securityAnswer: securityAnswer.toLowerCase() }],
      risks: []
    };
    state.orgs.push(org);
    state.session = { orgId: org.id, username };
    state.view = 'register';
    persistOrgs(); persistSession();
    renderApp();
    showToast('Organization "'+orgName+'" created');
  });

  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) forgotLink.addEventListener('click', () => { state.authMode = 'forgot'; renderApp(); });

  const backLink = document.getElementById('back-to-signin');
  if (backLink) backLink.addEventListener('click', () => { state.authMode = 'signin'; renderApp(); });

  const lookupForm = document.getElementById('forgot-lookup-form');
  if (lookupForm) lookupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const org = findOrgByName(f.get('orgName'));
    const errBox = document.getElementById('forgot-error');
    if (!org) { errBox.innerHTML = '<div class="auth-error">No organization found with that name.</div>'; return; }
    const username = (f.get('username')||'').trim();
    const admin = org.admins.find(a => a.username === username);
    if (!admin) { errBox.innerHTML = '<div class="auth-error">No account found with that username.</div>'; return; }

    const stage = document.getElementById('forgot-stage');
    if (!admin.securityQuestion) {
      stage.innerHTML = renderForgotNoRecovery(org, admin);
      return;
    }
    stage.innerHTML = renderForgotStage2(org, admin);
    document.getElementById('forgot-reset-form').addEventListener('submit', (e2) => {
      e2.preventDefault();
      const f2 = new FormData(e2.target);
      const answer = (f2.get('answer')||'').trim().toLowerCase();
      const newPassword = f2.get('newPassword')||'';
      const confirmPassword = f2.get('confirmPassword')||'';
      const err2 = document.getElementById('forgot-error-2');
      if (answer !== admin.securityAnswer) { err2.innerHTML = '<div class="auth-error">That answer doesn\u2019t match our records.</div>'; return; }
      if (newPassword.length < 4) { err2.innerHTML = '<div class="auth-error">Password must be at least 4 characters.</div>'; return; }
      if (newPassword !== confirmPassword) { err2.innerHTML = '<div class="auth-error">Passwords do not match.</div>'; return; }
      admin.password = newPassword;
      persistOrgs();
      state.authMode = 'signin';
      renderApp();
      showToast('Password reset — sign in with your new password');
    });
  });
}

/* ================================================================
   DASHBOARD SHELL
   ================================================================ */
function renderDashboard(){
  const org = currentOrg();
  const me = currentAdmin();
  const head = isHeadAdmin();
  return `
  <div class="dash">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-mark small">${icon('shield',17)}</div>
        <div>
          <div class="brand-name small">RiskLedger</div>
          <div class="brand-sub tiny">${esc(org.name)}</div>
        </div>
      </div>
      <nav class="nav">
        <button class="nav-item ${state.view==='register'?'active':''}" data-view="register">${icon('clipboard',16)}<span>Risk Register</span></button>
        <button class="nav-item ${state.view==='matrix'?'active':''}" data-view="matrix">${icon('grid',16)}<span>Risk Matrix</span></button>
        <button class="nav-item ${state.view==='soa'?'active':''}" data-view="soa">${icon('clipboard',16)}<span>Statement of Applicability</span></button>
        <button class="nav-item ${state.view==='team'?'active':''}" data-view="team">${icon('users',16)}<span>Team</span></button>
        <button class="nav-item ${state.view==='settings'?'active':''}" data-view="settings">${icon('key',16)}<span>Settings</span></button>
      </nav>
      <button class="btn btn-primary btn-block sidebar-add" id="add-risk-btn">${icon('plus',16)} Add risk</button>
      <div class="sidebar-user">
        <div class="user-chip"><div class="user-avatar">${esc(me.username.slice(0,1).toUpperCase())}</div>
          <div style="min-width:0;">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(me.username)}</div>
            <div style="font-size:10.5px;color:var(--text-faint);">${head ? 'Head Admin' : 'Admin'}</div>
          </div>
        </div>
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
  if (state.view === 'soa') return renderSoaView();
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
    state.session = null; state.authMode = 'signin'; state.view = 'register'; state.matrixFilter = null;
    persistSession(); renderApp();
  });

  if (state.view === 'register') attachRegisterHandlers();
  if (state.view === 'matrix') attachMatrixHandlers();
  if (state.view === 'soa') attachSoaHandlers();
  if (state.view === 'team') attachTeamHandlers();
  if (state.view === 'settings') attachSettingsHandlers();

  if (state.modal) attachModalHandlers();
}

/* ---------------- Register view ---------------- */
function filteredRisks(){
  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('status-filter')?.value || 'All';
  const risks = currentOrg().risks;
  return risks.filter(r => {
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
  const risks = currentOrg().risks;
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
    const noneAtAll = currentOrg().risks.length === 0;
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
  try { return filteredRisks(); } catch(e){ return currentOrg().risks; }
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
      const risk = currentOrg().risks.find(r => r.id === row.dataset.id);
      if (risk) openRiskDetail(risk.id);
    });
  });
}

/* ---------------- Matrix view ---------------- */
function renderMatrixView(){
  const risks = currentOrg().risks;
  const grid = {};
  SCALE.forEach(l => SCALE.forEach(i => grid[l+'-'+i] = []));
  risks.forEach(r => { const k = r.likelihood+'-'+r.impact; if (grid[k]) grid[k].push(r); });

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

/* ---------------- Statement of Applicability (SOA) ---------------- */
function linkedRisksForControl(controlId){
  const risks = currentOrg().risks;
  return risks.filter(r => getRiskControls(r).some(c => (c.id||'').trim() === controlId));
}

function renderSoaView(){
  const org = currentOrg();
  const reviewedCount = Object.values(org.soa).filter(v => v.applicable === 'Applicable' || v.applicable === 'Not applicable').length;

  const themesHtml = SOA_THEMES.map(theme => {
    const rows = ANNEX_A_CONTROLS.filter(c => c.theme === theme).map(c => {
      const entry = org.soa[c.id] || { applicable: 'Not reviewed', justification: '', status: 'Not started' };
      const linked = linkedRisksForControl(c.id);
      return `
      <div class="soa-row" data-control="${esc(c.id)}">
        <div class="soa-row-head">
          <span class="control-id mono">${esc(c.id)}</span>
          <span class="soa-control-name">${esc(c.name)}</span>
          ${linked.length ? `<span class="soa-linked">${linked.map(r => `<button class="chip soa-link-chip" data-risk="${esc(r.id)}">${esc(r.id)}</button>`).join('')}</span>` : ''}
        </div>
        <div class="soa-row-fields">
          <select class="soa-applicable" data-field="applicable">
            ${APPLICABILITY_OPTIONS.map(o => `<option ${o===entry.applicable?'selected':''}>${o}</option>`).join('')}
          </select>
          <select class="soa-status" data-field="status">
            ${IMPLEMENTATION_STATUSES.map(o => `<option ${o===entry.status?'selected':''}>${o}</option>`).join('')}
          </select>
          <input class="soa-justification" data-field="justification" placeholder="Justification for inclusion / exclusion…" value="${esc(entry.justification)}" />
        </div>
      </div>`;
    }).join('');
    return `<div class="soa-theme"><div class="soa-theme-header">${theme} controls</div>${rows}</div>`;
  }).join('');

  const policyList = Object.keys(org.policies).length
    ? Object.values(org.policies).map(p => `
        <div class="soa-row" data-policy="${esc(p.name.toLowerCase())}">
          <div class="soa-row-head"><span class="soa-control-name">${esc(p.name)}</span></div>
          <div class="soa-row-fields">
            <select class="policy-status" data-field="status">
              ${["Not adopted","Draft","Adopted"].map(o => `<option ${o===p.status?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>`).join('')
    : `<p class="ai-empty">No policies suggested yet — run the AI advisor on a risk to populate this list.</p>`;

  return `
  <div class="view">
    <div class="view-header">
      <div>
        <div class="eyebrow">ISO 27001 · CLAUSE 6.1.3(d)</div>
        <h1>Statement of Applicability</h1>
        <p>${reviewedCount} of ${ANNEX_A_CONTROLS.length} controls reviewed</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost" id="soa-sync-btn">${icon('sparkles',15)} Sync from AI suggestions</button>
        <button class="btn btn-ghost" id="soa-print-btn">Print / Save PDF</button>
        <button class="btn btn-primary" id="soa-export-btn">Export CSV</button>
      </div>
    </div>

    <div id="soa-content">
      ${themesHtml}
      <div class="soa-theme">
        <div class="soa-theme-header">Suggested policies</div>
        <div id="policy-list">${policyList}</div>
      </div>
    </div>
  </div>`;
}

function attachSoaHandlers(){
  const org = currentOrg();

  document.querySelectorAll('.soa-row[data-control]').forEach(row => {
    const controlId = row.dataset.control;
    row.querySelectorAll('[data-field]').forEach(input => {
      const evt = input.tagName === 'INPUT' ? 'input' : 'change';
      input.addEventListener(evt, () => {
        const entry = org.soa[controlId] || { applicable: 'Not reviewed', justification: '', status: 'Not started' };
        entry[input.dataset.field] = input.value;
        org.soa[controlId] = entry;
        persistOrgs();
      });
    });
  });

  document.querySelectorAll('.soa-link-chip').forEach(chip => {
    chip.addEventListener('click', () => openRiskDetail(chip.dataset.risk));
  });

  document.querySelectorAll('.soa-row[data-policy] [data-field]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.closest('[data-policy]').dataset.policy;
      if (org.policies[key]) { org.policies[key].status = input.value; persistOrgs(); }
    });
  });

  document.getElementById('soa-sync-btn').addEventListener('click', () => {
    let touched = 0;
    org.risks.forEach(r => {
      getRiskControls(r).forEach(c => {
        const id = (c.id||'').trim();
        const known = ANNEX_A_CONTROLS.find(ac => ac.id === id);
        if (!known) return;
        if (!org.soa[id] || org.soa[id].applicable === 'Not reviewed') {
          org.soa[id] = { applicable: 'Applicable', justification: org.soa[id]?.justification || ('Mitigates ' + r.id + ': ' + r.threat).slice(0,180), status: org.soa[id]?.status || 'Not started' };
          touched++;
        }
      });
      getRiskPolicies(r).forEach(p => {
        const key = (p.name||'').trim().toLowerCase();
        if (!key) return;
        if (!org.policies[key]) { org.policies[key] = { name: p.name, status: 'Not adopted' }; touched++; }
      });
    });
    persistOrgs();
    renderApp();
    showToast(touched ? ('Synced ' + touched + ' item' + (touched===1?'':'s') + ' from AI suggestions') : 'Nothing new to sync');
  });

  document.getElementById('soa-print-btn').addEventListener('click', () => window.print());

  document.getElementById('soa-export-btn').addEventListener('click', () => {
    const rows = [["Theme","Control ID","Control Name","Applicable","Status","Justification","Linked Risks"]];
    ANNEX_A_CONTROLS.forEach(c => {
      const entry = org.soa[c.id] || { applicable: 'Not reviewed', justification: '', status: 'Not started' };
      const linked = linkedRisksForControl(c.id).map(r => r.id).join('; ');
      rows.push([c.theme, c.id, c.name, entry.applicable, entry.status, entry.justification, linked]);
    });
    const csv = rows.map(r => r.map(cell => '"' + String(cell||'').replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (org.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase() || 'organization') + '-statement-of-applicability.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('SOA exported as CSV');
  });
}

/* ---------------- Team view ---------------- */
function renderTeamView(){
  const org = currentOrg();
  const head = isHeadAdmin();
  return `
  <div class="view">
    <div class="view-header">
      <div>
        <div class="eyebrow">ACCESS</div>
        <h1>Team</h1>
        <p>${org.admins.length} administrator${org.admins.length===1?'':'s'} with access${head ? '' : ' — only the head admin can add or remove admins'}</p>
      </div>
      ${head ? `<div><button class="btn btn-primary" id="toggle-add-admin">${icon('userplus',15)} Add admin</button></div>` : ''}
    </div>
    <div id="add-admin-form-wrap"></div>
    <div class="team-list">
      ${org.admins.map(a => {
        const isSelf = a.username === state.session.username;
        const isRowHead = a.role === 'head';
        return `
        <div class="team-row">
          <div class="user-chip">
            <div class="user-avatar">${esc(a.username.slice(0,1).toUpperCase())}</div>
            <span>${esc(a.username)}</span>
            <span class="role-pill ${isRowHead ? 'role-head' : 'role-admin'}">${isRowHead ? 'Head Admin' : 'Admin'}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${isSelf ? `<span class="pill pill-open">You</span>` : ''}
            ${(!isSelf && head && !isRowHead) ? `
              <button class="btn btn-ghost small" data-reset-user="${esc(a.username)}">${icon('key',13)} Reset password</button>
              <button class="icon-btn danger" data-remove-user="${esc(a.username)}" title="Remove admin">${icon('trash',15)}</button>
            ` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div id="reset-pw-wrap"></div>
  </div>`;
}
function attachTeamHandlers(){
  const org = currentOrg();
  const toggleBtn = document.getElementById('toggle-add-admin');
  if (toggleBtn) toggleBtn.addEventListener('click', () => {
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
      if (org.admins.some(a => a.username === username)) { errBox.innerHTML = '<div class="auth-error">Username already exists.</div>'; return; }
      org.admins.push({ username, password, role: 'admin', securityQuestion: '', securityAnswer: '' });
      persistOrgs();
      renderApp();
      showToast('Admin "'+username+'" added');
    });
  });

  document.querySelectorAll('[data-remove-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = btn.dataset.removeUser;
      org.admins = org.admins.filter(a => a.username !== u);
      persistOrgs();
      renderApp();
      showToast('Admin "'+u+'" removed', 'err');
    });
  });

  document.querySelectorAll('[data-reset-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = btn.dataset.resetUser;
      const wrap = document.getElementById('reset-pw-wrap');
      wrap.innerHTML = `
        <form class="inline-card" id="reset-pw-form">
          <div class="auth-eyebrow">RESET PASSWORD</div>
          <p class="auth-hint" style="margin-bottom:10px;">Setting a new password for <strong style="color:var(--text)">${esc(u)}</strong>.</p>
          <label class="field"><span class="field-label">${icon('key',15)}New password</span><input type="password" name="newPassword" autofocus required /></label>
          <div id="reset-pw-error"></div>
          <div class="row-actions">
            <button type="button" class="btn btn-ghost" id="cancel-reset-pw">Cancel</button>
            <button type="submit" class="btn btn-primary">Set password</button>
          </div>
        </form>`;
      document.getElementById('cancel-reset-pw').addEventListener('click', () => { wrap.innerHTML = ''; });
      document.getElementById('reset-pw-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const newPassword = f.get('newPassword')||'';
        const errBox = document.getElementById('reset-pw-error');
        if (newPassword.length < 4) { errBox.innerHTML = '<div class="auth-error">Password must be at least 4 characters.</div>'; return; }
        const admin = org.admins.find(a => a.username === u);
        admin.password = newPassword;
        persistOrgs();
        wrap.innerHTML = '';
        showToast('Password reset for "'+u+'"');
      });
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
      <span>This app has no backend, so the AI advisor calls the Google Gemini API directly from your browser using
      the key below. The key is stored in this browser's local storage and is visible in your browser's Network tab.
      That's fine on your own machine for local development — <strong>never ship this pattern to a public or
      production deployment</strong>; route the call through a server you control instead so the key isn't exposed
      to every visitor.</span>
    </div>
    <form class="inline-card" id="settings-form">
      <label class="field"><span class="field-label">${icon('key',15)}Gemini API key</span>
        <input type="password" id="api-key-input" placeholder="AIza…" value="${esc(state.apiKey)}" />
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
  if (state.modal.type === 'detail') return renderDetailModal(currentOrg().risks.find(r => r.id === state.modal.riskId));
  return '';
}

function renderRiskFormModal(existing){
  const f = existing || {
    id: nextRiskId(), asset:'', assetCategory: ASSET_CATEGORIES[0], threat:'', vulnerability:'',
    existingControls:'', likelihood:3, impact:3, owner:'', status:'Open', treatmentPlan:'',
    dateIdentified: todayISO(), loggedBy: state.session.username, aiSuggestion: null
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
  const org = currentOrg();
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
        loggedBy: isEdit ? existing.loggedBy : state.session.username,
        aiSuggestion: isEdit ? existing.aiSuggestion : null
      };
      if (isEdit) {
        org.risks = org.risks.map(r => r.id === risk.id ? risk : r);
        showToast(risk.id + ' updated');
      } else {
        org.risks.push(risk);
        showToast(risk.id + ' added to register');
      }
      persistOrgs();
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
      org.risks = org.risks.filter(r => r.id !== id);
      persistOrgs();
      state.modal = null;
      renderApp();
      showToast(id + ' removed', 'err');
    });
    document.getElementById('detail-edit').addEventListener('click', () => {
      const risk = org.risks.find(r => r.id === state.modal.riskId);
      state.modal = { type: 'edit', risk };
      renderApp();
    });
    document.getElementById('ai-btn').addEventListener('click', () => runAiAdvisor(state.modal.riskId));
  }
}

/* ---------------- AI advisor ----------------
   Uses the Google Gemini API (generateContent) with a JSON response schema,
   so Gemini returns exactly the {"controls":[...]} shape our UI expects —
   no markdown-fence stripping needed the way some providers require.
   Model: gemini-3.6-flash — current Gemini API free-tier model as of Aug 2026
   (gemini-2.5-flash was retired for new users). If this model is retired later,
   update GEMINI_MODEL below; check https://ai.google.dev/gemini-api/docs/pricing
   for whatever free-tier Flash model is current at the time.
   Note: Gemini 3.x rejects requests whose last turn has role "model" — not an
   issue here since we only ever send a single user turn per call. */
const GEMINI_MODEL = 'gemini-3.6-flash';

async function runAiAdvisor(riskId){
  const org = currentOrg();
  const risk = org.risks.find(r => r.id === riskId);
  if (!risk) return;
  const btn = document.getElementById('ai-btn');
  const errBox = document.getElementById('ai-error');
  errBox.innerHTML = '';

  if (!state.apiKey) {
    errBox.innerHTML = '<div class="auth-error">Add your Gemini API key in Settings first.</div>';
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
  ].join('\n');

  const systemPrompt = 'You are an ISO/IEC 27001:2022 Annex A control advisor helping an organization complete its risk treatment plan. ' +
    'Given a risk description, identify the Annex A controls most relevant to mitigating it. ' +
    'Return 2 to 4 controls, ordered by relevance, using real Annex A:2022 control numbers and names.';

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': state.apiKey
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                controls: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      name: { type: 'STRING' },
                      rationale: { type: 'STRING' }
                    },
                    required: ['id', 'name', 'rationale']
                  }
                }
              },
              required: ['controls']
            }
          }
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      const apiMsg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + res.status);
      throw new Error(apiMsg);
    }

    const candidate = data.candidates && data.candidates[0];
    const text = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map(p => p.text || '').join('')
      : '';
    if (!text) throw new Error('Empty response from Gemini — try again.');

    const parsed = JSON.parse(text);
    if (!parsed.controls || !Array.isArray(parsed.controls)) throw new Error('Unexpected response shape from Gemini');

    risk.aiSuggestion = parsed.controls;
    persistOrgs();
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