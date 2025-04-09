from flask import Flask, request
from flask_socketio import SocketIO, join_room, leave_room, emit

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Dictionary to store broadcaster socket ID for each room
broadcasters = {}

@app.route('/')
def index():
    return "Flask SocketIO Server is running!"

@socketio.on('connect')
def on_connect():
    print("Client connected")

@socketio.on('disconnect')
def on_disconnect():
    print("Client disconnected")

@socketio.on('join')
def on_join(data):
    room = data.get("room")
    username = data.get("username", "Anonymous")
    if room:
        join_room(room)
        emit('join_announcement', {
            'message': f'{username} has joined room {room}'
        }, room=room)
        print(f"{username} joined room {room}")
    else:
        print("Join event did not have a room id")

@socketio.on('start_broadcast')
def on_start_broadcast(data):
    room = data.get("room")
    if room:
        broadcasters[room] = request.sid
        print(f"Broadcaster started for room {room}: {request.sid}")

@socketio.on('signal')
def on_signal(data):
    room = data.get("room")
    type_ = data.get("type")
    message = data.get("data")
    to = data.get("to")
    from_ = request.sid  # Sender's socket ID

    if type_ == "offer" and from_ != broadcasters.get(room):
        broadcaster = broadcasters.get(room)
        if broadcaster:
            emit('signal', {'type': type_, 'data': message, 'from': from_}, to=broadcaster)
    elif to:
        emit('signal', {'type': type_, 'data': message, 'from': from_}, to=to)
    else:
        print("Invalid signal data")

@socketio.on('get_broadcaster')
def on_get_broadcaster(data):
    room = data.get("room")
    broadcaster = broadcasters.get(room)
    if broadcaster:
        emit("broadcaster_id", {"broadcasterId": broadcaster})

@socketio.on('leave')
def on_leave(data):
    room = data.get("room")
    username = data.get("username", "Anonymous")
    if room:
        leave_room(room)
        emit('leave_announcement', {
            'message': f'{username} has left room {room}'
        }, room=room)
        print(f"{username} left room {room}")
    else:
        print("Leave event did not have a room id")

if __name__ == '__main__':
    print("Starting server...")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
