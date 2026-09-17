/* ── Player Socket Logic + Compiler ─────────────────────────────────────── */

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
  if (!name) {
    input.focus();
    input.style.animation = 'shake 0.4s ease';
    setTimeout(() => input.style.animation = '', 500);
    return;
  }
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
  const { buzzes, armed, question_number, whiteboard, whiteboard_active } = state;

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
  } else {
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
  }

  // ── Whiteboard update ──
  updateWhiteboard(whiteboard, whiteboard_active);
});

// ── Whiteboard ────────────────────────────────────────────────────────────
let lastWhiteboardContent = '';

function updateWhiteboard(content, active) {
  const panel   = document.getElementById('whiteboard-panel');
  const display = document.getElementById('whiteboard-content');
  const badge   = document.getElementById('wb-new-badge');

  if (active && content) {
    panel.classList.remove('hidden');
    // Flash NEW badge only when content changes
    if (content !== lastWhiteboardContent) {
      display.textContent = content;
      badge.style.display = 'inline-block';
      panel.classList.add('wb-flash');
      setTimeout(() => {
        badge.style.display = 'none';
        panel.classList.remove('wb-flash');
      }, 3000);
      lastWhiteboardContent = content;
    }
  } else {
    panel.classList.add('hidden');
    lastWhiteboardContent = '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PYTHON COMPILER
// ─────────────────────────────────────────────────────────────────────────────

async function runCode() {
  if (!window.pyodide) return;

  const code     = document.getElementById('code-editor').value.trim();
  const runBtn   = document.getElementById('run-btn');
  const runIcon  = document.getElementById('run-icon');
  const runText  = document.getElementById('run-text');
  const output   = document.getElementById('output-area');

  if (!code) {
    output.innerHTML = '<span class="output-warn">⚠️ Nothing to run — write some code first!</span>';
    return;
  }

  // Show running state
  runBtn.disabled = true;
  runIcon.textContent = '⏳';
  runText.textContent = 'Running...';
  output.innerHTML = '<span class="output-placeholder">Running...</span>';

  try {
    // Reset stdout/stderr buffers
    window.pyodide.runPython(`
import sys, io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
    `);

    // Run user code
    await window.pyodide.runPythonAsync(code);

    // Capture output
    const stdout = window.pyodide.runPython('sys.stdout.getvalue()');
    const stderr = window.pyodide.runPython('sys.stderr.getvalue()');

    let html = '';
    if (stdout) html += `<span class="output-stdout">${escHtml(stdout)}</span>`;
    if (stderr) html += `<span class="output-stderr">⚠️ ${escHtml(stderr)}</span>`;
    if (!stdout && !stderr) html = '<span class="output-success">✓ Code ran with no output</span>';

    output.innerHTML = html;

  } catch (err) {
    // Format Python tracebacks nicely
    const msg = err.message || String(err);
    output.innerHTML = `<span class="output-error">❌ ${escHtml(msg)}</span>`;
  }

  // Restore button
  runBtn.disabled = false;
  runIcon.textContent = '▶';
  runText.textContent = 'Run Code';
}

function clearOutput() {
  document.getElementById('output-area').innerHTML =
    '<span class="output-placeholder">Output will appear here after you run your code...</span>';
}

function clearCode() {
  document.getElementById('code-editor').value = '';
  syncLineNums();
}

function copyCode() {
  const code = document.getElementById('code-editor').value;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.querySelector('[onclick="copyCode()"]');
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 1500);
  });
}

function useTemplate() {
  document.getElementById('code-editor').value =
`# Pattern example
n = 5
for i in range(1, n + 1):
    print('* ' * i)`;
  syncLineNums();
}

// ── Code editor utilities ─────────────────────────────────────────────────
function syncLineNums() {
  const editor  = document.getElementById('code-editor');
  const nums    = document.getElementById('line-nums');
  const lines   = editor.value.split('\n').length;
  nums.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
}

function syncScroll() {
  const editor = document.getElementById('code-editor');
  const nums   = document.getElementById('line-nums');
  nums.scrollTop = editor.scrollTop;
}

function handleTab(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const editor = document.getElementById('code-editor');
    const start  = editor.selectionStart;
    const end    = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 4;
    syncLineNums();
  }
}

// Initialize line numbers
syncLineNums();

// ── Helpers ───────────────────────────────────────────────────────────────
function setStatus(el, type, icon, text) {
  el.className = `status-msg status-${type}`;
  el.querySelector('.status-icon').textContent = icon;
  document.getElementById('status-text').textContent = text;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g, '<br>');
}
