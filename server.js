const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rooms structure
// rooms[roomCode] = { players: {socketId: playerNum}, slots: [null, null] }
const rooms = {};

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('createRoom', (cb) => {
    const code = makeRoomCode();
    rooms[code] = { players: {}, slots: [null, null] };
    socket.join(code);
    console.log('room created', code);
    cb && cb({ room: code });
  });

  socket.on('joinRoom', ({ room }, cb) => {
    if (!rooms[room]) {
      return cb && cb({ ok: false, error: 'Room not found' });
    }
    const r = rooms[room];
    // find empty slot
    const idx = r.slots[0] ? (r.slots[1] ? -1 : 1) : 0;
    if (idx === -1) return cb && cb({ ok: false, error: 'Room full' });

    r.slots[idx] = socket.id;
    r.players[socket.id] = idx + 1; // player numbers 1 or 2
    socket.join(room);
    io.to(room).emit('roomUpdate', { slots: r.slots.map(s => !!s) });
    console.log('join', socket.id, 'as', idx + 1, 'in', room);
    cb && cb({ ok: true, player: idx + 1 });
  });

  socket.on('leaveRoom', ({ room }) => {
    if (!rooms[room]) return;
    const r = rooms[room];
    r.slots = r.slots.map(s => (s === socket.id ? null : s));
    delete r.players[socket.id];
    io.to(room).emit('roomUpdate', { slots: r.slots.map(s => !!s) });
    socket.leave(room);
  });

  socket.on('startGame', ({ room }) => {
    io.to(room).emit('startGame');
  });

  // controller sends input events
  socket.on('input', ({ room, input }) => {
    io.to(room).emit('playerInput', { id: socket.id, input });
  });

  socket.on('disconnect', () => {
    // remove from any room
    for (const code of Object.keys(rooms)) {
      const r = rooms[code];
      if (!r) continue;
      if (r.slots.includes(socket.id)) {
        r.slots = r.slots.map(s => (s === socket.id ? null : s));
        delete r.players[socket.id];
        io.to(code).emit('roomUpdate', { slots: r.slots.map(s => !!s) });
      }
      // if empty, delete room after disconnect
      if (!r.slots[0] && !r.slots[1]) {
        delete rooms[code];
      }
    }
    console.log('socket disconnected', socket.id);
  });
});

http.listen(PORT, () => {
  console.log('Server running on port', PORT);
});