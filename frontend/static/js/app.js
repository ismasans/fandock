// ── i18n strings ──────────────────────────────────────────────────────────────
const T = {
  dashboard: 'Dashboard',
  curves: 'Curves',
  settings: 'Settings',
  signIn: 'Sign in',
  logout: 'Log out',
  changePassword: 'Change password',
  currentPassword: 'Current password',
  newPassword: 'New password',
  confirmPassword: 'Confirm new password',
  updatePassword: 'Update password',
  cancel: 'Cancel',
  saveSettings: 'Save settings',
  discardChanges: 'Discard changes',
  saveCurve: 'Save curve',
  addPoint: 'Add point',
  rescan: 'Re-scan hardware',
  test: 'Test',
  testing: 'Testing…',
  diskTemps: 'Disk temperatures',
  fanStatus: 'Fan status',
  hoverThreshold: '— hover a disk to see its specific thresholds',
  loginError: 'Incorrect username or password.',
  pwdMismatch: 'Passwords do not match.',
  pwdWrongCurrent: 'Current password is incorrect.',
  pwdUpdated: 'Password updated.',
  curveBelow20: 'Minimum fan speed is below 20%. This may reduce airflow and shorten drive lifespan. Save anyway?',
  curveSaved: 'Curve saved.',
  errorLoadingData: 'Error loading data from server.',
  scanning: 'scanning…',
  scanned: 'scanned',
  normal: 'Normal', warm: 'Warm', hot: 'Hot', critical: 'Critical',
  fanCurve: 'Fan curve',
  currentOp: 'Current operating point',
  temperatureAxis: 'Disk temperature',
  fanSpeedAxis: 'Fan speed',
  hottestDisk: 'Hottest disk (auto)',
  now: 'Now',
  dragSupport: 'Drag points on the chart to edit the curve, or use the table below.',
  onboardMsg: 'FanDock controls the fans connected to your disk enclosure. Incorrect configuration may reduce airflow and shorten drive lifespan. Always verify your fan mapping using the Test button in Settings before saving a curve.',
  dismiss: 'Dismiss',
  criticalTemp: 'Critical temperature:',
  smartOk: 'SMART ok',
  device: 'Device', model: 'Model', type: 'Type', friendlyName: 'Friendly name',
  monitor: 'Monitor', pwmChannel: 'PWM channel', currentRpm: 'Current RPM',
  control: 'Control', tempUnits: 'Temperature units', chooseScale: 'Choose your preferred scale',
  alertOnCritical: 'Alert on critical temperature',
  alertDesc: 'Show a warning banner when a disk reaches critical level',
  hardwareDetection: 'Hardware detection',
  hardwareDesc: 'FanDock detected the following hardware automatically. Assign friendly names and configure each device.',
  disks: 'Disks', fans: 'Fans', preferences: 'Preferences',
  fansDesc: 'Map each PWM channel to a physical fan. Use Test to spin it at full speed for 3 seconds to identify it physically.',
  fanCurveEditor: 'Fan curve editor',
  temperature: 'Temperature', fanSpeed: 'Fan speed (%)',
};

// ── State ────────────────────────────────────────────────────────────────────
let token = localStorage.getItem('fd_token') || null;
let unit = 'C';
let alertEnabled = true;
let chart = null;
let curves = {};           // { fan_id: [{t, p}, ...] }
let serverDisks = [];      // latest snapshot disks
let serverFans = [];       // latest snapshot fans
let settingsData = null;   // loaded settings
let pollTimer = null;

const DISK_THRESHOLDS = {
  HDD:  { warm: 40, hot: 45, critical: 55 },
  SSD:  { warm: 50, hot: 60, critical: 70 },
  NVMe: { warm: 55, hot: 65, critical: 75 },
};

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

// ── Auth ─────────────────────────────────────────────────────────────────────
async function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err  = document.getElementById('loginErr');
  err.style.display = 'none';
  const data = await api('POST', '/auth/login', { username: user, password: pass });
  if (!data) { err.style.display = 'block'; return; }
  token = data.access_token;
  localStorage.setItem('fd_token', token);
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
function showApp() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');
  showView('dashboard', document.getElementById('navDash'));
  startPolling();
}

// Auto-login if token exists
if (token) showApp();

// ── Navigation ────────────────────────────────────────────────────────────────
function showView(name, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'curves') { buildFanSelects(); buildChart(); renderPointRows(false); }
  if (name === 'settings') loadSettings();
}

function toggleUserMenu(force) {
  const dd = document.getElementById('userDropdown');
  const open = force !== undefined ? force : dd.classList.contains('hidden');
  dd.classList.toggle('hidden', !open);
}
document.addEventListener('click', e => {
  if (!e.target.closest('.user-menu')) toggleUserMenu(false);
});

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling() { fetchSnapshot(); pollTimer = setInterval(fetchSnapshot, 10000); }
function stopPolling()  { clearInterval(pollTimer); }

async function fetchSnapshot() {
  const data = await api('GET', '/dashboard/snapshot');
  if (!data) return;
  serverDisks = data.disks || [];
  serverFans  = data.fans  || [];
  renderDiskGrid();
  renderFanPanel();
  if (alertEnabled && data.any_critical) showCriticalBanner();
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
  return `${disk.type} thresholds — Warm: ${toDisplay(t.warm)}${unitLabel()} · Hot: ${toDisplay(t.hot)}${unitLabel()} · Critical: ${toDisplay(t.critical)}${unitLabel()}`;
}

function toDisplay(c) {
  if (unit === 'F') return Math.round(c * 9 / 5 + 32);
  return c;
}
function fromDisplay(v) {
  if (unit === 'F') return Math.round((v - 32) * 5 / 9);
  return v;
}
function unitLabel() { return unit === 'F' ? '°F' : '°C'; }

function renderDiskGrid() {
  const grid = document.getElementById('diskGrid');
  grid.innerHTML = '';
  serverDisks.forEach(d => {
    const name = d.friendly_name || d.device;
    const tempVal = unit === 'F' ? d.temperature_f : d.temperature_c;
    const tempStr = tempVal != null ? tempVal : '—';
    const card = document.createElement('div');
    card.className = 'disk-card';
    card.title = threshTooltip(d);
    card.innerHTML = `
      <div class="disk-name">${name}</div>
      <div class="disk-temp ${threshClass(d)}" id="t-${d.device.replace('/dev/','')}">${tempStr}<span>${unitLabel()}</span></div>
      <div class="disk-model">${d.device}</div>
      <span class="disk-type-badge">${d.type}</span>`;
    grid.appendChild(card);
  });
}

function renderFanPanel() {
  const panel = document.getElementById('fanPanel');
  panel.innerHTML = '';
  serverFans.forEach(f => {
    const pct = Math.round(f.current_pwm / 255 * 100);
    const label = f.friendly_name || f.fan_id;
    const rpm = f.current_rpm != null ? `${f.current_rpm} rpm` : '';
    const row = document.createElement('div');
    row.className = 'fan-row';
    row.innerHTML = `
      <span class="fan-label">${label}</span>
      <div class="progress-bg"><div class="progress-fill" id="bar-${f.fan_id}" style="width:${pct}%"></div></div>
      <span class="fan-value">${pct}%</span>
      <span class="fan-rpm">${rpm}</span>`;
    panel.appendChild(row);
  });
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
  serverFans.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.fan_id;
    opt.textContent = f.friendly_name || f.fan_id;
    sel.appendChild(opt);
  });
  // Load curves from server for each fan
  serverFans.forEach(f => {
    if (!curves[f.fan_id]) loadCurve(f.fan_id);
  });
}

async function loadCurve(fanId) {
  const data = await api('GET', `/fans/${fanId}/curve`);
  if (!data) return;
  curves[fanId] = data.points.map(p => ({ t: p.temp_c, p: p.pwm_pct }));
  if (fanId === activeFan()) { buildChart(); renderPointRows(false); }
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

function sortCurve(fanId) {
  if (curves[fanId]) curves[fanId].sort((a, b) => a.t - b.t);
}

function updateBadge() {
  const fan = activeFan();
  const tempC = getMaxTempC();
  const tempDisp = toDisplay(tempC);
  const pct = Math.round(interpolate(curves[fan] || [], tempC));
  document.getElementById('curTempLabel').textContent = `${tempDisp}${unitLabel()}`;
  document.getElementById('curFanLabel').textContent = `${pct}%`;
}

function buildChart() {
  const fan = activeFan();
  if (!fan) return;
  sortCurve(fan);
  const pts = curves[fan] || [];

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor  = isDark ? '#aaa' : '#777';
  const minT = unit === 'F' ? 59 : 15;
  const maxT = unit === 'F' ? 185 : 85;

  const chartData = pts.map(p => ({ x: toDisplay(p.t), y: p.p }));
  const tempC = getMaxTempC();
  const opPct = interpolate(pts, tempC);

  const opData = [{ x: minT, y: opPct }, { x: maxT, y: opPct }];

  if (chart) { chart.destroy(); chart = null; }
  const ctx = document.getElementById('curveCanvas').getContext('2d');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: T.fanCurve,
          data: chartData,
          borderColor: '#378ADD',
          backgroundColor: 'rgba(55,138,221,0.08)',
          borderWidth: 2.5,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: '#378ADD',
          tension: 0,
          fill: true,
          dragData: true,
        },
        {
          label: T.currentOp,
          data: opData,
          borderColor: '#BA7517',
          borderWidth: 2,
          borderDash: [4, 3],
          pointRadius: 0,
          dragData: false,
        },
      ],
    },
    plugins: [ChartDataLabels !== undefined ? undefined : null].filter(Boolean),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        dragData: {
          round: 1,
          showTooltip: true,
          onDragStart: () => {},
          onDrag: (e, di, i, val) => {
            if (di === 0 && curves[fan]) curves[fan][i] = { t: Math.round(fromDisplay(val.x)), p: Math.round(val.y) };
            updateBadge();
          },
          onDragEnd: () => { sortCurve(fan); buildChart(); renderPointRows(false); },
        },
      },
      scales: {
        x: { type: 'linear', min: minT, max: maxT, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: v => v + unitLabel() }, title: { display: true, text: `${T.temperatureAxis} (${unitLabel()})`, color: textColor, font: { size: 11 } } },
        y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: v => v + '%' }, title: { display: true, text: T.fanSpeedAxis, color: textColor, font: { size: 11 } } },
      },
      animation: { duration: 200 },
    },
  });
  updateBadge();
  checkWarnBar();
}

function renderPointRows(doRebuild) {
  const fan = activeFan();
  sortCurve(fan);
  const container = document.getElementById('pointRows');
  container.innerHTML = '';
  (curves[fan] || []).forEach((pt, i) => {
    const row = document.createElement('div'); row.className = 'point-row';
    const tIn = document.createElement('input'); tIn.className = 'point-input'; tIn.type = 'number'; tIn.min = 15; tIn.max = 85; tIn.value = toDisplay(pt.t);
    tIn.onchange = () => { curves[fan][i].t = Math.round(fromDisplay(parseFloat(tIn.value) || pt.t)); sortCurve(fan); refresh(); };
    const pIn = document.createElement('input'); pIn.className = 'point-input'; pIn.type = 'number'; pIn.min = 0; pIn.max = 100; pIn.value = pt.p;
    pIn.onchange = () => { curves[fan][i].p = Math.max(0, Math.min(100, parseInt(pIn.value) || 0)); refresh(); };
    const del = document.createElement('button'); del.className = 'del-btn'; del.title = 'Remove point';
    del.innerHTML = '<i class="ti ti-trash"></i>';
    del.onclick = () => { if ((curves[fan] || []).length > 2) { curves[fan].splice(i, 1); refresh(); } };
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

function addPoint() {
  const fan = activeFan(), pts = curves[fan] || [], s = [...pts].sort((a, b) => a.t - b.t);
  let bestGap = 0, bestT = s[0].t + 5;
  for (let i = 0; i < s.length - 1; i++) {
    const gap = s[i + 1].t - s[i].t;
    if (gap > bestGap) { bestGap = gap; bestT = Math.round((s[i].t + s[i + 1].t) / 2); }
  }
  curves[fan].push({ t: bestT, p: Math.round(interpolate(pts, bestT)) });
  refresh();
}

async function saveCurve() {
  const fan = activeFan();
  const minP = Math.min(...(curves[fan] || []).map(p => p.p));
  if (minP < 20 && !confirm(T.curveBelow20)) return;
  const points = (curves[fan] || []).map(p => ({ temp_c: p.t, pwm_pct: p.p }));
  const data = await api('PUT', `/fans/${fan}/curve`, { fan_id: fan, points });
  if (data) alert(T.curveSaved);
}

document.getElementById('fanSelect').onchange = () => { loadCurve(activeFan()); };

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  settingsData = await api('GET', '/settings/');
  if (!settingsData) return;
  unit = settingsData.temp_unit || 'C';
  document.getElementById('btnC').classList.toggle('active', unit === 'C');
  document.getElementById('btnF').classList.toggle('active', unit === 'F');
  document.getElementById('alertToggle').checked = alertEnabled;
  buildDiskCfg();
  buildFanCfg();
}

function buildDiskCfg() {
  const tb = document.getElementById('diskCfgBody'); tb.innerHTML = '';
  serverDisks.forEach((d, i) => {
    const name = (settingsData && settingsData.disk_friendly_names && settingsData.disk_friendly_names[d.device]) || d.device;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code style="font-size:12px;color:var(--color-text-secondary);">${d.device}</code></td>
      <td><span style="font-size:12px;color:var(--color-text-tertiary);">${d.device}</span></td>
      <td><span class="disk-type-badge">${d.type}</span></td>
      <td><input class="cfg-input" id="dname-${i}" value="${name}"></td>
      <td><label class="toggle"><input type="checkbox" checked id="dmon-${i}"><span class="toggle-slider"></span></label></td>
      <td><span class="detected-badge">${T.smartOk}</span></td>`;
    tb.appendChild(tr);
  });
}

function buildFanCfg() {
  const tb = document.getElementById('fanCfgBody'); tb.innerHTML = '';
  serverFans.forEach((f, i) => {
    const pct = Math.round(f.current_pwm / 255 * 100);
    const name = f.friendly_name || f.fan_id;
    const rpm = f.current_rpm != null ? `${f.current_rpm} rpm` : '— rpm';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code style="font-size:12px;color:var(--color-text-secondary);">${f.fan_id}</code></td>
      <td><input class="cfg-input" id="fname-${i}" value="${name}"></td>
      <td><span style="font-size:13px;color:var(--color-text-secondary);">${rpm}</span></td>
      <td><label class="toggle"><input type="checkbox" ${f.controlled ? 'checked' : ''} id="fctrl-${i}"><span class="toggle-slider"></span></label></td>
      <td><button class="test-btn" id="test-${f.fan_id}" onclick="testFan('${f.fan_id}')"><i class="ti ti-player-play" style="font-size:11px;margin-right:3px;"></i>${T.test}</button></td>`;
    tb.appendChild(tr);
  });
}

async function testFan(id) {
  const btn = document.getElementById('test-' + id);
  const bar = document.getElementById('bar-' + id);
  btn.classList.add('testing');
  btn.innerHTML = `<i class="ti ti-player-stop" style="font-size:11px;margin-right:3px;"></i>${T.testing}`;
  if (bar) { bar.style.width = '100%'; bar.style.background = '#BA7517'; }
  await api('POST', `/fans/${id}/test`);
  setTimeout(() => {
    btn.classList.remove('testing');
    btn.innerHTML = `<i class="ti ti-player-play" style="font-size:11px;margin-right:3px;"></i>${T.test}`;
    if (bar) bar.style.background = '#378ADD';
  }, 3200);
}

function setUnit(u) {
  unit = u;
  document.getElementById('btnC').classList.toggle('active', u === 'C');
  document.getElementById('btnF').classList.toggle('active', u === 'F');
  renderDiskGrid();
  if (chart) refresh();
}

async function rescanHardware() {
  const badge = document.getElementById('scanBadge');
  badge.textContent = T.scanning;
  badge.style.background = 'var(--color-background-warning)';
  badge.style.color = 'var(--color-text-warning)';
  const data = await api('POST', '/settings/scan');
  badge.textContent = T.scanned;
  badge.style.background = '';
  badge.style.color = '';
  if (data) {
    serverDisks = data.disks;
    serverFans  = data.fans;
    buildDiskCfg();
    buildFanCfg();
  }
}

async function saveSettings() {
  // Save friendly names
  const names = {};
  serverDisks.forEach((d, i) => {
      const el = document.getElementById(`dname-${i}`);
      if (el) names[d.device] = el.value;
  });
  await api('PUT', '/settings/friendly-names', { names });

  // Save monitor toggles
  const monitored = [];
  const unmonitored = [];
  serverDisks.forEach((d, i) => {
      const el = document.getElementById(`dmon-${i}`);
      if (el && !el.checked) unmonitored.push(d.device);
      else monitored.push(d.device);
  });
  await api('PATCH', '/settings/global', { 
      temp_unit: unit,
      unmonitored_disks: unmonitored
  });

  // Save fan names + controlled toggle
  for (let i = 0; i < serverFans.length; i++) {
    const f = serverFans[i];
    const nameEl = document.getElementById(`fname-${i}`);
    const ctrlEl = document.getElementById(`fctrl-${i}`);
    if (nameEl || ctrlEl) {
      await api('PATCH', `/settings/fans/${f.fan_id}`, {
        friendly_name: nameEl ? nameEl.value : undefined,
        controlled: ctrlEl ? ctrlEl.checked : undefined,
      });
    }
  }

  // Save global settings
  alertEnabled = document.getElementById('alertToggle').checked;
  await api('PATCH', '/settings/global', { temp_unit: unit });

  showView('dashboard', document.getElementById('navDash'));
}

function discardSettings() {
  loadSettings();
  showView('dashboard', document.getElementById('navDash'));
}
