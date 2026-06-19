// ── Language loading ──────────────────────────────────────────────────────────
let T = {};
let activeLang = 'en';

function _detectBrowserLang() {
  const lang = (navigator.language || '').split('-')[0].toLowerCase();
  return availableLangs.some(l => l.code === lang) ? lang : 'en';
}

async function loadLanguage(langCode) {
  try {
    const res = await fetch(`/static/js/i18n/${langCode}.json`);
    if (!res.ok) throw new Error('not found');
    T = await res.json();
    activeLang = langCode;
  } catch {
    if (langCode !== 'en') {
      const res = await fetch('/static/js/i18n/en.json');
      T = await res.json();
      activeLang = 'en';
    }
  }
  applyI18n();
}

// ── State ─────────────────────────────────────────────────────────────────────
let token = localStorage.getItem('fd_token') || null;
let unit = 'C';
let chart = null;
let curves = {};
let serverDisks = [];
let allDisks = [];
let allFans = [];
let serverFans = [];
let settingsData = null;
let pollTimer = null;
let availableLangs = ['en'];

const DISK_THRESHOLDS = {
  HDD:  { warm: 40, hot: 45, critical: 55 },
  SSD:  { warm: 50, hot: 60, critical: 70 },
  NVMe: { warm: 55, hot: 65, critical: 75 },
};

// ── Bootstrap: load language then show login or app ───────────────────────────
(async () => {
  try {
    const res = await fetch('/api/settings/languages');
    const data = await res.json();
    availableLangs = data.languages;
  } catch { availableLangs = ['en']; }
  const browserLang = _detectBrowserLang();
  await loadLanguage(browserLang);

  if (token) {
    const data = await api('GET', '/settings/');
    if (!data || data.first_run) {
      token = null;
      localStorage.removeItem('fd_token');
      document.getElementById('loginView').classList.remove('hidden');
      return;
    }
    // Apply saved language preference if different from browser
    if (data.language && data.language !== activeLang) {
      await loadLanguage(data.language);
    }
    showApp(data);
  } else {
    document.getElementById('loginView').classList.remove('hidden');
    fetch('/api/auth/first-run').then(r => r.json()).then(d => {
      if (!d.first_run) document.getElementById('defaultCredsHint').style.display = 'none';
    }).catch(() => {
      document.getElementById('defaultCredsHint').style.display = 'none';
    });
  }
})();

// ── i18n DOM application ──────────────────────────────────────────────────────
function applyI18n() {
  const s = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  const h = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  s('loginSubtitle', T.loginAppDesc);
  s('loginErr', T.loginError);
  s('labelUser', T.usernameLabel);
  s('labelPass', T.passwordLabel);
  h('hintDefaultCreds', T.defaultCreds + ' <strong>admin</strong> / <strong>fandock</strong>');
  s('hintDefaultCredsNote', T.defaultCredsNote);
  s('hintForgotPwd', T.forgotPassword);
  s('btnSignIn', T.signIn);
  s('wizTitle', T.welcomeTitle);
  s('wizSubtitle', T.welcomeSubtitle);
  s('wizStep1Desc', T.wizStep1Desc);
  s('labelWizCurrentPwd', T.currentPassword);
  s('labelWizNewPwd', T.newPassword);
  s('labelWizConfirmPwd', T.confirmPassword);
  s('btnWizSetPwd', T.setPasswordContinue);
  s('wizStep2Desc', T.wizStep2Desc);
  s('wizDisksLabel', T.disks);
  s('wizFansLabel', T.fans);
  s('wizCurvesNote', T.fanCurvesDefault);
  s('btnWizFinish', T.finishSetup);
  s('bannerImportant', T.onboardImportant);
  s('bannerMsg', T.onboardMsg);
  s('btnDismiss', T.dismiss);
  s('navLabelDash', T.dashboard);
  s('navLabelCurves', T.curves);
  s('navLabelSettings', T.settings);
  s('menuChangePwd', T.changePassword);
  s('menuResetConfig', T.resetConfiguration);
  s('menuLogout', T.logout);
  s('labelDiskTemps', T.diskTemps);
  s('legendNormal', T.normal);
  s('legendWarm', T.warm);
  s('legendHot', T.hot);
  s('legendCritical', T.critical);
  s('legendHoverThreshold', T.hoverThreshold);
  s('labelFanStatus', T.fanStatus);
  s('curvesEditorTitle', T.fanCurveEditor);
  s('nowLabel', T.now);
  s('legendFanCurve', T.fanCurve);
  s('legendCurrentOp', T.currentOp);
  s('warnBarMsg', T.warnBelow20);
  s('colTemperature', T.temperature);
  s('colFanSpeed', T.fanSpeed);
  s('btnAddPoint', T.addPoint);
  s('btnDiscardCurve', T.discardChanges);
  s('btnSaveCurve', T.saveCurve);
  s('curveHintText', T.curveHint);
  s('linkedDisksLabel', T.linkedDisksLabel);
  s('settingsHwTitle', T.hardwareDetection);
  s('scanBadge', T.scanned);
  s('settingsHwDesc', T.hardwareDesc);
  s('btnRescan', T.rescan);
  s('settingsDisksTitle', T.disks);
  s('thDevice', T.device);
  s('thModel', T.model);
  s('thSerial', T.serial);
  s('thType', T.type);
  s('thFriendlyName', T.friendlyName);
  s('thMonitor', T.monitor);
  s('settingsFansTitle', T.fans);
  s('settingsFansDesc', T.fansDesc);
  s('thPwmChannel', T.pwmChannel);
  s('thFanFriendlyName', T.friendlyName);
  s('thCurrentRpm', T.currentRpm);
  s('thFanMonitor', T.monitor);
  s('thControl', T.control);
  s('settingsPrefsTitle', T.preferences);
  s('prefTempUnitsLabel', T.tempUnits);
  s('prefTempUnitsDesc', T.chooseScale);
  s('prefLangLabel', T.language);
  s('prefLangDesc', T.languageDesc);
  s('btnDiscardSettings', T.discardChanges);
  s('btnSaveSettings', T.saveSettings);
  s('footerTagline', T.openSourceNas);
  s('footerGithub', T.githubLink);
  s('footerReportIssue', T.reportIssue);
  s('modalChangePwdTitle', T.changePassword);
  s('modalLabelCurrentPwd', T.currentPassword);
  s('modalLabelNewPwd', T.newPassword);
  s('modalLabelConfirmPwd', T.confirmPassword);
  s('modalBtnCancel', T.cancel);
  s('modalBtnUpdatePwd', T.updatePassword);
  s('btnRerunWizardLabel', T.rerunWizard);
  const langSel = document.getElementById('langSelect');
  if (langSel) {
    if (langSel.options.length === 0) {
      availableLangs.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.textContent = lang.name;
        langSel.appendChild(opt);
      });
    }
    langSel.value = activeLang;
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (res.status === 401) { doLogout(); return null; }
  if (!res.ok) { console.error('API error', res.status, path); return null; }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err  = document.getElementById('loginErr');
  err.style.display = 'none';
  const data = await api('POST', '/auth/login', { username: user, password: pass });
  if (!data) { err.style.display = 'block'; return; }
  token = data.access_token;
  localStorage.setItem('fd_token', token);
  if (data.first_run) { showWizard(!data.is_default_password); } else { showApp(); }
}

async function showWizard(isReset) {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('mainView').classList.add('hidden');
  document.getElementById('wizardView').classList.remove('hidden');
  document.getElementById('defaultCredsHint').style.display = 'none';
  if (isReset) {
    document.getElementById('wizardStep1').classList.add('hidden');
    document.getElementById('wizardStep2').classList.remove('hidden');
    const scan = await api('POST', '/settings/scan');
    if (scan) { serverDisks = scan.disks; allDisks = scan.disks; allFans = scan.fans; serverFans = scan.fans; }
    buildWizardLists();
  } else {
    document.getElementById('wizardStep1').classList.remove('hidden');
    document.getElementById('wizardStep2').classList.add('hidden');
  }
}

async function wizardSetPassword() {
  const next    = document.getElementById('wizPwdNew').value;
  const confirm = document.getElementById('wizPwdConfirm').value;
  const err     = document.getElementById('wizPwdErr');
  err.style.display = 'none';
  if (next.length < 6) { err.textContent = T.pwdTooShort; err.style.display = 'block'; return; }
  if (next !== confirm) { err.textContent = T.pwdMismatch; err.style.display = 'block'; return; }
  const currentPwd = document.getElementById('wizPwdCurrent').value || 'fandock';
  const data = await api('POST', '/auth/change-password', { current_password: currentPwd, new_password: next });
  if (!data) { err.textContent = T.pwdChangeError; err.style.display = 'block'; return; }
  const scan = await api('POST', '/settings/scan');
  if (scan) { serverDisks = scan.disks; allDisks = scan.disks; serverFans = scan.fans; allFans = scan.fans; }
  document.getElementById('wizardStep1').classList.add('hidden');
  document.getElementById('wizardStep2').classList.remove('hidden');
  buildWizardLists();
}

function buildWizardLists() {
  const diskList = document.getElementById('wizDiskList');
  diskList.innerHTML = '';
  serverDisks.forEach((d, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:12px;padding:.75rem;background:var(--color-background-secondary);border-radius:var(--border-radius-md);';
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <code style="font-size:12px;color:var(--color-text-secondary);">${d.device}</code>
        <span style="font-size:12px;color:var(--color-text-tertiary);">${d.model || ''}</span>
        <span style="font-size:11px;color:var(--color-text-tertiary);">${d.serial || ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="disk-type-badge">${d.type}</span>
        <input class="cfg-input" id="wizDisk-${i}" placeholder="e.g. IronWolf 1" value="${(settingsData && settingsData.disk_friendly_names && (settingsData.disk_friendly_names[d.serial] || settingsData.disk_friendly_names[d.device])) || d.friendly_name || ''}" style="flex:1;">
      </div>`;
    diskList.appendChild(row);
  });
  const fanList = document.getElementById('wizFanList');
  fanList.innerHTML = '';
  if (serverFans.length === 0) {
    fanList.innerHTML = `<p style="font-size:12px;color:var(--color-text-tertiary);">${T.noFansDetected}</p>`;
    return;
  }
  serverFans.forEach((f, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';
    row.innerHTML = `
      <code style="font-size:12px;color:var(--color-text-secondary);min-width:80px;">${f.fan_id}</code>
      <input class="cfg-input" id="wizFan-${i}" placeholder="e.g. Front intake" value="${(settingsData && settingsData.fans && settingsData.fans.find(fc => fc.fan_id === f.fan_id)?.friendly_name) || f.friendly_name || ''}">
      <button class="test-btn" onclick="testFan('${f.fan_id}', this)"><i class="ti ti-player-play" style="font-size:11px;margin-right:3px;"></i>${T.test}</button>`;
    fanList.appendChild(row);
  });
}

async function wizardFinish() {
  const names = {};
  serverDisks.forEach((d, i) => { const el = document.getElementById(`wizDisk-${i}`); if (el && el.value) names[d.serial] = el.value; });
  if (Object.keys(names).length) await api('PUT', '/settings/friendly-names', { names });
  for (let i = 0; i < serverFans.length; i++) {
    const el = document.getElementById(`wizFan-${i}`);
    if (el && el.value) await api('PATCH', `/settings/fans/${serverFans[i].fan_id}`, { friendly_name: el.value });
  }
  await api('POST', '/auth/complete-setup');
  const hint = document.getElementById('defaultCredsHint');
  if (hint) hint.style.display = 'none';
  document.getElementById('wizardView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');
  showApp();
}

document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogout() {
  token = null;
  localStorage.removeItem('fd_token');
  stopPolling();
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('mainView').classList.add('hidden');
  document.getElementById('loginPass').value = '';
}

async function doChangePwd() {
  const current = document.getElementById('pwdCurrent').value;
  const next    = document.getElementById('pwdNew').value;
  const confirm = document.getElementById('pwdConfirm').value;
  const err     = document.getElementById('pwdErr');
  err.style.display = 'none';
  if (next !== confirm) { err.textContent = T.pwdMismatch; err.style.display = 'block'; return; }
  const data = await api('POST', '/auth/change-password', { current_password: current, new_password: next });
  if (!data) { err.textContent = T.pwdWrongCurrent; err.style.display = 'block'; return; }
  closePwdModal();
  alert(T.pwdUpdated);
}

function openChangePwd() {
  document.getElementById('pwdCurrent').value = '';
  document.getElementById('pwdNew').value = '';
  document.getElementById('pwdConfirm').value = '';
  document.getElementById('pwdErr').style.display = 'none';
  document.getElementById('pwdModal').classList.remove('hidden');
  toggleUserMenu(false);
}
function closePwdModal() { document.getElementById('pwdModal').classList.add('hidden'); }

// ── App bootstrap ─────────────────────────────────────────────────────────────
async function showApp(preloadedSettings) {
  const bannerDismissed = localStorage.getItem('fd_banner_dismissed');
  if (bannerDismissed) { const b = document.getElementById('onboardBanner'); if (b) b.style.display = 'none'; }
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('wizardView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');
  const hint = document.getElementById('defaultCredsHint');
  if (hint) hint.style.display = 'none';
  settingsData = preloadedSettings || await api('GET', '/settings/');
  if (settingsData) {
    unit = settingsData.temp_unit || 'C';
    if (settingsData.language && settingsData.language !== activeLang) {
      await loadLanguage(settingsData.language);
    }
    if (settingsData.all_disks && settingsData.all_disks.length > 0) allDisks = settingsData.all_disks;
    if (settingsData.all_fans && settingsData.all_fans.length > 0) allFans = settingsData.all_fans;
  }
  showView('dashboard', document.getElementById('navDash'));
  api('GET', '/auth/version').then(d => {
    if (d) {
      document.getElementById('appVersion').textContent = `v${d.version}`;
      const fv = document.getElementById('footerVersion');
      if (fv) fv.textContent = `v${d.version}`;
    }
  });
  startPolling();
}

// ── Navigation ────────────────────────────────────────────────────────────────
let _settingsRefreshTimer = null;

function showView(name, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'curves') { buildFanSelects(); buildChart(); renderPointRows(false); renderLinkedDisks(); }
  if (name === 'settings') {
    loadSettings();
    _settingsRefreshTimer = setInterval(() => refreshFanRpm(), POLL_INTERVAL_MS);
  } else {
    if (_settingsRefreshTimer) { clearInterval(_settingsRefreshTimer); _settingsRefreshTimer = null; }
  }
}

async function refreshFanRpm() {
  const snap = await api('GET', '/dashboard/snapshot');
  if (!snap || !snap.fans) return;
  snap.fans.forEach(f => {
    const fanList = allFans.length > 0 ? allFans : serverFans;
    const i = fanList.findIndex(ff => ff.fan_id === f.fan_id);
    if (i === -1) return;
    const rpm = f.current_rpm != null ? `${f.current_rpm} rpm` : '— rpm';
    const el = document.querySelector(`#fanCfgBody tr:nth-child(${i + 1}) td:nth-child(3) span`);
    if (el) el.textContent = rpm;
  });
}

function toggleUserMenu(force) {
  const dd = document.getElementById('userDropdown');
  const open = force !== undefined ? force : dd.classList.contains('hidden');
  dd.classList.toggle('hidden', !open);
}
document.addEventListener('click', e => { if (!e.target.closest('.user-menu')) toggleUserMenu(false); });

// ── Session timeout ──────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5000;
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 min of inactivity → logout
const SESSION_REFRESH_MARGIN_MS = 60 * 1000; // refresh token 1 min before it would expire server-side
let _idleTimer = null;
let _refreshTimer = null;

function _resetIdleTimer() {
  if (!token) return;
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(_onSessionTimeout, SESSION_TIMEOUT_MS);
}

function _onSessionTimeout() {
  if (token) doLogout();
}

['mousemove', 'mousedown', 'keydown', 'click', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, _resetIdleTimer, { passive: true });
});

async function _periodicRefresh() {
  if (!token) return;
  const data = await api('POST', '/auth/refresh');
  if (data && data.access_token) {
    token = data.access_token;
    localStorage.setItem('fd_token', token);
  }
}

function startPolling() {
  fetchSnapshot();
  checkHardwareChanges();
  pollTimer = setInterval(fetchSnapshot, POLL_INTERVAL_MS);
  setInterval(checkHardwareChanges, POLL_INTERVAL_MS * 6); // every ~30s
  _resetIdleTimer();
  // Refresh the JWT periodically so it never expires while the idle timer is still running
  _refreshTimer = setInterval(_periodicRefresh, SESSION_TIMEOUT_MS - SESSION_REFRESH_MARGIN_MS);
}
function stopPolling() {
  clearInterval(pollTimer);
  clearInterval(_refreshTimer);
  clearTimeout(_idleTimer);
}

async function fetchSnapshot() {
  const data = await api('GET', '/dashboard/snapshot');
  if (!data) return;
  serverDisks = data.disks || [];
  serverFans  = data.fans  || [];
  renderDiskGrid();
  renderFanPanel();
  if (data.any_critical) showCriticalBanner();
}

async function forceRefresh() {
  const data = await api('POST', '/dashboard/refresh');
  if (!data) return;
  serverDisks = data.disks || [];
  serverFans  = data.fans  || [];
  renderDiskGrid();
  renderFanPanel();
  if (data.any_critical) showCriticalBanner();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function threshClass(disk) {
  const s = disk.status;
  if (s === 'critical') return 't-critical';
  if (s === 'hot')      return 't-hot';
  if (s === 'warm')     return 't-warm';
  return 't-normal';
}

function threshTooltip(disk) {
  const t = DISK_THRESHOLDS[disk.type] || DISK_THRESHOLDS.HDD;
  return T.thresholdsLabel.replace('{type}', disk.type) + ` — ${T.warm}: ${toDisplay(t.warm)}${unitLabel()} · ${T.hot}: ${toDisplay(t.hot)}${unitLabel()} · ${T.critical}: ${toDisplay(t.critical)}${unitLabel()}`;
}

function toDisplay(c) { return unit === 'F' ? Math.round(c * 9 / 5 + 32) : c; }
function fromDisplay(v) { return unit === 'F' ? Math.round((v - 32) * 5 / 9) : v; }
function unitLabel() { return unit === 'F' ? '°F' : '°C'; }

function renderDiskGrid() {
  const grid = document.getElementById('diskGrid');
  grid.innerHTML = '';
  serverDisks.forEach(d => {
    const name = (settingsData && settingsData.disk_friendly_names && (settingsData.disk_friendly_names[d.serial] || settingsData.disk_friendly_names[d.device])) || d.friendly_name || d.device;
    const tempVal = unit === 'F' ? d.temperature_f : d.temperature_c;
    const tempStr = tempVal != null ? tempVal : '—';
    const card = document.createElement('div');
    card.className = 'disk-card';
    card.title = threshTooltip(d);
    card.innerHTML = `
      <div class="disk-name">${name}</div>
      <div class="disk-temp ${threshClass(d)}">${tempStr}<span>${unitLabel()}</span></div>
      <div class="disk-model">${d.device}</div>
      <span class="disk-type-badge">${d.type}</span>`;
    grid.appendChild(card);
  });
}

const _fanRotations = {};
let _fanAnimFrame = null;
let _fanLastTs = null;
let _fanDisplayedRpms = {};

function _fanAnimate(ts) {
  if (!_fanLastTs) _fanLastTs = ts;
  const dt = Math.min((ts - _fanLastTs) / 1000, 0.05);
  _fanLastTs = ts;
  serverFans.forEach(f => {
    if (!_fanRotations[f.fan_id]) _fanRotations[f.fan_id] = 0;
    const rpm = f.current_rpm || 0;
    // Initialize displayed rpm if first time
    if (_fanDisplayedRpms[f.fan_id] == null) _fanDisplayedRpms[f.fan_id] = rpm;
    // Smoothly approach the target rpm using an exponential smoothing (time constant tau)
    const tau = 1; // seconds — lower = quicker response, higher = slower deceleration
    const alpha = 1 - Math.exp(-dt / tau);
    _fanDisplayedRpms[f.fan_id] += (rpm - _fanDisplayedRpms[f.fan_id]) * alpha;
    const usedRpm = _fanDisplayedRpms[f.fan_id];
    _fanRotations[f.fan_id] = (_fanRotations[f.fan_id] + usedRpm * dt) % 360;
    const icon = document.getElementById(`fan-icon-${f.fan_id}`);
    if (icon) icon.setAttribute('transform', `translate(70,70) rotate(${_fanRotations[f.fan_id].toFixed(1)})`);
  });
  _fanAnimFrame = requestAnimationFrame(_fanAnimate);
}

function _fanArcD(pct) {
  const R = 52, CX = 70, CY = 70;
  const GAP = 60, ARC = 300;
  const startAngle = 90 + GAP / 2;
  const sweep = ARC * Math.max(0.001, Math.min(1, pct));
  const toRad = a => a * Math.PI / 180;
  const pt = a => ({ x: CX + R * Math.cos(toRad(a)), y: CY + R * Math.sin(toRad(a)) });
  const s = pt(startAngle), e = pt(startAngle + sweep);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function renderFanPanel() {
  const panel = document.getElementById('fanPanel');
  if (_fanAnimFrame) { cancelAnimationFrame(_fanAnimFrame); _fanAnimFrame = null; _fanLastTs = null; }
  panel.innerHTML = '';
  panel.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:12px;';

  const ns = 'http://www.w3.org/2000/svg';
  serverFans.forEach(f => {
    const pct = f.current_pwm / 255;
    const rpm = f.current_rpm || 0;
    const label = f.friendly_name || f.fan_id;
    const R = 52, CX = 70, CY = 70, STROKE = 14;
    const bladeR = R - STROKE - 6;

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--color-background-primary); border:0.5px solid var(--color-border-tertiary); border-radius:var(--border-radius-lg); padding:1rem; display:flex; flex-direction:column; align-items:center;';

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 140 140');
    svg.setAttribute('width', '140');
    svg.setAttribute('height', '140');

    const track = document.createElementNS(ns, 'path');
    track.setAttribute('d', _fanArcD(1));
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'var(--color-border-secondary)');
    track.setAttribute('stroke-width', STROKE);
    track.setAttribute('stroke-linecap', 'round');
    svg.appendChild(track);

    const fill = document.createElementNS(ns, 'path');
    fill.id = `fan-arc-${f.fan_id}`;
    fill.setAttribute('d', _fanArcD(pct));
    fill.setAttribute('fill', 'none');
    fill.setAttribute('stroke', rpm === 0 ? 'var(--color-border-tertiary)' : '#378ADD');
    fill.setAttribute('stroke-width', STROKE);
    fill.setAttribute('stroke-linecap', 'round');
    svg.appendChild(fill);

    const iconG = document.createElementNS(ns, 'g');
    iconG.id = `fan-icon-${f.fan_id}`;
    iconG.setAttribute('transform', `translate(${CX},${CY})`);
    for (let i = 0; i < 4; i++) {
      const blade = document.createElementNS(ns, 'ellipse');
      blade.setAttribute('cx', (bladeR * 0.45).toFixed(1));
      blade.setAttribute('cy', '0');
      blade.setAttribute('rx', (bladeR * 0.45).toFixed(1));
      blade.setAttribute('ry', (bladeR * 0.22).toFixed(1));
      blade.setAttribute('fill', 'var(--color-text-secondary)');
      blade.setAttribute('opacity', '0.9');
      blade.setAttribute('transform', `rotate(${i * 90})`);
      iconG.appendChild(blade);
    }
    const hub = document.createElementNS(ns, 'circle');
    hub.setAttribute('cx', '0'); hub.setAttribute('cy', '0');
    hub.setAttribute('r', (bladeR * 0.14).toFixed(1));
    hub.setAttribute('fill', 'var(--color-text-primary)');
    iconG.appendChild(hub);
    svg.appendChild(iconG);
    card.appendChild(svg);

    card.innerHTML += `
      <div style="font-size:13px; font-weight:500; color:var(--color-text-primary); margin-top:4px;">${label}</div>
      <div id="fan-pct-${f.fan_id}" style="font-size:20px; font-weight:500; color:var(--color-text-primary);">${Math.round(pct * 100)}%</div>
      <div id="fan-rpm-${f.fan_id}" style="font-size:12px; color:var(--color-text-secondary);">${rpm === 0 ? T.fanStopped : rpm + ' rpm'}</div>`;

    panel.appendChild(card);
  });

  if (serverFans.length > 0) requestAnimationFrame(_fanAnimate);
}

function showCriticalBanner() {
  const banner = document.getElementById('onboardBanner');
  banner.style.display = 'flex';
  banner.style.background = 'var(--color-background-danger)';
  banner.style.borderColor = 'var(--color-border-danger)';
  banner.style.color = 'var(--color-text-danger)';
  banner.querySelector('strong').textContent = T.criticalTemp;
}

// ── Curve editor ──────────────────────────────────────────────────────────────
function activeFan() { return document.getElementById('fanSelect').value; }

function buildFanSelects() {
  const sel = document.getElementById('fanSelect');
  sel.innerHTML = '';
  const controlled = (settingsData && settingsData.fans) ? settingsData.fans.filter(f => f.controlled) : serverFans;
  controlled.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.fan_id;
    opt.textContent = f.friendly_name || f.fan_id;
    sel.appendChild(opt);
  });
  controlled.forEach(f => { if (!curves[f.fan_id]) loadCurve(f.fan_id); });
  renderLinkedDisks();
}

async function loadCurve(fanId) {
  const data = await api('GET', `/fans/${fanId}/curve`);
  if (!data) return;
  curves[fanId] = data.points.map(p => ({ t: p.temp_c, p: p.pwm_pct }));
  if (fanId === activeFan()) { buildChart(); renderPointRows(false); renderLinkedDisks(); }
}

function getMaxTempC() {
  const temps = serverDisks.map(d => d.temperature_c).filter(t => t != null);
  return temps.length ? Math.max(...temps) : 35;
}

function interpolate(pts, tempC) {
  if (!pts || !pts.length) return 50;
  const sorted = [...pts].sort((a, b) => a.t - b.t);
  if (tempC <= sorted[0].t) return sorted[0].p;
  if (tempC >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].p;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].t <= tempC && tempC <= sorted[i + 1].t) {
      const r = (tempC - sorted[i].t) / (sorted[i + 1].t - sorted[i].t);
      return sorted[i].p + r * (sorted[i + 1].p - sorted[i].p);
    }
  }
  return 50;
}

function sortCurve(fanId) { if (curves[fanId]) curves[fanId].sort((a, b) => a.t - b.t); }

function updateBadge() {
  const fan = activeFan();
  const fanCfg = settingsData && settingsData.fans ? settingsData.fans.find(f => f.fan_id === fan) : null;
  const linked = fanCfg ? (fanCfg.linked_disks || []) : [];
  let tempC;
  if (linked.length > 0) {
    const linkedTemps = serverDisks.filter(d => linked.includes(d.serial) && d.temperature_c != null).map(d => d.temperature_c);
    tempC = linkedTemps.length > 0 ? Math.max(...linkedTemps) : getMaxTempC();
  } else {
    tempC = getMaxTempC();
  }
  document.getElementById('curTempLabel').textContent = `${toDisplay(tempC)}${unitLabel()}`;
  document.getElementById('curFanLabel').textContent = `${Math.round(interpolate(curves[fan] || [], tempC))}%`;
}

function buildChart() {
  const fan = activeFan();
  if (!fan) return;
  sortCurve(fan);
  const pts = curves[fan] || [];
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#aaa' : '#777';
  const temps = pts.map(p => toDisplay(p.t));
  const padding = unit === 'F' ? 9 : 5;
  const minT = temps.length > 0 ? Math.max(unit === 'F' ? 32 : 0, Math.min(...temps) - padding) : (unit === 'F' ? 59 : 15);
  const maxT = temps.length > 0 ? Math.min(unit === 'F' ? 212 : 100, Math.max(...temps) + padding) : (unit === 'F' ? 185 : 85);
  const chartData = pts.map(p => ({ x: toDisplay(p.t), y: p.p }));
  const tempC = getMaxTempC();
  const opData = [{ x: minT, y: interpolate(pts, tempC) }, { x: maxT, y: interpolate(pts, tempC) }];
  if (chart) { chart.destroy(); chart = null; }
  const ctx = document.getElementById('curveCanvas').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: T.fanCurve,
          data: chartData,
          borderColor: '#378ADD', backgroundColor: 'rgba(55,138,221,0.08)',
          borderWidth: 2.5, pointRadius: 6, pointHoverRadius: 8, pointBackgroundColor: '#378ADD',
          tension: 0, fill: true,
          dragData: { round: 1, showTooltip: true,
            onDragStart: (e, di, index) => { if (index === (curves[activeFan()] || []).length - 1) return false; },
          },
        },
        {
          label: T.currentOp, data: opData,
          borderColor: '#BA7517', borderWidth: 2, borderDash: [4, 3], pointRadius: 0, dragData: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        dragData: {
          round: 1, showTooltip: true, onDragStart: () => {},
          onDrag: (e, di, i, val) => {
            const fan = activeFan();
            if (di === 0 && curves[fan]) {
              const pts = curves[fan];
              if (i === pts.length - 1) return false;
              const prevMax = i > 0 ? pts[i-1].p : 0;
              const nextMin = i < pts.length - 2 ? pts[i+1].p : 100;
              curves[fan][i] = { t: Math.round(fromDisplay(val.x)), p: Math.max(prevMax, Math.min(nextMin, Math.round(val.y))) };
            }
            updateBadge();
          },
          onDragEnd: () => {
            const fan = activeFan(), pts = curves[fan] || [];
            if (pts.length > 0) pts[pts.length - 1].p = 100;
            sortCurve(fan); buildChart(); renderPointRows(false);
          },
        },
      },
      scales: {
        x: { type: 'linear', min: minT, max: maxT, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: v => v + unitLabel() }, title: { display: true, text: `${T.temperatureAxis} (${unitLabel()})`, color: textColor, font: { size: 11 } } },
        y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: v => v + '%' }, title: { display: true, text: T.fanSpeedAxis, color: textColor, font: { size: 11 } } },
      },
      animation: { duration: 200 },
    },
  });
  updateBadge(); checkWarnBar();
}

function renderPointRows(doRebuild) {
  const fan = activeFan(); sortCurve(fan);
  const container = document.getElementById('pointRows'); container.innerHTML = '';
  (curves[fan] || []).forEach((pt, i) => {
    const row = document.createElement('div'); row.className = 'point-row';
    const tIn = document.createElement('input'); tIn.className = 'point-input'; tIn.type = 'number'; tIn.min = 15; tIn.max = 85; tIn.value = toDisplay(pt.t);
    tIn.onchange = () => { curves[fan][i].t = Math.round(fromDisplay(parseFloat(tIn.value) || pt.t)); sortCurve(fan); refresh(); };
    const pIn = document.createElement('input'); pIn.className = 'point-input'; pIn.type = 'number'; pIn.min = 0; pIn.max = 100; pIn.value = pt.p;
    const isLast = i === (curves[fan] || []).length - 1;
    if (isLast) { pIn.disabled = true; pIn.style.opacity = '0.5'; pIn.title = T.lastPointFixed; }
    else {
      pIn.onchange = () => {
        const pts = curves[fan], prevMax = i > 0 ? pts[i-1].p : 0, nextMin = i < pts.length - 2 ? pts[i+1].p : 100;
        const v = Math.max(prevMax, Math.min(nextMin, parseInt(pIn.value) || 0));
        curves[fan][i].p = v; pIn.value = v; refresh();
      };
    }
    const del = document.createElement('button'); del.className = 'del-btn'; del.title = T.removePoint;
    del.innerHTML = '<i class="ti ti-trash"></i>';
    if (i === 0 || isLast) { del.disabled = true; del.style.opacity = '0.3'; del.style.cursor = 'not-allowed'; }
    else { del.onclick = () => { if ((curves[fan] || []).length > 2) { curves[fan].splice(i, 1); refresh(); } }; }
    row.append(tIn, pIn, del); container.appendChild(row);
  });
  if (doRebuild) buildChart();
}

function refresh() { buildChart(); renderPointRows(false); updateBadge(); }

function checkWarnBar() {
  const fan = activeFan();
  const minP = Math.min(...(curves[fan] || []).map(p => p.p));
  document.getElementById('warnBar').style.display = minP < 20 ? 'block' : 'none';
}

function renderLinkedDisks() {
  const fan = activeFan(); const container = document.getElementById('curveLinkedDisks');
  if (!container) return; container.innerHTML = '';
  const fanCfg = settingsData && settingsData.fans ? settingsData.fans.find(f => f.fan_id === fan) : null;
  const linked = fanCfg ? (fanCfg.linked_disks || []) : [];
  const diskList = allDisks.length > 0 ? allDisks : serverDisks;
  if (diskList.length === 0) { container.innerHTML = `<p style="font-size:12px;color:var(--color-text-tertiary);">${T.noDisksDetected}</p>`; return; }
  diskList.forEach((d, i) => {
    const name = (settingsData && settingsData.disk_friendly_names && (settingsData.disk_friendly_names[d.serial] || settingsData.disk_friendly_names[d.device])) || d.device;
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px;';
    row.innerHTML = `
      <label class="toggle"><input type="checkbox" ${linked.includes(d.serial) ? 'checked' : ''} id="linked-${i}" onchange="onLinkedDiskChange()"><span class="toggle-slider"></span></label>
      <span style="font-size:13px;color:var(--color-text-primary);">${name}</span>
      <code style="font-size:11px;color:var(--color-text-tertiary);">${d.serial || d.device}</code>
      <span class="disk-type-badge">${d.type}</span>`;
    container.appendChild(row);
  });
}

async function onLinkedDiskChange() {
  const fan = activeFan(), diskList = allDisks.length > 0 ? allDisks : serverDisks, linked = [];
  diskList.forEach((d, i) => { const el = document.getElementById(`linked-${i}`); if (el && el.checked) linked.push(d.serial); });
  await api('PATCH', `/settings/fans/${fan}`, { linked_disks: linked });
  if (settingsData && settingsData.fans) { const fc = settingsData.fans.find(f => f.fan_id === fan); if (fc) fc.linked_disks = linked; }
  updateBadge();
}

function addPoint() {
  const fan = activeFan(), pts = curves[fan] || [], s = [...pts].sort((a, b) => a.t - b.t);
  let bestGap = 0, bestT = s[0].t + 5;
  for (let i = 0; i < s.length - 1; i++) { const gap = s[i+1].t - s[i].t; if (gap > bestGap) { bestGap = gap; bestT = Math.round((s[i].t + s[i+1].t) / 2); } }
  curves[fan].push({ t: bestT, p: Math.round(interpolate(pts, bestT)) }); refresh();
}

async function saveCurve() {
  const fan = activeFan(), minP = Math.min(...(curves[fan] || []).map(p => p.p));
  if (minP < 20 && !confirm(T.curveBelow20)) return;
  const data = await api('PUT', `/fans/${fan}/curve`, { fan_id: fan, points: (curves[fan] || []).map(p => ({ temp_c: p.t, pwm_pct: p.p })) });
  if (data) { await loadCurve(fan); alert(T.curveSaved); }
}

async function discardCurve() { const fan = activeFan(); delete curves[fan]; await loadCurve(fan); }
document.getElementById('fanSelect').onchange = () => { loadCurve(activeFan()); };

// ── Hardware change detection ───────────────────────────────────────────────
async function checkHardwareChanges() {
  const data = await api('GET', '/settings/hardware-changes');
  if (data && data.pending) showHardwareChangeModal(data);
}

function showHardwareChangeModal(data) {
  document.getElementById('hwChangeTitle').textContent = T.hwChangeTitle;
  document.getElementById('hwChangeDesc').textContent = T.hwChangeDesc;
  const list = document.getElementById('hwChangeList');
  list.innerHTML = '';
  (data.new_disks || []).forEach(d => {
    const li = document.createElement('li');
    li.textContent = `${T.hwNewDisk}: ${d.model || d.device} (${d.serial || ''})`;
    list.appendChild(li);
  });
  (data.removed_disks || []).forEach(serial => {
    const li = document.createElement('li');
    li.textContent = `${T.hwRemovedDisk}: ${serial}`;
    list.appendChild(li);
  });
  document.getElementById('btnHwIgnore').textContent = T.ignore;
  document.getElementById('btnHwReview').textContent = T.reviewChanges;
  document.getElementById('hwChangeModal').classList.remove('hidden');
}

function closeHwChangeModal() {
  document.getElementById('hwChangeModal').classList.add('hidden');
}

async function ignoreHardwareChanges() {
  await api('POST', '/settings/acknowledge-hardware-changes');
  closeHwChangeModal();
  await forceRefresh();
}

async function reviewHardwareChanges() {
  await api('POST', '/settings/dismiss-hardware-changes');
  closeHwChangeModal();
  await showWizard(true); // reset=true → pre-filled wizard, skips password step
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  settingsData = await api('GET', '/settings/');
  if (!settingsData) return;
  unit = settingsData.temp_unit || 'C';
  document.getElementById('btnC').classList.toggle('active', unit === 'C');
  document.getElementById('btnF').classList.toggle('active', unit === 'F');
  const langSel = document.getElementById('langSelect');
  if (langSel) langSel.value = settingsData.language || activeLang;
  if (settingsData.all_disks && settingsData.all_disks.length > 0) allDisks = settingsData.all_disks;
  if (settingsData.all_fans && settingsData.all_fans.length > 0) allFans = settingsData.all_fans;
  buildDiskCfg(settingsData); buildFanCfg(settingsData);
}

function buildDiskCfg(cfg) {
  const tb = document.getElementById('diskCfgBody'); tb.innerHTML = '';
  (allDisks.length > 0 ? allDisks : serverDisks).forEach((d, i) => {
    const name = (settingsData && settingsData.disk_friendly_names && (settingsData.disk_friendly_names[d.serial] || settingsData.disk_friendly_names[d.device])) || d.device;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code style="font-size:12px;color:var(--color-text-secondary);">${d.device}</code></td>
      <td><span style="font-size:12px;color:var(--color-text-tertiary);">${d.model || '—'}</span></td>
      <td><span style="font-size:11px;color:var(--color-text-tertiary);">${d.serial || '—'}</span></td>
      <td><span class="disk-type-badge">${d.type}</span></td>
      <td><input class="cfg-input" id="dname-${i}" value="${name}"></td>
      <td><label class="toggle"><input type="checkbox" ${!cfg.unmonitored_disks || !cfg.unmonitored_disks.includes(d.device) ? 'checked' : ''} id="dmon-${i}"><span class="toggle-slider"></span></label></td>
      <td><span class="detected-badge">${T.smartOk}</span></td>`;
    tb.appendChild(tr);
  });
}

function buildFanCfg(cfg) {
  const tb = document.getElementById('fanCfgBody'); tb.innerHTML = '';
  const unmonitored = (cfg && cfg.unmonitored_fans) || [];
  (allFans.length > 0 ? allFans : serverFans).forEach((f, i) => {
    const monitored = !unmonitored.includes(f.fan_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code style="font-size:12px;color:var(--color-text-secondary);">${f.fan_id}</code></td>
      <td><input class="cfg-input" id="fname-${i}" value="${f.friendly_name || f.fan_id}"></td>
      <td><span style="font-size:13px;color:var(--color-text-secondary);">${f.current_rpm != null ? f.current_rpm + ' rpm' : '— rpm'}</span></td>
      <td><label class="toggle"><input type="checkbox" ${monitored ? 'checked' : ''} id="fmon-${i}" onchange="onFanMonitorChange(${i})"><span class="toggle-slider"></span></label></td>
      <td><label class="toggle"><input type="checkbox" ${f.controlled ? 'checked' : ''} id="fctrl-${i}"><span class="toggle-slider"></span></label></td>
      <td><button class="test-btn" id="test-${f.fan_id}" onclick="testFan('${f.fan_id}')"><i class="ti ti-player-play" style="font-size:11px;margin-right:3px;"></i>${T.test}</button></td>`;
    tb.appendChild(tr);
    if (!monitored) { const c = document.getElementById(`fctrl-${i}`); if (c) { c.checked = false; c.disabled = true; } }
  });
}

function onFanMonitorChange(i) {
  const mon = document.getElementById(`fmon-${i}`), ctrl = document.getElementById(`fctrl-${i}`);
  if (!mon || !ctrl) return;
  if (!mon.checked) { ctrl.checked = false; ctrl.disabled = true; } else { ctrl.disabled = false; }
}

async function testFan(id, btnEl) {
  if (window._testRunning) { alert(T.fanTestAlreadyRunning); return; }
  if (!confirm(T.fanTestConfirm)) return;
  window._testRunning = true;
  document.querySelectorAll('.test-btn').forEach(b => b.disabled = true);
  const btn = btnEl || document.getElementById('test-' + id);
  const bar = document.getElementById('bar-' + id);
  if (btn) { btn.classList.add('testing'); btn.innerHTML = `<i class="ti ti-player-stop" style="font-size:11px;margin-right:3px;"></i>${T.testing}`; }
  if (bar) { bar.style.width = '100%'; bar.style.background = '#BA7517'; }
  await api('POST', `/fans/${id}/test`);
  const pollTest = setInterval(async () => {
    const status = await api('GET', '/dashboard/test-status');
    if (status && !status.test_in_progress) {
      clearInterval(pollTest); window._testRunning = false;
      document.querySelectorAll('.test-btn').forEach(b => b.disabled = false);
      if (btn) { btn.classList.remove('testing'); btn.innerHTML = `<i class="ti ti-player-play" style="font-size:11px;margin-right:3px;"></i>${T.test}`; }
      if (bar) bar.style.background = '#378ADD';
    }
  }, 1000);
}

function setUnit(u) {
  unit = u;
  document.getElementById('btnC').classList.toggle('active', u === 'C');
  document.getElementById('btnF').classList.toggle('active', u === 'F');
  renderDiskGrid(); if (chart) refresh();
}

async function rescanHardware() {
  const badge = document.getElementById('scanBadge');
  badge.textContent = T.scanning; badge.style.background = 'var(--color-background-warning)'; badge.style.color = 'var(--color-text-warning)';
  const data = await api('POST', '/settings/scan');
  badge.textContent = T.scanned; badge.style.background = ''; badge.style.color = '';
  if (data) {
    serverDisks = data.disks; allDisks = data.disks; serverFans = data.fans;
    settingsData = await api('GET', '/settings/');
    allFans = settingsData.all_fans || data.fans;
    buildDiskCfg(settingsData); buildFanCfg(settingsData);
    const diagPanel = document.getElementById('fanDiagnostic');
    if (data.fans.length === 0 && diagPanel) { const diag = await api('GET', '/settings/fan-diagnostic'); if (diag) showFanDiagnostic(diag, diagPanel); }
    else if (diagPanel) diagPanel.classList.add('hidden');
  }
}

function showFanDiagnostic(diag, panel) {
  panel.classList.remove('hidden');
  if (diag.module_loaded && diag.pwm_available) {
    panel.style.cssText = 'background:var(--color-background-success);border:0.5px solid var(--color-border-success);color:var(--color-text-success);';
    panel.innerHTML = `<i class="ti ti-check" style="margin-right:6px;"></i>${T.diagChipOk} <strong>${diag.chip_detected}</strong> ${T.diagPwmAvailable}`;
    return;
  }
  if (diag.chip_detected && !diag.module_loaded) {
    panel.style.cssText = 'background:var(--color-background-warning);border:0.5px solid var(--color-border-warning);color:var(--color-text-warning);';
    panel.innerHTML = `<i class="ti ti-alert-triangle" style="margin-right:6px;"></i><strong>${T.diagChipDriverNotLoaded}</strong> ${diag.chip_detected}<br><br>
      <strong>${T.diagLoadNow}</strong><br>
      <code style="display:block;margin:.5rem 0;padding:.4rem .6rem;background:rgba(0,0,0,.1);border-radius:4px;">${diag.instructions.load_now}</code>
      <strong>${T.diagPersistTruenas}</strong><br><span style="font-size:12px;">${diag.instructions.persist_truenas}</span><br><br>
      <strong>${T.diagPersistLinux}</strong><br>
      <code style="display:block;margin:.5rem 0;padding:.4rem .6rem;background:rgba(0,0,0,.1);border-radius:4px;">${diag.instructions.persist_linux}</code>
      ${T.diagAfterRescan}`;
    if (diag.module_alternative) panel.innerHTML += `<br><strong>${T.diagAlternativeModule}</strong><br><code style="display:block;margin:.5rem 0;padding:.4rem .6rem;background:rgba(0,0,0,.1);border-radius:4px;">modprobe ${diag.module_alternative}</code>`;
    return;
  }
  panel.style.cssText = 'background:var(--color-background-danger);border:0.5px solid var(--color-border-danger);color:var(--color-text-danger);';
  panel.innerHTML = `<i class="ti ti-x" style="margin-right:6px;"></i><strong>${T.diagNoChip}</strong><br><span style="font-size:12px;margin-top:.5rem;display:block;">${T.diagNoChipDesc}</span>`;
}

async function saveSettings() {
  const names = {};
  (allDisks.length > 0 ? allDisks : serverDisks).forEach((d, i) => { const el = document.getElementById(`dname-${i}`); if (el) names[d.serial] = el.value; });
  await api('PUT', '/settings/friendly-names', { names });
  const unmonitored = [], unmonitored_fans = [];
  (allDisks.length > 0 ? allDisks : serverDisks).forEach((d, i) => { const el = document.getElementById(`dmon-${i}`); if (el && !el.checked) unmonitored.push(d.device); });
  const fanList = allFans.length > 0 ? allFans : serverFans;
  fanList.forEach((f, i) => { const el = document.getElementById(`fmon-${i}`); if (el && !el.checked) unmonitored_fans.push(f.fan_id); });
  for (let i = 0; i < fanList.length; i++) {
    const f = fanList[i], nameEl = document.getElementById(`fname-${i}`), ctrlEl = document.getElementById(`fctrl-${i}`);
    if (nameEl || ctrlEl) await api('PATCH', `/settings/fans/${f.fan_id}`, { friendly_name: nameEl ? nameEl.value : undefined, controlled: ctrlEl ? ctrlEl.checked : undefined });
  }
  const langSel = document.getElementById('langSelect');
  const selectedLang = langSel ? langSel.value : activeLang;
  await api('PATCH', '/settings/global', { temp_unit: unit, unmonitored_disks: unmonitored, unmonitored_fans, language: selectedLang });
  if (selectedLang !== activeLang) await loadLanguage(selectedLang);
  settingsData = await api('GET', '/settings/');
  if (settingsData) {
    if (settingsData.all_disks && settingsData.all_disks.length > 0) allDisks = settingsData.all_disks;
    if (settingsData.all_fans && settingsData.all_fans.length > 0) allFans = settingsData.all_fans;
  }
  await forceRefresh();
  showView('dashboard', document.getElementById('navDash'));
}

async function discardSettings() {
  settingsData = await api('GET', '/settings/');
  if (settingsData) {
    if (settingsData.all_disks && settingsData.all_disks.length > 0) allDisks = settingsData.all_disks;
    if (settingsData.all_fans && settingsData.all_fans.length > 0) allFans = settingsData.all_fans;
  }
  showView('dashboard', document.getElementById('navDash'));
}

function dismissBanner() { document.getElementById('onboardBanner').style.display = 'none'; localStorage.setItem('fd_banner_dismissed', '1'); }

async function resetConfig() {
  if (!confirm(T.resetConfigConfirm)) return;
  toggleUserMenu(false);
  await api('POST', '/auth/reset-config');
  localStorage.removeItem('fd_banner_dismissed');
  doLogout();
}
