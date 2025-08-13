const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { 
  cors: { origin: "*" },
  pingInterval: 10000,
  pingTimeout: 5000
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Enhanced room structure with game state
const rooms = {};

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Game state management
class GameRoom {
  constructor(code, ownerSocket) {
    this.code = code;
    this.ownerSocket = ownerSocket;
    this.slots = [null, null, null, null];
    this.socketToPlayer = {};
    this.gameState = {
      running: false,
      mode: 2,
      paddles: {},
      ball: { x: 640, y: 360, vx: 0, vy: 0, speed: 8 },
      scores: [0, 0, 0, 0],
      particles: [],
      lastUpdate: Date.now()
    };
    this.inputBuffer = {};
    this.gameLoop = null;
  }

  addPlayer(socketId) {
    const idx = this.slots.findIndex(s => s === null);
    if (idx === -1) return null;
    this.slots[idx] = socketId;
    this.socketToPlayer[socketId] = idx + 1;
    this.inputBuffer[socketId] = { left: false, right: false, up: false, down: false, action: false };
    return idx + 1;
  }

  removePlayer(socketId) {
    const playerNum = this.socketToPlayer[socketId];
    if (!playerNum) return;
    this.slots[playerNum - 1] = null;
    delete this.socketToPlayer[socketId];
    delete this.inputBuffer[socketId];
  }

  startGame(mode) {
    this.gameState.mode = mode;
    this.gameState.running = true;
    this.initPaddles();
    this.resetBall();
    this.startGameLoop();
  }

  initPaddles() {
    // Initialize smooth paddle positions based on mode
    this.gameState.paddles = {
      1: { x: 40, y: 360, w: 20, h: 120, vx: 0, vy: 0, targetY: 360 },
      2: { x: 1240, y: 360, w: 20, h: 120, vx: 0, vy: 0, targetY: 360 },
      3: { x: 640, y: 30, w: 200, h: 20, vx: 0, vy: 0, targetX: 640 },
      4: { x: 640, y: 690, w: 200, h: 20, vx: 0, vy: 0, targetX: 640 }
    };
  }

  resetBall() {
    const angle = (Math.random() * Math.PI / 4) - Math.PI / 8 + (Math.random() > 0.5 ? 0 : Math.PI);
    this.gameState.ball = {
      x: 640,
      y: 360,
      vx: Math.cos(angle) * 8,
      vy: Math.sin(angle) * 8,
      speed: 8,
      trail: []
    };
  }

  startGameLoop() {
    if (this.gameLoop) clearInterval(this.gameLoop);
    this.gameLoop = setInterval(() => this.updatePhysics(), 1000 / 60); // 60 FPS
  }

  updatePhysics() {
    if (!this.gameState.running) return;
    
    const dt = 1 / 60; // Fixed timestep
    const ball = this.gameState.ball;
    const paddles = this.gameState.paddles;

    // Update paddle positions with smooth interpolation
    Object.keys(paddles).forEach(key => {
      const paddle = paddles[key];
      const playerSocket = this.slots[key - 1];
      if (!playerSocket) return;
      
      const input = this.inputBuffer[playerSocket];
      if (!input) return;

      if (key <= 2) {
        // Vertical paddles - smooth movement
        if (input.up) paddle.targetY = Math.max(60, paddle.targetY - 12);
        if (input.down) paddle.targetY = Math.min(660, paddle.targetY + 12);
        paddle.y += (paddle.targetY - paddle.y) * 0.15; // Smooth interpolation
      } else {
        // Horizontal paddles
        if (input.left) paddle.targetX = Math.max(100, paddle.targetX - 12);
        if (input.right) paddle.targetX = Math.min(1180, paddle.targetX + 12);
        paddle.x += (paddle.targetX - paddle.x) * 0.15;
      }
    });

    // Update ball with trail
    ball.trail = ball.trail || [];
    ball.trail.push({ x: ball.x, y: ball.y, alpha: 1 });
    if (ball.trail.length > 12) ball.trail.shift();
    
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Enhanced ball collisions with walls
    if (ball.y <= 15 || ball.y >= 705) {
      ball.vy *= -1;
      this.createImpactParticles(ball.x, ball.y);
    }
    if (ball.x <= 15 || ball.x >= 1265) {
      ball.vx *= -1;
      this.createImpactParticles(ball.x, ball.y);
    }

    // Paddle collisions with spin effect
    Object.keys(paddles).forEach(key => {
      const paddle = paddles[key];
      if (!this.slots[key - 1]) return; // Skip if no player
      
      if (this.checkPaddleCollision(ball, paddle, key)) {
        this.handlePaddleHit(ball, paddle, key);
      }
    });

    // Update particles
    this.gameState.particles = this.gameState.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.02;
      p.size *= 0.98;
      return p.alpha > 0;
    });
  }

  checkPaddleCollision(ball, paddle, playerNum) {
    return ball.x > paddle.x - paddle.w/2 && 
           ball.x < paddle.x + paddle.w/2 &&
           ball.y > paddle.y - paddle.h/2 && 
           ball.y < paddle.y + paddle.h/2;
  }

  handlePaddleHit(ball, paddle, playerNum) {
    const relativeIntersectY = (paddle.y - ball.y) / (paddle.h / 2);
    const bounceAngle = relativeIntersectY * Math.PI / 4;
    
    ball.speed = Math.min(ball.speed * 1.05, 20); // Gradual speed increase
    
    if (playerNum <= 2) {
      ball.vx = (playerNum === '1' ? 1 : -1) * ball.speed * Math.cos(bounceAngle);
      ball.vy = ball.speed * -Math.sin(bounceAngle);
    } else {
      ball.vy = (playerNum === '3' ? 1 : -1) * ball.speed * Math.cos(bounceAngle);
      ball.vx = ball.speed * -Math.sin(bounceAngle);
    }
    
    this.createImpactParticles(ball.x, ball.y, true);
  }

  createImpactParticles(x, y, isPaddle = false) {
    const count = isPaddle ? 8 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      this.gameState.particles.push({
        x, y,
        vx: Math.cos(angle) * (isPaddle ? 4 : 2),
        vy: Math.sin(angle) * (isPaddle ? 4 : 2),
        size: isPaddle ? 8 : 5,
        alpha: 1,
        color: isPaddle ? '#ff2b2b' : '#ffffff'
      });
    }
  }

  stopGame() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.gameState.running = false;
  }
}

io.on('connection', socket => {
  console.log('connect', socket.id);

  socket.on('createRoom', (cb) => {
    const code = makeRoomCode();
    const room = new GameRoom(code, socket.id);
    rooms[code] = room;
    socket.join(code);
    console.log('room created', code);
    cb && cb({ room: code });
    io.to(code).emit('roomUpdate', getRoomState(code));
  });

  socket.on('joinRoom', ({ room }, cb) => {
    if (!rooms[room]) return cb && cb({ ok: false, error: 'Room not found' });
    const gameRoom = rooms[room];
    const playerNum = gameRoom.addPlayer(socket.id);
    if (!playerNum) return cb && cb({ ok: false, error: 'Room full' });
    
    socket.join(room);
    console.log('joined', socket.id, 'as P' + playerNum, 'room', room);
    io.to(room).emit('roomUpdate', getRoomState(room));
    cb && cb({ ok: true, player: playerNum });
  });

  socket.on('startGame', ({ room, mode }) => {
    if (!rooms[room]) return;
    const gameRoom = rooms[room];
    gameRoom.startGame(mode || 2);
    io.to(room).emit('startGame', { mode: mode || 2 });
    
    // Start sending game state updates
    const stateInterval = setInterval(() => {
      if (!rooms[room] || !gameRoom.gameState.running) {
        clearInterval(stateInterval);
        return;
      }
      io.to(room).emit('gameState', gameRoom.gameState);
    }, 1000 / 30); // 30 FPS for network updates
  });

  socket.on('input', ({ room, input }) => {
    if (!rooms[room]) return;
    const gameRoom = rooms[room];
    if (gameRoom.inputBuffer[socket.id]) {
      gameRoom.inputBuffer[socket.id] = input;
    }
  });

  socket.on('disconnect', () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      if (!room) continue;
      room.removePlayer(socket.id);
      io.to(code).emit('roomUpdate', getRoomState(code));
      
      // Clean up empty rooms
      if (!room.slots.some(s => s)) {
        room.stopGame();
        delete rooms[code];
      }
    }
    console.log('disconnect', socket.id);
  });
});

function getRoomState(room) {
  const r = rooms[room];
  if (!r) return null;
  return {
    slots: r.slots.map(s => !!s),
    playerSockets: r.slots.slice()
  };
}

http.listen(PORT, () => console.log('Premium server running on', PORT));