/* ── Player Socket Logic ─────────────────────────────────────────────────── */

const socket = io();
let playerName = '';
let hasBuzzed   = false;

// ── Connection state ──────────────────────────────────────────────────────
socket.on('connect',    () => setDot('connection-dot', true));
socket.on('disconnect', () => setDot('connection-dot', false));

function setDot(id, online) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('disconnected', !online);
  el.title = online ? 'Connected' : 'Disconnected';
}

// ── Join quiz ─────────────────────────────────────────────────────────────
function joinQuiz() {
  const input = document.getElementById('player-name-input');
  const name  = input.value.trim();
  if (!name) { input.focus(); input.style.animation = 'shake 0.4s ease'; setTimeout(() => input.style.animation = '', 500); return; }

  playerName = name;
  document.getElementById('player-avatar').textContent       = name[0].toUpperCase();
  document.getElementById('player-name-display').textContent = name;

  document.getElementById('name-screen').classList.remove('active');
  document.getElementById('buzzer-screen').classList.add('active');
}

document.getElementById('player-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinQuiz();
});
document.getElementById('join-btn').addEventListener('click', joinQuiz);

// ── Press buzzer ──────────────────────────────────────────────────────────
document.getElementById('buzzer-btn').addEventListener('click', () => {
  if (!playerName || hasBuzzed) return;
  socket.emit('buzz', { name: playerName });
});

// ── State updates from server ─────────────────────────────────────────────
socket.on('state_update', state => {
  const { buzzes, armed, question_number } = state;

  document.getElementById('q-number').textContent = question_number;

  const myBuzz   = buzzes.find(b => b.name === playerName);
  const btn      = document.getElementById('buzzer-btn');
  const statusEl = document.getElementById('status-msg');
  const results  = document.getElementById('results-panel');
  const list     = document.getElementById('results-list');

  // ── Reset for new question ──
  if (buzzes.length === 0) {
    hasBuzzed = false;
    btn.disabled  = !armed;
    btn.className = 'buzzer-btn' + (!armed ? ' locked' : '');
    document.querySelector('.buzzer-label').textContent = 'BUZZ!';
    document.querySelector('.buzzer-sub').textContent   = armed ? 'Tap to answer' : 'Waiting...';
    setStatus(statusEl, 'waiting', '⏳', 'Waiting for question...');
    results.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  // ── Build results list ──
  results.classList.remove('hidden');
  if (list.children.length !== buzzes.length) {
    list.innerHTML = '';
    buzzes.forEach(b => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        <div class="rank-badge rank-${b.rank}">${b.rank}</div>
        <div class="result-name">${escHtml(b.name)}</div>
        <div class="result-time">+${b.delta_ms} ms</div>
      `;
      list.appendChild(item);
    });
  }

  // ── Update buzzer state ──
  if (myBuzz) {
    hasBuzzed = true;
    btn.disabled  = true;
    btn.className = 'buzzer-btn buzzed';
    document.querySelector('.buzzer-label').textContent = `#${myBuzz.rank}`;
    document.querySelector('.buzzer-sub').textContent   = 'You buzzed!';
    if (myBuzz.rank === 1) setStatus(statusEl, 'first',   '🥇', "You're FIRST! Get ready to answer!");
    else                   setStatus(statusEl, 'success', '🎯', `You're #${myBuzz.rank} — standby`);
  } else if (!hasBuzzed) {
    btn.disabled  = !armed;
    btn.className = 'buzzer-btn' + (!armed ? ' locked' : '');
    setStatus(statusEl, 'locked', '🔒', 'Someone buzzed first — keep going!');
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
function setStatus(el, type, icon, text) {
  el.className = `status-msg status-${type}`;
  el.querySelector('.status-icon').textContent = icon;
  document.getElementById('status-text').textContent = text;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
