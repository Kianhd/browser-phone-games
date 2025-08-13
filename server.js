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

// Game rooms storage
const rooms = {};

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Optimized Game Room Class
class GameRoom {
  constructor(code, ownerSocket) {
    this.code = code;
    this.ownerSocket = ownerSocket;
    this.slots = [null, null, null, null, null];
    this.readyStates = [false, false, false, false, false];
    this.socketToPlayer = {};
    this.pentagonRotation = 0; // For pentagon mode rotation
    this.gameState = {
      running: false,
      mode: 2,
      paddles: {},
      ball: { x: 640, y: 360, vx: 0, vy: 0, speed: 6 },
      scores: [0, 0, 0, 0],
      powerUp: null,
      powerUpTimer: 0,
      activePowerUp: null,
      lastHitPlayer: null,
      winScore: 5
    };
    this.inputBuffer = {};
    this.gameLoop = null;
    this.powerUpInterval = null;
  }

  addPlayer(socketId) {
    const idx = this.slots.findIndex(s => s === null);
    if (idx === -1) return null;
    this.slots[idx] = socketId;
    this.socketToPlayer[socketId] = idx + 1;
    this.inputBuffer[socketId] = { position: 0.5, lastUpdate: Date.now() }; // 0 to 1 normalized position
    return idx + 1;
  }

  removePlayer(socketId) {
    const playerNum = this.socketToPlayer[socketId];
    if (!playerNum) return;
    this.slots[playerNum - 1] = null;
    this.readyStates[playerNum - 1] = false;
    delete this.socketToPlayer[socketId];
    delete this.inputBuffer[socketId];
  }

  setPlayerReady(playerNum) {
    if (playerNum >= 1 && playerNum <= 5) {
      this.readyStates[playerNum - 1] = true;
    }
  }

  startGame(mode, winScore = 5) {
    this.gameState.mode = mode;
    this.gameState.winScore = winScore;
    this.gameState.running = false; // Don't start immediately, wait for countdown
    this.gameState.countdown = 3; // Start countdown from 3
    this.gameState.countdownActive = true;
    this.gameState.scores = [0, 0, 0, 0, 0];
    this.gameState.gameStartTime = Date.now(); // Track game start time
    this.gameState.speedMultiplier = 1; // Initial speed multiplier
    this.initPaddles();
    this.resetBallToCenter(); // Place ball in center without velocity during countdown
    this.startCountdown();
    this.startSpeedProgression();
    this.startPentagonRotation();
  }

  resetBallToCenter() {
    // Ball stays in center with no velocity during countdown
    const centerX = this.gameState.fieldWidth / 2;
    const centerY = this.gameState.fieldHeight / 2;
    this.gameState.ball = {
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      speed: 6
    };
    this.gameState.lastHitPlayer = null;
  }

  initPaddles() {
    if (this.gameState.mode === 5) {
      // Pentagon layout for 5 players
      const centerX = 400;
      const centerY = 400;
      const radius = 320;
      const paddleLength = 100;
      
      this.gameState.paddles = {};
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2; // Start from top
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        this.gameState.paddles[i + 1] = {
          x: x,
          y: y,
          w: 15,
          h: paddleLength,
          angle: angle + Math.PI / 2, // Perpendicular to radius
          baseAngle: angle + Math.PI / 2 // Store base angle for rotation
        };
      }
      this.gameState.fieldWidth = 800;
      this.gameState.fieldHeight = 800;
      this.gameState.isPentagon = true;
    } else if (this.gameState.mode >= 3) {
      // Square layout for 3-4 players - all players get equal space
      this.gameState.paddles = {
        1: { x: 40, y: 400, w: 15, h: 120 },    // Left
        2: { x: 760, y: 400, w: 15, h: 120 },   // Right  
        3: { x: 400, y: 40, w: 120, h: 15 },    // Top
        4: { x: 400, y: 760, w: 120, h: 15 }    // Bottom
      };
      this.gameState.fieldWidth = 800;
      this.gameState.fieldHeight = 800;
      this.gameState.isPentagon = false;
    } else {
      // Widescreen layout for 2 players
      this.gameState.paddles = {
        1: { x: 40, y: 360, w: 15, h: 100 },
        2: { x: 1240, y: 360, w: 15, h: 100 },
        3: { x: 640, y: 30, w: 180, h: 15 },
        4: { x: 640, y: 690, w: 180, h: 15 }
      };
      this.gameState.fieldWidth = 1280;
      this.gameState.fieldHeight = 720;
      this.gameState.isPentagon = false;
    }
  }

  resetBall() {
    const angle = (Math.random() * Math.PI / 3) - Math.PI / 6 + (Math.random() > 0.5 ? 0 : Math.PI);
    const baseSpeed = 6 * this.gameState.speedMultiplier;
    const centerX = this.gameState.fieldWidth / 2;
    const centerY = this.gameState.fieldHeight / 2;
    this.gameState.ball = {
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed,
      speed: baseSpeed
    };
    this.gameState.lastHitPlayer = null;
  }

  startSpeedProgression() {
    // Increase speed every 20 seconds (not for pentagon mode)
    this.speedProgressionInterval = setInterval(() => {
      if (this.gameState.running && this.gameState.mode !== 5) {
        // Send warning 3 seconds before speed increase
        io.to(this.code).emit('speedWarning', { 
          currentSpeed: this.gameState.speedMultiplier,
          newSpeed: this.gameState.speedMultiplier + 0.2
        });
        
        // Actually increase speed after 3 seconds
        setTimeout(() => {
          if (this.gameState.running && this.gameState.mode !== 5) {
            this.gameState.speedMultiplier += 0.2;
            // Update current ball speed if game is running
            if (this.gameState.ball) {
              const currentSpeed = Math.sqrt(this.gameState.ball.vx * this.gameState.ball.vx + this.gameState.ball.vy * this.gameState.ball.vy);
              const speedRatio = (6 * this.gameState.speedMultiplier) / currentSpeed;
              this.gameState.ball.vx *= speedRatio;
              this.gameState.ball.vy *= speedRatio;
              this.gameState.ball.speed = 6 * this.gameState.speedMultiplier;
            }
            
            // Send speed increased notification
            io.to(this.code).emit('speedIncreased', { 
              newSpeed: this.gameState.speedMultiplier
            });
          }
        }, 3000);
      }
    }, 20000);
  }

  startPentagonRotation() {
    // Rotate pentagon slowly - 10 milliseconds interval for very slow rotation
    if (this.gameState.mode === 5) {
      setInterval(() => {
        if (this.gameState.running || this.gameState.countdownActive) {
          this.pentagonRotation += 0.001; // Very slow rotation
          this.updatePentagonPaddles();
        }
      }, 10);
    }
  }

  updatePentagonPaddles() {
    if (this.gameState.mode !== 5) return;
    
    const centerX = 400;
    const centerY = 400;
    const radius = 320;
    
    Object.keys(this.gameState.paddles).forEach(key => {
      const paddle = this.gameState.paddles[key];
      const playerIndex = parseInt(key) - 1;
      
      // Calculate new position based on rotation
      const baseAngle = (playerIndex * 2 * Math.PI / 5) - Math.PI / 2;
      const currentAngle = baseAngle + this.pentagonRotation;
      
      paddle.x = centerX + Math.cos(currentAngle) * radius;
      paddle.y = centerY + Math.sin(currentAngle) * radius;
      paddle.angle = currentAngle + Math.PI / 2; // Perpendicular to radius
    });
  }

  startCountdown() {
    // Send initial countdown
    io.to(this.code).emit('countdownTick', { count: this.gameState.countdown });
    
    const countdownInterval = setInterval(() => {
      this.gameState.countdown--;
      
      if (this.gameState.countdown < 0) {
        clearInterval(countdownInterval);
        this.gameState.countdownActive = false;
        this.gameState.running = true;
        this.resetBall(); // Now give ball velocity
        this.startGameLoop();
        this.startPowerUpSystem();
        
        // Send game started event
        io.to(this.code).emit('countdownComplete');
        return;
      }
      
      // Broadcast countdown number (including 0 for "GO!")
      io.to(this.code).emit('countdownTick', { count: this.gameState.countdown });
    }, 1000);
  }

  startGameLoop() {
    if (this.gameLoop) clearInterval(this.gameLoop);
    this.gameLoop = setInterval(() => this.updatePhysics(), 1000 / 60);
  }

  startPowerUpSystem() {
    if (this.powerUpInterval) clearInterval(this.powerUpInterval);
    
    // Spawn first power-up after 10 seconds
    setTimeout(() => {
      this.spawnPowerUp();
      // Then spawn every 10-20 seconds depending on state
      this.powerUpInterval = setInterval(() => {
        if (!this.gameState.powerUp && !this.gameState.activePowerUp) {
          this.spawnPowerUp();
        }
      }, 10000);
    }, 10000);
  }

  spawnPowerUp() {
    if (this.gameState.powerUp || this.gameState.activePowerUp) return;
    
    // Random power-up type: 'grow' (50%), 'shrink' (30%), 'split' (20%)
    const rand = Math.random();
    let powerUpType;
    if (rand < 0.5) {
      powerUpType = 'grow';
    } else if (rand < 0.8) {
      powerUpType = 'shrink';
    } else {
      powerUpType = 'split';
    }
    
    // Random position avoiding edges, scaled for field size
    const margin = 150;
    const spawnWidth = this.gameState.fieldWidth - (margin * 2);
    const spawnHeight = this.gameState.fieldHeight - (margin * 2);
    
    this.gameState.powerUp = {
      x: margin + Math.random() * spawnWidth,
      y: margin + Math.random() * spawnHeight,
      size: 30,
      type: powerUpType,
      lifetime: 10000,
      spawnTime: Date.now()
    };
  }

  updatePhysics() {
    if (!this.gameState.running || this.gameState.countdownActive) return;
    
    const ball = this.gameState.ball;
    const paddles = this.gameState.paddles;

    // Update paddle positions from input (direct mapping)
    Object.keys(paddles).forEach(key => {
      const paddle = paddles[key];
      const playerSocket = this.slots[key - 1];
      if (!playerSocket) return;
      
      const input = this.inputBuffer[playerSocket];
      if (!input) return;

      // Direct position mapping from touch input
      if (this.gameState.mode === 5) {
        // Pentagon mode - radial movement
        const centerX = 400;
        const centerY = 400;
        const minRadius = 250;
        const maxRadius = 350;
        const targetRadius = minRadius + (input.position * (maxRadius - minRadius));
        
        const playerIndex = parseInt(key) - 1;
        const baseAngle = (playerIndex * 2 * Math.PI / 5) - Math.PI / 2;
        const currentAngle = baseAngle + this.pentagonRotation;
        
        paddle.x = centerX + Math.cos(currentAngle) * targetRadius;
        paddle.y = centerY + Math.sin(currentAngle) * targetRadius;
        paddle.angle = currentAngle + Math.PI / 2; // Keep perpendicular
      } else if (key <= 2) {
        // Vertical paddles
        const playableHeight = this.gameState.fieldHeight - 120; // Leave 60px margin on each side
        paddle.y = 60 + (input.position * playableHeight);
      } else {
        // Horizontal paddles  
        const playableWidth = this.gameState.fieldWidth - 120; // Leave 60px margin on each side
        paddle.x = 60 + (input.position * playableWidth);
      }
    });

    // Update ball position
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Check wall collisions and scoring
    this.checkWallCollisions();

    // Check paddle collisions
    Object.keys(paddles).forEach(key => {
      const paddle = paddles[key];
      if (!this.slots[key - 1]) return;
      
      if (this.checkPaddleCollision(ball, paddle)) {
        this.handlePaddleHit(ball, paddle, key);
        this.gameState.lastHitPlayer = parseInt(key);
      }
    });

    // Check power-up collision
    if (this.gameState.powerUp && this.gameState.lastHitPlayer) {
      const powerUp = this.gameState.powerUp;
      const dist = Math.sqrt(
        Math.pow(ball.x - powerUp.x, 2) + 
        Math.pow(ball.y - powerUp.y, 2)
      );
      
      if (dist < powerUp.size + 10) {
        this.collectPowerUp(this.gameState.lastHitPlayer);
      }
    }

    // Update power-up lifetime
    if (this.gameState.powerUp) {
      const elapsed = Date.now() - this.gameState.powerUp.spawnTime;
      if (elapsed > 10000) {
        this.gameState.powerUp = null;
      }
    }

    // Update active power-up
    if (this.gameState.activePowerUp) {
      const elapsed = Date.now() - this.gameState.activePowerUp.startTime;
      if (elapsed > 10000) {
        // Remove power-up effect and restore original size
        const paddle = this.gameState.paddles[this.gameState.activePowerUp.player];
        if (paddle) {
          if (this.gameState.activePowerUp.player <= 2) {
            paddle.h = 100; // Restore original height
          } else {
            paddle.w = 180; // Restore original width
          }
          // Remove split effect
          paddle.split = false;
          paddle.gapSize = 0;
        }
        this.gameState.activePowerUp = null;
      }
    }

    // Check win condition
    const winner = this.gameState.scores.findIndex(score => score >= this.gameState.winScore);
    if (winner !== -1) {
      this.gameState.running = false;
      io.to(this.code).emit('gameOver', { winner: winner + 1 });
      this.stopGame();
    }
  }

  checkWallCollisions() {
    const ball = this.gameState.ball;
    const fieldWidth = this.gameState.fieldWidth;
    const fieldHeight = this.gameState.fieldHeight;
    let scored = false;
    
    if (this.gameState.mode === 5) {
      // Pentagon collision detection
      this.checkPentagonCollision();
      return;
    }
    
    // Regular rectangular field collisions
    // Left wall - Player 2 scores (Player 1 loses)
    if (ball.x <= 10) {
      if (this.gameState.mode >= 2 && this.slots[1]) {
        this.gameState.scores[1]++;
        scored = true;
      }
      this.handleScore();
    }
    
    // Right wall - Player 1 scores (Player 2 loses)
    if (ball.x >= fieldWidth - 10) {
      if (this.slots[0]) {
        this.gameState.scores[0]++;
        scored = true;
      }
      this.handleScore();
    }
    
    // Top wall - Player 4 scores (Player 3 loses) if playing 3+ players
    if (ball.y <= 10) {
      if (this.gameState.mode >= 3 && this.slots[2]) {
        if (this.gameState.mode >= 4 && this.slots[3]) {
          this.gameState.scores[3]++; // Player 4 scores
        } else {
          this.gameState.scores[0]++; // Player 1 scores if no Player 4
        }
        scored = true;
        this.handleScore();
      } else {
        ball.vy *= -1;
      }
    }
    
    // Bottom wall - Player 3 scores (Player 4 loses) if playing 4 players
    if (ball.y >= fieldHeight - 10) {
      if (this.gameState.mode >= 4 && this.slots[3]) {
        this.gameState.scores[2]++; // Player 3 scores
        scored = true;
        this.handleScore();
      } else {
        ball.vy *= -1;
      }
    }
  }

  checkPentagonCollision() {
    const ball = this.gameState.ball;
    const centerX = 400;
    const centerY = 400;
    const outerRadius = 350;
    
    // Check if ball is outside pentagon boundary
    const distFromCenter = Math.sqrt(Math.pow(ball.x - centerX, 2) + Math.pow(ball.y - centerY, 2));
    
    if (distFromCenter > outerRadius - 10) {
      // Determine which side of pentagon was hit
      const angleFromCenter = Math.atan2(ball.y - centerY, ball.x - centerX);
      let normalizedAngle = angleFromCenter + Math.PI / 2; // Normalize to start from top
      if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
      
      const sideAngle = 2 * Math.PI / 5;
      const hitSide = Math.floor(normalizedAngle / sideAngle);
      const scoringPlayer = (hitSide + 2) % 5; // Opposite player scores
      
      if (this.slots[scoringPlayer]) {
        this.gameState.scores[scoringPlayer]++;
        this.handleScore();
      }
    }
  }

  handleScore() {
    // Pause game for countdown
    this.gameState.running = false;
    this.gameState.countdownActive = true;
    this.gameState.countdown = 3;
    this.resetBallToCenter();
    
    // Start countdown after a brief pause
    setTimeout(() => {
      this.startScoreCountdown();
    }, 500);
  }

  startScoreCountdown() {
    // Send initial countdown
    io.to(this.code).emit('countdownTick', { count: this.gameState.countdown });
    
    const countdownInterval = setInterval(() => {
      this.gameState.countdown--;
      
      if (this.gameState.countdown < 0) {
        clearInterval(countdownInterval);
        this.gameState.countdownActive = false;
        this.gameState.running = true;
        this.resetBall(); // Give ball velocity
        
        // Send game resumed event
        io.to(this.code).emit('countdownComplete');
        return;
      }
      
      // Broadcast countdown number (including 0 for "GO!")
      io.to(this.code).emit('countdownTick', { count: this.gameState.countdown });
    }, 1000);
  }

  checkPaddleCollision(ball, paddle) {
    // Basic collision detection
    const hit = ball.x - 10 < paddle.x + paddle.w/2 && 
           ball.x + 10 > paddle.x - paddle.w/2 &&
           ball.y - 10 < paddle.y + paddle.h/2 && 
           ball.y + 10 > paddle.y - paddle.h/2;
    
    if (!hit || !paddle.split) return hit;
    
    // Check if ball is in the gap (split paddle)
    if (paddle.gapSize && paddle.gapSize > 0) {
      // For vertical paddles (players 1 & 2)
      if (paddle.h > paddle.w) {
        const gapTop = paddle.y - paddle.gapSize / 2;
        const gapBottom = paddle.y + paddle.gapSize / 2;
        if (ball.y > gapTop && ball.y < gapBottom) {
          return false; // Ball passes through gap
        }
      } else {
        // For horizontal paddles (players 3 & 4)
        const gapLeft = paddle.x - paddle.gapSize / 2;
        const gapRight = paddle.x + paddle.gapSize / 2;
        if (ball.x > gapLeft && ball.x < gapRight) {
          return false; // Ball passes through gap
        }
      }
    }
    
    return hit;
  }

  handlePaddleHit(ball, paddle, playerNum) {
    const relativeIntersectY = (paddle.y - ball.y) / (paddle.h / 2);
    const bounceAngle = relativeIntersectY * Math.PI / 4;
    
    ball.speed = Math.min(ball.speed * 1.02, 16);
    
    if (playerNum <= 2) {
      ball.vx = (playerNum == 1 ? 1 : -1) * ball.speed * Math.cos(bounceAngle);
      ball.vy = ball.speed * -Math.sin(bounceAngle);
    } else {
      ball.vy = (playerNum == 3 ? 1 : -1) * ball.speed * Math.cos(bounceAngle);
      ball.vx = ball.speed * -Math.sin(bounceAngle);
    }
  }

  collectPowerUp(playerNum) {
    const powerUpType = this.gameState.powerUp.type;
    const paddle = this.gameState.paddles[playerNum];
    if (paddle) {
      // Apply power-up effect based on type
      if (powerUpType === 'grow') {
        if (playerNum <= 2) {
          paddle.h = 130; // 1.3x size
        } else {
          paddle.w = 234; // 1.3x size
        }
      } else if (powerUpType === 'shrink') {
        if (playerNum <= 2) {
          paddle.h = 50; // 0.5x size (half)
        } else {
          paddle.w = 90; // 0.5x size (half)
        }
      } else if (powerUpType === 'split') {
        // Split paddle creates a gap in the middle
        paddle.split = true;
        if (playerNum <= 2) {
          paddle.gapSize = 40; // Gap size for vertical paddles
        } else {
          paddle.gapSize = 60; // Gap size for horizontal paddles
        }
      }
      
      this.gameState.activePowerUp = {
        player: playerNum,
        type: powerUpType,
        startTime: Date.now()
      };
      
      this.gameState.powerUp = null;
      
      // Next power-up in 15-25 seconds (random)
      const nextSpawnTime = 15000 + Math.random() * 10000;
      setTimeout(() => {
        if (this.gameState.running) {
          this.spawnPowerUp();
        }
      }, nextSpawnTime);
    }
  }

  stopGame() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    if (this.powerUpInterval) {
      clearInterval(this.powerUpInterval);
      this.powerUpInterval = null;
    }
    if (this.speedProgressionInterval) {
      clearInterval(this.speedProgressionInterval);
      this.speedProgressionInterval = null;
    }
    this.gameState.running = false;
  }
}

// Socket handling
io.on('connection', socket => {
  console.log('connect', socket.id);

  socket.on('createRoom', (cb) => {
    const code = makeRoomCode();
    const room = new GameRoom(code, socket.id);
    rooms[code] = room;
    socket.join(code);
    console.log('room created', code);
    cb && cb({ room: code });
    const initialState = getRoomState(code);
    console.log('Broadcasting initial room state:', initialState); // Debug log
    io.to(code).emit('roomUpdate', initialState);
  });

  socket.on('joinRoom', ({ room }, cb) => {
    if (!rooms[room]) return cb && cb({ ok: false, error: 'Room not found' });
    const gameRoom = rooms[room];
    const playerNum = gameRoom.addPlayer(socket.id);
    if (!playerNum) return cb && cb({ ok: false, error: 'Room full' });
    
    socket.join(room);
    console.log('joined', socket.id, 'as P' + playerNum, 'room', room);
    const roomState = getRoomState(room);
    console.log('Broadcasting room state after join:', roomState); // Debug log
    io.to(room).emit('roomUpdate', roomState);
    cb && cb({ ok: true, player: playerNum });
  });

  socket.on('startGame', ({ room, mode, winScore }) => {
    if (!rooms[room]) return;
    const gameRoom = rooms[room];
    gameRoom.startGame(mode || 2, winScore || 5);
    io.to(room).emit('startGame', { mode: mode || 2, winScore: winScore || 5 });
    
    // Send game state at 60 FPS for ultra-responsive controls
    const stateInterval = setInterval(() => {
      if (!rooms[room] || (!gameRoom.gameState.running && !gameRoom.gameState.countdownActive)) {
        clearInterval(stateInterval);
        return;
      }
      io.to(room).emit('gameState', gameRoom.gameState);
    }, 1000 / 60);
  });

  socket.on('input', ({ room, position }) => {
    if (!rooms[room]) return;
    const gameRoom = rooms[room];
    if (gameRoom.inputBuffer[socket.id] !== undefined) {
      gameRoom.inputBuffer[socket.id].position = position;
      gameRoom.inputBuffer[socket.id].lastUpdate = Date.now();
    }
  });

  socket.on('playerReady', ({ room, player }) => {
    if (!rooms[room]) return;
    const gameRoom = rooms[room];
    console.log(`Player ${player} marked as ready in room ${room}`); // Debug log
    gameRoom.setPlayerReady(player);
    const roomState = getRoomState(room);
    console.log('Broadcasting room state after ready:', roomState); // Debug log
    io.to(room).emit('roomUpdate', roomState);
  });

  socket.on('disconnect', () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      if (!room) continue;
      room.removePlayer(socket.id);
      io.to(code).emit('roomUpdate', getRoomState(code));
      
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
    readyStates: r.readyStates.slice(),
    playerSockets: r.slots.slice()
  };
}

http.listen(PORT, () => console.log('Optimized server running on', PORT));