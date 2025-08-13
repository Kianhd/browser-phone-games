// Optimized TV Display with Power-ups
const socket = io();

// DOM Elements
const menuPanel = document.getElementById('menuPanel');
const gameContainer = document.getElementById('gameContainer');
const roomCodeEl = document.getElementById('roomCode');
const qrImg = document.getElementById('qrImg');
const createRoomBtn = document.getElementById('createRoom');
const startGameBtn = document.getElementById('startGame');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Optimize canvas
ctx.imageSmoothingEnabled = false;

// Game State
let currentRoom = null;
let gameMode = 2;
let gameState = null;
let previousGameState = null;
let animationId = null;

// Player Colors
const playerColors = {
  1: '#ff3b3b',
  2: '#ffffff', 
  3: '#ffd700',
  4: '#00bfff'
};

// Sound System
let audioContext = null;
const soundEnabled = true;

function initAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.log('Web Audio API not supported');
  }
}

function playSound(frequency, duration, volume = 0.1, type = 'sine') {
  if (!audioContext || !soundEnabled) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Sound effects
const sounds = {
  paddleHit: () => playSound(220, 0.1, 0.08, 'square'),
  wallHit: () => playSound(150, 0.15, 0.1, 'sawtooth'),
  powerUpSpawn: () => playSound(440, 0.2, 0.06, 'triangle'),
  powerUpCollect: () => playSound(660, 0.3, 0.08, 'sine'),
  score: () => playSound(330, 0.4, 0.1, 'triangle'),
  gameStart: () => {
    playSound(262, 0.15, 0.06, 'square');
    setTimeout(() => playSound(330, 0.15, 0.06, 'square'), 150);
    setTimeout(() => playSound(392, 0.25, 0.08, 'square'), 300);
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupModeButtons();
  setupSocketListeners();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Initialize audio on first user interaction
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });
});

function resizeCanvas() {
  canvas.width = 1280;
  canvas.height = 720;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

// Mode Selection
function setupModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.mode-btn.active').classList.remove('active');
      btn.classList.add('active');
      gameMode = parseInt(btn.dataset.mode);
      playSound(440, 0.1, 0.05, 'sine'); // Subtle click sound
    });
  });
}

// Room Management
createRoomBtn.addEventListener('click', () => {
  playSound(528, 0.15, 0.06, 'triangle'); // Room creation sound
  socket.emit('createRoom', (res) => {
    currentRoom = res.room;
    roomCodeEl.textContent = res.room;
    generateQR(res.room);
    createRoomBtn.style.display = 'none';
  });
});

function generateQR(code) {
  const url = `${location.origin}/controller.html?r=${code}`;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0a0a0f`;
  
  // Show QR code and hide placeholder
  qrImg.classList.remove('hidden');
  document.getElementById('qrPlaceholder').style.display = 'none';
}

startGameBtn.addEventListener('click', () => {
  if (!currentRoom) return;
  sounds.gameStart(); // Multi-note game start sound
  socket.emit('startGame', { room: currentRoom, mode: gameMode });
});

// Socket Listeners
function setupSocketListeners() {
  socket.on('roomUpdate', (data) => {
    if (!data) return;
    updatePlayerStatus(data.slots);
  });

  socket.on('startGame', ({ mode }) => {
    gameMode = mode;
    menuPanel.style.display = 'none';
    gameContainer.classList.add('active');
    startRenderLoop();
  });

  socket.on('gameState', (state) => {
    previousGameState = gameState;
    gameState = state;
    
    // Detect game events and play sounds
    if (previousGameState) {
      detectGameEvents(previousGameState, gameState);
    }
  });

  socket.on('gameOver', ({ winner }) => {
    setTimeout(() => {
      alert(`Player ${winner} Wins! 🏆`);
      location.reload();
    }, 1000);
  });
}

function updatePlayerStatus(slots) {
  let connectedCount = 0;
  slots.forEach((connected, i) => {
    const card = document.querySelector(`.player-card[data-player="${i + 1}"]`);
    const status = card.querySelector('.player-status');
    
    if (connected) {
      card.classList.add('connected');
      status.textContent = '✅';
      connectedCount++;
    } else {
      card.classList.remove('connected');
      status.textContent = '⭕';
    }
  });

  startGameBtn.disabled = connectedCount < 2;
}

function detectGameEvents(prevState, currState) {
  // Detect score changes (wall hits)
  for (let i = 0; i < currState.scores.length; i++) {
    if (currState.scores[i] > prevState.scores[i]) {
      sounds.score();
      break;
    }
  }
  
  // Detect power-up spawn
  if (!prevState.powerUp && currState.powerUp) {
    sounds.powerUpSpawn();
  }
  
  // Detect power-up collection
  if (prevState.powerUp && !currState.powerUp && currState.activePowerUp) {
    sounds.powerUpCollect();
  }
  
  // Detect ball speed changes (paddle hits)
  if (prevState.ball && currState.ball) {
    const prevSpeed = Math.sqrt(prevState.ball.vx * prevState.ball.vx + prevState.ball.vy * prevState.ball.vy);
    const currSpeed = Math.sqrt(currState.ball.vx * currState.ball.vx + currState.ball.vy * currState.ball.vy);
    
    if (currSpeed > prevSpeed + 0.5) {
      sounds.paddleHit();
    }
  }
}

// Optimized Game Rendering
function startRenderLoop() {
  if (animationId) cancelAnimationFrame(animationId);
  render();
}

function render() {
  if (!gameState) {
    animationId = requestAnimationFrame(render);
    return;
  }

  // Clear canvas
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, 1280, 720);

  // Draw game elements
  drawField();
  drawPaddles();
  drawPowerUp();
  drawBall();
  drawScores();
  drawPowerUpTimer();

  animationId = requestAnimationFrame(render);
}

function drawField() {
  // Draw borders
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 1260, 700);
  
  // Center lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(640, 10);
  ctx.lineTo(640, 710);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPaddles() {
  if (!gameState.paddles) return;

  Object.keys(gameState.paddles).forEach(key => {
    const paddle = gameState.paddles[key];
    const playerNum = parseInt(key);
    
    if (playerNum > gameMode) return;
    
    ctx.fillStyle = playerColors[playerNum];
    
    // Draw split paddle or normal paddle
    if (paddle.split && paddle.gapSize > 0) {
      // Draw two parts with gap
      if (paddle.h > paddle.w) {
        // Vertical paddle split
        const gapHalf = paddle.gapSize / 2;
        // Top part
        ctx.fillRect(
          paddle.x - paddle.w/2,
          paddle.y - paddle.h/2,
          paddle.w,
          (paddle.h/2) - gapHalf
        );
        // Bottom part
        ctx.fillRect(
          paddle.x - paddle.w/2,
          paddle.y + gapHalf,
          paddle.w,
          (paddle.h/2) - gapHalf
        );
      } else {
        // Horizontal paddle split
        const gapHalf = paddle.gapSize / 2;
        // Left part
        ctx.fillRect(
          paddle.x - paddle.w/2,
          paddle.y - paddle.h/2,
          (paddle.w/2) - gapHalf,
          paddle.h
        );
        // Right part
        ctx.fillRect(
          paddle.x + gapHalf,
          paddle.y - paddle.h/2,
          (paddle.w/2) - gapHalf,
          paddle.h
        );
      }
    } else {
      // Draw normal paddle
      ctx.fillRect(
        paddle.x - paddle.w/2, 
        paddle.y - paddle.h/2, 
        paddle.w, 
        paddle.h
      );
    }
    
    // Add glow effect for powered-up paddle
    if (gameState.activePowerUp && gameState.activePowerUp.player === playerNum) {
      ctx.strokeStyle = playerColors[playerNum];
      ctx.lineWidth = 3;
      ctx.strokeRect(
        paddle.x - paddle.w/2 - 5, 
        paddle.y - paddle.h/2 - 5, 
        paddle.w + 10, 
        paddle.h + 10
      );
    }
  });
}

function drawBall() {
  if (!gameState.ball) return;
  
  const ball = gameState.ball;
  
  // Draw ball
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
  ctx.fill();
  
  // Add glow
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPowerUp() {
  if (!gameState.powerUp) return;
  
  const powerUp = gameState.powerUp;
  const elapsed = Date.now() - powerUp.spawnTime;
  const timeLeft = 10000 - elapsed;
  
  // Blink in last 3 seconds
  if (timeLeft < 3000 && Math.floor(timeLeft / 200) % 2 === 0) {
    return;
  }
  
  // Different colors for different power-up types
  let boxColor, symbol;
  if (powerUp.type === 'grow') {
    boxColor = '#00ff00'; // Green for grow
    symbol = '+';
  } else if (powerUp.type === 'shrink') {
    boxColor = '#ff4444'; // Red for shrink
    symbol = '-';
  } else if (powerUp.type === 'split') {
    boxColor = '#9d4edd'; // Purple for split
    symbol = '÷';
  } else {
    boxColor = '#ffd700'; // Gold default
    symbol = '?';
  }
  
  // Draw power-up box
  ctx.fillStyle = boxColor;
  ctx.fillRect(
    powerUp.x - powerUp.size,
    powerUp.y - powerUp.size,
    powerUp.size * 2,
    powerUp.size * 2
  );
  
  // Add glow effect
  ctx.strokeStyle = boxColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, powerUp.x, powerUp.y);
}

function drawScores() {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  
  // Draw scores based on mode
  if (gameMode >= 2) {
    // Player 1 score (left)
    ctx.fillStyle = playerColors[1];
    ctx.fillText(gameState.scores[0], 320, 60);
    
    // Player 2 score (right)
    ctx.fillStyle = playerColors[2];
    ctx.fillText(gameState.scores[1], 960, 60);
  }
  
  if (gameMode >= 3) {
    // Player 3 score (top)
    ctx.fillStyle = playerColors[3];
    ctx.fillText(gameState.scores[2], 640, 60);
  }
  
  if (gameMode >= 4) {
    // Player 4 score (bottom)
    ctx.fillStyle = playerColors[4];
    ctx.fillText(gameState.scores[3], 640, 680);
  }
  
  // Win score indicator
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '20px Arial';
  ctx.fillText(`First to ${gameState.winScore}`, 640, 30);
}

function drawPowerUpTimer() {
  if (!gameState.activePowerUp) return;
  
  const elapsed = Date.now() - gameState.activePowerUp.startTime;
  const timeLeft = Math.max(0, 10 - Math.floor(elapsed / 1000));
  const playerColor = playerColors[gameState.activePowerUp.player];
  const powerType = gameState.activePowerUp.type || 'grow';
  
  // Get power-up name
  let powerName = 'POWER';
  if (powerType === 'grow') powerName = 'GROW';
  else if (powerType === 'shrink') powerName = 'SHRINK';
  else if (powerType === 'split') powerName = 'SPLIT';
  
  // Draw timer with power-up type
  ctx.fillStyle = playerColor;
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`P${gameState.activePowerUp.player} ${powerName}: ${timeLeft}s`, 640, 340);
  
  // Draw timer bar with better styling
  const barWidth = (timeLeft / 10) * 200;
  const barX = 540;
  const barY = 355;
  
  // Background bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(barX, barY, 200, 12);
  
  // Active bar
  ctx.fillStyle = playerColor;
  ctx.fillRect(barX, barY, barWidth, 12);
  
  // Border
  ctx.strokeStyle = playerColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, 200, 12);
}