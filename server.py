from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit
import time
import os

app = Flask(__name__, static_folder='public', template_folder='public')
app.config['SECRET_KEY'] = 'quiz-buzzer-secret-2024'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ── In-memory game state ──────────────────────────────────────────────────────
game_state = {
    'buzzes': [],             # List of {name, timestamp, rank, delta_ms}
    'question_start': None,   # epoch ms when first buzz happened
    'armed': True,            # whether buzzing is allowed
    'question_number': 1,
}

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

# ── Socket events ─────────────────────────────────────────────────────────────
@socketio.on('connect')
def on_connect():
    """Send current state to newly connected client."""
    emit('state_update', serialize_state())

@socketio.on('buzz')
def on_buzz(data):
    """Handle a player pressing the buzzer."""
    name = data.get('name', '').strip()
    if not name:
        return

    now_ms = int(time.time() * 1000)

    # Ignore if buzzing is disabled
    if not game_state['armed']:
        return

    # Ignore if player already buzzed
    if any(b['name'] == name for b in game_state['buzzes']):
        return

    # Record the start time on the very first buzz
    if game_state['question_start'] is None:
        game_state['question_start'] = now_ms

    delta_ms = now_ms - game_state['question_start']
    rank = len(game_state['buzzes']) + 1

    game_state['buzzes'].append({
        'name': name,
        'timestamp': now_ms,
        'rank': rank,
        'delta_ms': delta_ms,
    })

    # Broadcast updated state to ALL clients instantly
    socketio.emit('state_update', serialize_state())

@socketio.on('next_question')
def on_next_question():
    """Admin resets the round for a new question."""
    game_state['buzzes'] = []
    game_state['question_start'] = None
    game_state['armed'] = True
    game_state['question_number'] += 1
    socketio.emit('state_update', serialize_state())

@socketio.on('arm')
def on_arm():
    """Admin toggles arm/disarm of the buzzer."""
    game_state['armed'] = not game_state['armed']
    socketio.emit('state_update', serialize_state())

def serialize_state():
    return {
        'buzzes': game_state['buzzes'],
        'armed': game_state['armed'],
        'question_number': game_state['question_number'],
    }

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("\n" + "="*55)
    print("  QuizBuzz - Real-time Quiz Buzzer System")
    print("="*55)
    print("  Home   ->  http://localhost:5000")
    print("  Admin  ->  http://localhost:5000/admin")
    print("  Player ->  http://localhost:5000/player")
    print("="*55 + "\n")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
