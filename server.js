const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// rooms structure
// rooms[code] = { ownerSocket, slots: [null..3], socketToPlayer: { socketId: playerNum } }
const rooms = {};

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

io.on('connection', socket => {
  console.log('connect', socket.id);

  socket.on('createRoom', (cb) => {
    const code = makeRoomCode();
    rooms[code] = { ownerSocket: socket.id, slots: [null, null, null, null], socketToPlayer: {} };
    socket.join(code);
    console.log('room created', code);
    cb && cb({ room: code });
    io.to(code).emit('roomUpdate', getRoomState(code));
  });

  socket.on('joinRoom', ({ room }, cb) => {
    if (!rooms[room]) return cb && cb({ ok: false, error: 'Room not found' });
    const r = rooms[room];
    // find next available slot (0..3)
    const idx = r.slots.findIndex(s => s === null);
    if (idx === -1) return cb && cb({ ok: false, error: 'Room full' });
    r.slots[idx] = socket.id;
    r.socketToPlayer[socket.id] = idx + 1; // player numbers 1..4
    socket.join(room);
    console.log('joined', socket.id, 'as P' + (idx+1), 'room', room);
    io.to(room).emit('roomUpdate', getRoomState(room));
    cb && cb({ ok: true, player: idx + 1 });
  });

  socket.on('leaveRoom', ({ room }) => {
    if (!rooms[room]) return;
    const r = rooms[room];
    r.slots = r.slots.map(s => (s === socket.id ? null : s));
    delete r.socketToPlayer[socket.id];
    socket.leave(room);
    io.to(room).emit('roomUpdate', getRoomState(room));
  });

  socket.on('startGame', ({ room, mode }) => {
    // mode: 2 | 3 | 4 (players)
    if (!rooms[room]) return;
    const r = rooms[room];
    // Trim slots to selected mode: if mode < 4, we'll treat higher slot as spectator (null)
    // But we won't kick players — TV should only require enough players (min 2)
    io.to(room).emit('startGame', { mode: mode || 2 });
  });

  socket.on('input', ({ room, input }) => {
    if (!rooms[room]) return;
    const r = rooms[room];
    const pn = r.socketToPlayer[socket.id];
    if (!pn) return; // ignore if not in room
    // send authoritative input with player number set by server
    io.to(room).emit('playerInput', { player: pn, input });
  });

  socket.on('disconnect', () => {
    // remove from any room
    for (const code of Object.keys(rooms)) {
      const r = rooms[code];
      if (!r) continue;
      if (r.socketToPlayer[socket.id]) {
        const pnum = r.socketToPlayer[socket.id];
        r.slots[pnum - 1] = null;
        delete r.socketToPlayer[socket.id];
        io.to(code).emit('roomUpdate', getRoomState(code));
      }
      if (!r.slots.some(s => s)) {
        // room empty -> delete
        delete rooms[code];
      }
    }
    console.log('disconnect', socket.id);
  });

  // Helper for small ping
  socket.on('pingServer', cb => cb && cb({ ok: true }));
});

function getRoomState(room) {
  const r = rooms[room];
  if (!r) return null;
  return {
    slots: r.slots.map(s => !!s),
    playerSockets: r.slots.slice(), // array of socket ids or null
  };
}

http.listen(PORT, () => console.log('Server listening on', PORT));