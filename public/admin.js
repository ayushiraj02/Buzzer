/* ── Admin Socket Logic ──────────────────────────────────────────────────── */

const socket = io();
const ADMIN_PASSWORD = 'admin';
let wbMode = 'text';

// ── Password ──────────────────────────────────────────────────────────────
(function initAuth() {
  if (sessionStorage.getItem('qb_admin_auth') === '1') {
    showAdminContent();
  }
  document.getElementById('pw-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkPassword();
  });
})();

function checkPassword() {
  const val = document.getElementById('pw-input').value;
  if (val === ADMIN_PASSWORD) {
    sessionStorage.setItem('qb_admin_auth', '1');
    showAdminContent();
  } else {
    const err   = document.getElementById('pw-error');
    const input = document.getElementById('pw-input');
    err.classList.remove('hidden');
    input.value = '';
    input.style.animation = 'shake 0.4s ease';
    setTimeout(() => { input.style.animation = ''; err.classList.add('hidden'); }, 2000);
  }
}

function showAdminContent() {
  document.getElementById('pw-overlay').style.display    = 'none';
  document.getElementById('admin-content').classList.remove('hidden');
}

function togglePw() {
  const inp = document.getElementById('pw-input');
  inp.type  = inp.type === 'password' ? 'text' : 'password';
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.admin-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `tab-${name}`));
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('hidden', p.id !== `tab-${name}`));
}

// ── Connection ────────────────────────────────────────────────────────────
socket.on('connect',    () => setDot('admin-conn-dot', true));
socket.on('disconnect', () => setDot('admin-conn-dot', false));

function setDot(id, online) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('disconnected', !online);
  el.title = online ? 'Connected' : 'Disconnected';
}

// ── Admin actions ─────────────────────────────────────────────────────────
function nextQuestion() {
  socket.emit('next_question');
  const btn = document.getElementById('next-btn');
  btn.classList.add('armed-pulse');
  btn.addEventListener('animationend', () => btn.classList.remove('armed-pulse'), { once: true });
}
function toggleArm() { socket.emit('arm'); }

// ── State updates ─────────────────────────────────────────────────────────
socket.on('state_update', state => {
  const { buzzes, armed, question_number, whiteboard_active, scores } = state;

  document.getElementById('admin-q-number').textContent = question_number;
  document.getElementById('total-buzzes').textContent   = buzzes.length;
  document.getElementById('fastest-time').textContent   = buzzes.length ? `${buzzes[0].delta_ms}` : '–';

  const armedEl = document.getElementById('status-armed');
  armedEl.textContent = armed ? 'ARMED' : 'LOCKED';
  armedEl.style.color = armed ? 'var(--success)' : 'var(--danger)';

  document.getElementById('arm-icon').textContent = armed ? '🟢' : '🔴';
  document.getElementById('arm-text').textContent = armed ? 'Buzzer Armed' : 'Buzzer Locked';

  updateWbBadge(whiteboard_active);
  renderLeaderboard(buzzes);
  renderQueue(buzzes);
  renderScoreboard(scores);
});

// ── Players update ────────────────────────────────────────────────────────
socket.on('players_update', players => {
  const active = players.filter(p => p.status === 'active').length;
  const left   = players.filter(p => p.status === 'left').length;

  document.getElementById('players-count').textContent = players.length;
  document.getElementById('active-count').textContent  = active;
  document.getElementById('left-count').textContent    = left;
  document.getElementById('total-count').textContent   = players.length;

  renderPlayersGrid(players);
});

function renderPlayersGrid(players) {
  const grid = document.getElementById('players-grid');
  if (players.length === 0) {
    grid.innerHTML = `
      <div class="no-players-msg">
        <div style="font-size:3rem;margin-bottom:12px">🎮</div>
        <p>No players have joined yet.<br/>Share <code>/player</code> link with participants.</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = `player-card glass ${p.status === 'left' ? 'player-card-left' : 'player-card-active'}`;
    card.innerHTML = `
      <div class="pc-top">
        <div class="pc-avatar ${p.status === 'active' ? 'pc-av-active' : 'pc-av-left'}">${p.name[0].toUpperCase()}</div>
        <span class="pc-status-dot ${p.status === 'active' ? 'dot-active' : 'dot-left'}"></span>
      </div>
      <div class="pc-name">${escHtml(p.name)}</div>
      <div class="pc-status-label ${p.status === 'active' ? 'label-active' : 'label-left'}">
        ${p.status === 'active' ? '● Active' : '○ Left'}
      </div>
      <div class="pc-score">Score: <strong>${p.score}</strong></div>
      <div class="pc-actions">
        <button class="pc-btn pc-add" onclick="awardPoint('${escHtml(p.name)}',1)" title="Award +1">+1</button>
        <button class="pc-btn pc-sub" onclick="awardPoint('${escHtml(p.name)}',-1)" title="Deduct -1">-1</button>
        <button class="pc-btn pc-del" onclick="removePlayer('${escHtml(p.name)}')" title="Remove">✕</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ── Scoreboard ────────────────────────────────────────────────────────────
function renderScoreboard(scores) {
  if (!scores) return;
  const entries = Object.entries(scores).sort((a,b) => b[1] - a[1]);
  const empty   = document.getElementById('scoreboard-empty');
  const wrap    = document.getElementById('scoreboard-table-wrap');
  const tbody   = document.getElementById('scoreboard-body');

  if (entries.length === 0) {
    empty.classList.remove('hidden');
    wrap.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');
  tbody.innerHTML = '';

  const medals = ['🥇','🥈','🥉'];
  entries.forEach(([name, score], i) => {
    const tr = document.createElement('tr');
    tr.className = i < 3 ? `sc-top-${i+1}` : '';
    tr.innerHTML = `
      <td class="sc-rank">${medals[i] || i + 1}</td>
      <td class="sc-name">
        <div class="sc-player-wrap">
          <div class="sc-avatar">${name[0].toUpperCase()}</div>
          <span>${escHtml(name)}</span>
        </div>
      </td>
      <td class="sc-score"><span class="score-pill">${score}</span></td>
      <td class="sc-actions">
        <button class="score-btn score-add" onclick="awardPoint('${escHtml(name)}',1)">+1</button>
        <button class="score-btn score-add2" onclick="awardPoint('${escHtml(name)}',2)">+2</button>
        <button class="score-btn score-sub" onclick="awardPoint('${escHtml(name)}',-1)">-1</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function awardPoint(name, delta) {
  socket.emit('update_score', { name, delta });
}

function resetScores() {
  if (confirm('Reset all scores to 0?')) socket.emit('reset_scores');
}

function removePlayer(name) {
  if (confirm(`Remove player "${name}"?`)) socket.emit('remove_player', { name });
}

// ── Leaderboard ───────────────────────────────────────────────────────────
function renderLeaderboard(buzzes) {
  const noBuzz = document.getElementById('no-buzz-msg');
  const list   = document.getElementById('leaderboard-list');
  if (buzzes.length === 0) {
    noBuzz.classList.remove('hidden');
    list.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  noBuzz.classList.add('hidden');
  list.classList.remove('hidden');
  if (list.children.length !== buzzes.length) {
    list.innerHTML = '';
    buzzes.forEach(b => {
      const item = document.createElement('div');
      item.className = `lb-item lb-item-${b.rank} flash-new`;
      item.innerHTML = `
        <div class="lb-rank lb-rank-${b.rank}">${medalFor(b.rank)}</div>
        <div>
          <div class="lb-name">${escHtml(b.name)}</div>
          <div class="lb-time">${new Date(b.timestamp).toLocaleTimeString()}</div>
        </div>
        <div class="lb-delta">+${b.delta_ms} ms</div>
      `;
      list.appendChild(item);
    });
  }
}

function renderQueue(buzzes) {
  const ql = document.getElementById('queue-list');
  if (buzzes.length === 0) {
    ql.innerHTML = '<div class="queue-empty">No buzzes yet — start the question!</div>';
    return;
  }
  if (ql.children.length === buzzes.length && !ql.querySelector('.queue-empty')) return;
  ql.innerHTML = '';
  const callLabels = ['Call First','Call Second','Call Third'];
  buzzes.forEach(b => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.innerHTML = `
      <div class="queue-number">${b.rank}</div>
      <div>
        <div class="queue-name">${escHtml(b.name)}</div>
        <div class="queue-time">Buzzed at +${b.delta_ms} ms</div>
      </div>
      <div class="queue-call queue-call-${b.rank}">${callLabels[b.rank-1] || '#'+b.rank}</div>
    `;
    ql.appendChild(item);
  });
}

// ── Whiteboard ────────────────────────────────────────────────────────────
function setWbMode(mode, e) {
  wbMode = mode;
  document.querySelectorAll('.wb-tab').forEach(t => t.classList.remove('active'));
  if (e && e.target) e.target.classList.add('active');
  const ed = document.getElementById('wb-editor');
  ed.style.fontFamily = mode === 'code' ? "'JetBrains Mono', monospace" : 'inherit';
  ed.style.fontSize   = mode === 'code' ? '0.88rem' : '1rem';
}

function updateWbCount() {
  const val = document.getElementById('wb-editor').value;
  document.getElementById('wb-char').textContent = val.length;
  const preview = document.getElementById('wb-preview');
  preview.textContent = val || 'Start typing above to preview...';
  preview.style.color = val ? 'var(--text)' : 'var(--text-dim)';
}

function sendWhiteboard() {
  const content = document.getElementById('wb-editor').value.trim();
  if (!content) {
    document.getElementById('wb-editor').style.borderColor = 'var(--danger)';
    setTimeout(() => document.getElementById('wb-editor').style.borderColor = '', 1500);
    return;
  }
  socket.emit('send_whiteboard', { content });
  updateWbBadge(true);
  const btn = document.querySelector('.btn-broadcast');
  btn.innerHTML = '✅ Sent to all players!';
  setTimeout(() => { btn.innerHTML = '<span>📡</span> Broadcast to Players'; }, 2000);
}

function clearWhiteboard() {
  document.getElementById('wb-editor').value = '';
  document.getElementById('wb-preview').textContent = 'Start typing above to preview...';
  document.getElementById('wb-char').textContent = '0';
  socket.emit('clear_whiteboard');
  updateWbBadge(false);
}

function updateWbBadge(active) {
  const badge = document.getElementById('wb-status-badge');
  if (!badge) return;
  badge.textContent = active ? 'LIVE' : 'OFF';
  badge.className   = active ? 'wb-badge wb-badge-on' : 'wb-badge wb-badge-off';
}

// ── Helpers ───────────────────────────────────────────────────────────────
function medalFor(rank) { return ['🥇','🥈','🥉'][rank-1] || rank; }
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
}
