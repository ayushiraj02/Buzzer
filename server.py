from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit
import time
import os
import json
import urllib.request
import urllib.error

app = Flask(__name__, static_folder='public', template_folder='public')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'quiz-buzzer-secret-2024')

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='gevent',
    ping_timeout=60,
    ping_interval=25,
)

# ── In-memory state ───────────────────────────────────────────────────────────
game_state = {
    'buzzes':            [],
    'question_start':    None,
    'armed':             True,
    'question_number':   1,
    'whiteboard':        '',
    'whiteboard_active': False,
    'scores':            {},   # {name: int}
}

# Players: {name: {sid, status('active'|'left'), joined_at}}
players = {}

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/player')
def player():
    return send_from_directory('public', 'player.html')

@app.route('/admin')
def admin():
    return send_from_directory('public', 'admin.html')

@app.route('/public/<path:filename>')
def static_files(filename):
    return send_from_directory('public', filename)

@app.route('/health')
def health():
    return {'status': 'ok'}, 200

@app.route('/api/run', methods=['POST'])
def run_code_proxy():
    """
    Server-side proxy to Piston code execution API.
    Avoids client-side CORS / auth issues.
    """
    PISTON_URL = 'https://emkc.org/api/v2/piston/execute'
    try:
        payload = request.get_json(force=True)
        req = urllib.request.Request(
            PISTON_URL,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            return jsonify(result)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return jsonify({'error': f'Code execution API error {e.code}: {body}'}), 502
    except urllib.error.URLError as e:
        return jsonify({'error': f'Cannot reach execution API: {e.reason}'}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Socket: lifecycle ─────────────────────────────────────────────────────────
@socketio.on('connect')
def on_connect():
    emit('state_update', serialize_state())
    emit('players_update', serialize_players())

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    changed = False
    for name, p in players.items():
        if p['sid'] == sid and p['status'] == 'active':
            p['status'] = 'left'
            changed = True
            break
    if changed:
        socketio.emit('players_update', serialize_players())

# ── Socket: player registration ───────────────────────────────────────────────
@socketio.on('register_player')
def on_register_player(data):
    name = data.get('name', '').strip()
    if not name:
        return
    # If player re-connects with same name, update their sid
    players[name] = {
        'sid':       request.sid,
        'status':    'active',
        'joined_at': int(time.time() * 1000),
    }
    if name not in game_state['scores']:
        game_state['scores'][name] = 0
    socketio.emit('players_update', serialize_players())

# ── Socket: buzzer ────────────────────────────────────────────────────────────
@socketio.on('buzz')
def on_buzz(data):
    name = data.get('name', '').strip()
    if not name or not game_state['armed']:
        return
    if any(b['name'] == name for b in game_state['buzzes']):
        return
    now_ms = int(time.time() * 1000)
    if game_state['question_start'] is None:
        game_state['question_start'] = now_ms
    delta_ms = now_ms - game_state['question_start']
    rank = len(game_state['buzzes']) + 1
    game_state['buzzes'].append({
        'name':      name,
        'timestamp': now_ms,
        'rank':      rank,
        'delta_ms':  delta_ms,
    })
    socketio.emit('state_update', serialize_state())

# ── Socket: round management ──────────────────────────────────────────────────
@socketio.on('next_question')
def on_next_question():
    game_state['buzzes']         = []
    game_state['question_start'] = None
    game_state['armed']          = True
    game_state['question_number'] += 1
    socketio.emit('state_update', serialize_state())

@socketio.on('arm')
def on_arm():
    game_state['armed'] = not game_state['armed']
    socketio.emit('state_update', serialize_state())

# ── Socket: whiteboard ────────────────────────────────────────────────────────
@socketio.on('send_whiteboard')
def on_send_whiteboard(data):
    game_state['whiteboard']        = data.get('content', '')
    game_state['whiteboard_active'] = True
    socketio.emit('state_update', serialize_state())

@socketio.on('clear_whiteboard')
def on_clear_whiteboard():
    game_state['whiteboard']        = ''
    game_state['whiteboard_active'] = False
    socketio.emit('state_update', serialize_state())

# ── Socket: scores ────────────────────────────────────────────────────────────
@socketio.on('update_score')
def on_update_score(data):
    name  = data.get('name', '')
    delta = int(data.get('delta', 0))
    if name in game_state['scores']:
        game_state['scores'][name] = max(0, game_state['scores'][name] + delta)
    socketio.emit('state_update', serialize_state())
    socketio.emit('players_update', serialize_players())

@socketio.on('reset_scores')
def on_reset_scores():
    for name in game_state['scores']:
        game_state['scores'][name] = 0
    socketio.emit('state_update', serialize_state())
    socketio.emit('players_update', serialize_players())

# ── Socket: remove player ─────────────────────────────────────────────────────
@socketio.on('remove_player')
def on_remove_player(data):
    name = data.get('name', '')
    players.pop(name, None)
    game_state['scores'].pop(name, None)
    socketio.emit('players_update', serialize_players())
    socketio.emit('state_update', serialize_state())

# ── Serializers ───────────────────────────────────────────────────────────────
def serialize_state():
    return {
        'buzzes':            game_state['buzzes'],
        'armed':             game_state['armed'],
        'question_number':   game_state['question_number'],
        'whiteboard':        game_state['whiteboard'],
        'whiteboard_active': game_state['whiteboard_active'],
        'scores':            game_state['scores'],
    }

def serialize_players():
    result = []
    for name, p in players.items():
        result.append({
            'name':      name,
            'status':    p['status'],
            'joined_at': p['joined_at'],
            'score':     game_state['scores'].get(name, 0),
        })
    # Sort: active first, then by join time
    result.sort(key=lambda x: (x['status'] != 'active', x['joined_at']))
    return result

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("\n" + "="*55)
    print("  QuizBuzz - Real-time Quiz Buzzer System")
    print("="*55)
    print(f"  Home   ->  http://localhost:{port}")
    print(f"  Admin  ->  http://localhost:{port}/admin")
    print(f"  Player ->  http://localhost:{port}/player")
    print("="*55 + "\n")
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
