/* ── Admin Socket Logic ──────────────────────────────────────────────────── */

const socket = io();

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
  const { buzzes, armed, question_number } = state;

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
