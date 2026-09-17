/* ── Admin Socket Logic ──────────────────────────────────────────────────── */

const socket = io();
let wbMode = 'text'; // 'text' or 'code'

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

function toggleArm() {
  socket.emit('arm');
}

// ── State updates ─────────────────────────────────────────────────────────
socket.on('state_update', state => {
  const { buzzes, armed, question_number, whiteboard_active } = state;

  // Question counter
  document.getElementById('admin-q-number').textContent = question_number;

  // Stats bar
  document.getElementById('total-buzzes').textContent = buzzes.length;
  document.getElementById('fastest-time').textContent = buzzes.length ? `${buzzes[0].delta_ms}` : '–';

  const armedEl = document.getElementById('status-armed');
  armedEl.textContent = armed ? 'ARMED' : 'LOCKED';
  armedEl.style.color = armed ? 'var(--success)' : 'var(--danger)';

  // Arm button
  document.getElementById('arm-icon').textContent = armed ? '🟢' : '🔴';
  document.getElementById('arm-text').textContent = armed ? 'Buzzer Armed' : 'Buzzer Locked';

  // Whiteboard badge sync
  updateWbBadge(whiteboard_active);

  renderLeaderboard(buzzes);
  renderQueue(buzzes);
});

// ── Render leaderboard ────────────────────────────────────────────────────
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

// ── Render answer queue ───────────────────────────────────────────────────
function renderQueue(buzzes) {
  const ql = document.getElementById('queue-list');

  if (buzzes.length === 0) {
    ql.innerHTML = '<div class="queue-empty">No buzzes yet — start the question!</div>';
    return;
  }

  if (ql.children.length === buzzes.length && !ql.querySelector('.queue-empty')) return;

  ql.innerHTML = '';
  const callLabels = ['Call First', 'Call Second', 'Call Third'];

  buzzes.forEach(b => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.innerHTML = `
      <div class="queue-number">${b.rank}</div>
      <div>
        <div class="queue-name">${escHtml(b.name)}</div>
        <div class="queue-time">Buzzed at +${b.delta_ms} ms</div>
      </div>
      <div class="queue-call queue-call-${b.rank}">${callLabels[b.rank - 1] || `#${b.rank}`}</div>
    `;
    ql.appendChild(item);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function medalFor(rank) {
  return ['🥇','🥈','🥉'][rank - 1] || rank;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────────────────────
// WHITEBOARD FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function setWbMode(mode) {
  wbMode = mode;
  const editor = document.getElementById('wb-editor');
  const tabs   = document.querySelectorAll('.wb-tab');

  tabs.forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  if (mode === 'code') {
    editor.style.fontFamily = "'JetBrains Mono', monospace";
    editor.style.fontSize   = '0.88rem';
  } else {
    editor.style.fontFamily = "inherit";
    editor.style.fontSize   = '1rem';
  }
}

function updateWbCount() {
  const len = document.getElementById('wb-editor').value.length;
  document.getElementById('wb-char').textContent = len;
  // Update preview
  const preview = document.getElementById('wb-preview');
  const val = document.getElementById('wb-editor').value;
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

  // Update badge
  const badge = document.getElementById('wb-status-badge');
  badge.textContent = 'LIVE';
  badge.className   = 'wb-badge wb-badge-on';

  // Flash button feedback
  const btn = document.querySelector('.btn-broadcast');
  btn.textContent = '✅ Sent!';
  setTimeout(() => { btn.innerHTML = '<span>📡</span> Broadcast to Players'; }, 2000);
}

function clearWhiteboard() {
  document.getElementById('wb-editor').value = '';
  document.getElementById('wb-preview').textContent = 'Start typing above to preview...';
  document.getElementById('wb-char').textContent = '0';
  socket.emit('clear_whiteboard');

  const badge = document.getElementById('wb-status-badge');
  badge.textContent = 'OFF';
  badge.className   = 'wb-badge wb-badge-off';
}

// Update whiteboard badge from state sync
function updateWbBadge(active) {
  const badge = document.getElementById('wb-status-badge');
  badge.textContent = active ? 'LIVE' : 'OFF';
  badge.className   = active ? 'wb-badge wb-badge-on' : 'wb-badge wb-badge-off';
}
