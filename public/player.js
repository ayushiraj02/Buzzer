/* ── Player Socket Logic + Multi-Language Compiler ───────────────────────── */

const socket = io();
let playerName  = '';
let hasBuzzed   = false;
let currentLang = 'python';

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE DEFINITIONS  (Piston API: https://emkc.org/api/v2/piston/execute)
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGES = {
  python: {
    name: 'Python',     icon: '🐍', version: '3.10',  file: 'main.py',
    color: '#3b82f6',
    template:
`# Python 3
n = 5
for i in range(1, n + 1):
    print('* ' * i)
`
  },
  java: {
    name: 'Java',       icon: '☕', version: '*',     file: 'Main.java',
    color: '#f59e0b',
    template:
`public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        // Pattern example
        int n = 5;
        for (int i = 1; i <= n; i++) {
            for (int j = 0; j < i; j++)
                System.out.print("* ");
            System.out.println();
        }
    }
}
`
  },
  kotlin: {
    name: 'Kotlin',     icon: '🎯', version: '*',     file: 'main.kt',
    color: '#8b5cf6',
    template:
`fun main() {
    println("Hello, World!")
    
    // Pattern
    val n = 5
    for (i in 1..n) {
        println("* ".repeat(i))
    }
}
`
  },
  c: {
    name: 'C',          icon: '⚙️', version: '*',     file: 'main.c',
    color: '#06b6d4',
    template:
`#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    
    // Pattern
    int n = 5;
    for (int i = 1; i <= n; i++) {
        for (int j = 0; j < i; j++)
            printf("* ");
        printf("\\n");
    }
    return 0;
}
`
  },
  cpp: {
    name: 'C++',        icon: '🔷', version: '*',     file: 'main.cpp',
    color: '#0ea5e9',
    template:
`#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    
    // Pattern
    int n = 5;
    for (int i = 1; i <= n; i++) {
        for (int j = 0; j < i; j++)
            cout << "* ";
        cout << endl;
    }
    return 0;
}
`
  },
  javascript: {
    name: 'JavaScript', icon: '🟨', version: '*',     file: 'main.js',
    color: '#eab308',
    template:
`// JavaScript (Node.js)
console.log("Hello, World!");

// Pattern
const n = 5;
for (let i = 1; i <= n; i++) {
    console.log("* ".repeat(i));
}
`
  },
  typescript: {
    name: 'TypeScript', icon: '🔵', version: '*',     file: 'main.ts',
    color: '#3b82f6',
    template:
`// TypeScript
const greet = (name: string): string => \`Hello, \${name}!\`;
console.log(greet("World"));

const n: number = 5;
for (let i = 1; i <= n; i++) {
    console.log("* ".repeat(i));
}
`
  },
  go: {
    name: 'Go',         icon: '🐹', version: '*',     file: 'main.go',
    color: '#22d3ee',
    template:
`package main
import "fmt"

func main() {
    fmt.Println("Hello, World!")
    
    // Pattern
    n := 5
    for i := 1; i <= n; i++ {
        for j := 0; j < i; j++ {
            fmt.Print("* ")
        }
        fmt.Println()
    }
}
`
  },
  rust: {
    name: 'Rust',       icon: '🦀', version: '*',     file: 'main.rs',
    color: '#f97316',
    template:
`fn main() {
    println!("Hello, World!");
    
    // Pattern
    let n = 5;
    for i in 1..=n {
        let row = "* ".repeat(i);
        println!("{}", row);
    }
}
`
  },
  csharp: {
    name: 'C#',         icon: '🟣', version: '*',     file: 'Main.cs',
    color: '#a855f7',
    template:
`using System;

class Main {
    static void Main(string[] args) {
        Console.WriteLine("Hello, World!");
        
        // Pattern
        int n = 5;
        for (int i = 1; i <= n; i++) {
            Console.WriteLine(new String("* ".ToCharArray()[0], i * 2 - 1));
        }
    }
}
`
  },
  php: {
    name: 'PHP',        icon: '🐘', version: '*',     file: 'main.php',
    color: '#7c3aed',
    template:
`<?php
echo "Hello, World!\\n";

// Pattern
$n = 5;
for ($i = 1; $i <= $n; $i++) {
    echo str_repeat("* ", $i) . "\\n";
}
`
  },
  ruby: {
    name: 'Ruby',       icon: '💎', version: '*',     file: 'main.rb',
    color: '#ef4444',
    template:
`# Ruby
puts "Hello, World!"

# Pattern
n = 5
(1..n).each do |i|
  puts ("* " * i)
end
`
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD LANGUAGE SELECTOR
// ─────────────────────────────────────────────────────────────────────────────
function buildLangGrid() {
  const grid = document.getElementById('lang-grid');
  grid.innerHTML = '';
  Object.entries(LANGUAGES).forEach(([key, lang]) => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn' + (key === currentLang ? ' lang-btn-active' : '');
    btn.dataset.lang = key;
    btn.style.setProperty('--lang-color', lang.color);
    btn.innerHTML = `<span class="lang-btn-icon">${lang.icon}</span><span class="lang-btn-name">${lang.name}</span>`;
    btn.onclick = () => switchLang(key);
    grid.appendChild(btn);
  });
}

function switchLang(key) {
  currentLang = key;
  const lang  = LANGUAGES[key];

  // Update active class
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('lang-btn-active', b.dataset.lang === key);
  });

  // Update toolbar label & icon
  document.getElementById('lang-icon').textContent       = lang.icon;
  document.getElementById('editor-lang-label').textContent = lang.name;

  // Load template into editor
  const editor = document.getElementById('code-editor');
  editor.value = lang.template;
  syncLineNums();

  // Clear output
  clearOutput();
  document.getElementById('exit-code-badge').classList.add('hidden');
}

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
  // Register with server so admin can see this player
  socket.emit('register_player', { name });
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
    results.classList.remove('hidden');
    if (list.children.length !== buzzes.length) {
      list.innerHTML = '';
      buzzes.forEach(b => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
          <div class="rank-badge rank-${b.rank}">${b.rank}</div>
          <div class="result-name">${escHtml(b.name)}</div>
          <div class="result-time">+${b.delta_ms} ms</div>`;
        list.appendChild(item);
      });
    }
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
// MULTI-LANGUAGE COMPILER  (Piston API)
// ─────────────────────────────────────────────────────────────────────────────
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

async function runCode() {
  const lang     = LANGUAGES[currentLang];
  const code     = document.getElementById('code-editor').value.trim();
  const runBtn   = document.getElementById('run-btn');
  const runIcon  = document.getElementById('run-icon');
  const runText  = document.getElementById('run-text');
  const output   = document.getElementById('output-area');
  const exitBadge = document.getElementById('exit-code-badge');

  if (!code) {
    output.innerHTML = '<span class="output-warn">⚠️ Nothing to run — write some code first!</span>';
    return;
  }

  // Running state
  runBtn.disabled   = true;
  runIcon.textContent = '⏳';
  runText.textContent = 'Running...';
  output.innerHTML  = `<span class="output-placeholder">Running ${lang.name} code...</span>`;
  exitBadge.classList.add('hidden');

  try {
    const res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: currentLang === 'cpp' ? 'c++' : currentLang === 'csharp' ? 'csharp' : currentLang,
        version: lang.version,
        files: [{ name: lang.file, content: code }],
        stdin: '',
        args: [],
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const run  = data.run || data.compile || {};
    const compile = data.compile || null;

    let html = '';

    // Compilation error (for compiled languages)
    if (compile && compile.stderr) {
      html += `<span class="output-compile-err">⚙️ Compile Error:\n${escHtml(compile.stderr)}</span>`;
    }

    if (run.stdout) html += `<span class="output-stdout">${escHtml(run.stdout)}</span>`;
    if (run.stderr) html += `<span class="output-stderr">⚠️ ${escHtml(run.stderr)}</span>`;
    if (!run.stdout && !run.stderr && (!compile || !compile.stderr)) {
      html = '<span class="output-success">✓ Program exited with no output</span>';
    }

    output.innerHTML = html || '<span class="output-success">✓ Done</span>';

    // Exit code badge
    const code_val = run.code ?? 0;
    exitBadge.textContent = `exit: ${code_val}`;
    exitBadge.className   = `exit-code-badge ${code_val === 0 ? 'exit-ok' : 'exit-err'}`;
    exitBadge.classList.remove('hidden');

  } catch (err) {
    output.innerHTML = `<span class="output-error">❌ ${escHtml(err.message)}\n\nMake sure you're connected to the internet.</span>`;
  }

  runBtn.disabled     = false;
  runIcon.textContent = '▶';
  runText.textContent = 'Run Code';
}

// ── Editor utilities ──────────────────────────────────────────────────────
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
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 1800);
  });
}

function loadTemplate() {
  document.getElementById('code-editor').value = LANGUAGES[currentLang].template;
  syncLineNums();
}

function syncLineNums() {
  const editor = document.getElementById('code-editor');
  const nums   = document.getElementById('line-nums');
  const count  = editor.value.split('\n').length;
  nums.innerHTML = Array.from({length: count}, (_, i) => i + 1).join('<br>');
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
    const s = editor.selectionStart, end = editor.selectionEnd;
    editor.value = editor.value.substring(0, s) + '    ' + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = s + 4;
    syncLineNums();
  }
  // Ctrl+Enter to run
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCode();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function setStatus(el, type, icon, text) {
  el.className = `status-msg status-${type}`;
  el.querySelector('.status-icon').textContent = icon;
  document.getElementById('status-text').textContent = text;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// ── Init ──────────────────────────────────────────────────────────────────
buildLangGrid();
switchLang('python');   // default language
