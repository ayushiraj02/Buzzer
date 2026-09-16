# QuizBuzz 🎮⚡

A **real-time quiz buzzer system** for 3 players + admin, built with Python (Flask + Socket.io).

## Features
- 🔴 Giant animated buzzer button for each player  
- ⚡ Millisecond-accurate buzz timestamps  
- 🏆 Live leaderboard on admin dashboard  
- 📋 Answer queue showing who to call in order  
- 🔄 "Next Question" resets all players instantly  
- 🟢/🔴 Admin arm/disarm buzzer control  

## Running Locally

```bash
pip install -r requirements.txt
python server.py
```

Open:
- `http://localhost:5000` → Landing page
- `http://localhost:5000/admin` → Admin dashboard  
- `http://localhost:5000/player` → Player buzzer

## Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `gunicorn --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 --timeout 120 server:app`
6. Deploy! 🚀

## Tech Stack
- **Backend**: Python, Flask, Flask-SocketIO, gevent  
- **Frontend**: Vanilla HTML/CSS/JS, Socket.io client  
- **Theme**: Dark glassmorphism
