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
let animationId = null;

// Player Colors
const playerColors = {
  1: '#ff3b3b',
  2: '#ffffff', 
  3: '#ffd700',
  4: '#00bfff'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupModeButtons();
  setupSocketListeners();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
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
    });
  });
}

// Room Management
createRoomBtn.addEventListener('click', () => {
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
}

startGameBtn.addEventListener('click', () => {
  if (!currentRoom) return;
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
    gameState = state;
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
    
    // Draw paddle with player color
    ctx.fillStyle = playerColors[playerNum];
    ctx.fillRect(
      paddle.x - paddle.w/2, 
      paddle.y - paddle.h/2, 
      paddle.w, 
      paddle.h
    );
    
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
  
  // Draw power-up box
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(
    powerUp.x - powerUp.size,
    powerUp.y - powerUp.size,
    powerUp.size * 2,
    powerUp.size * 2
  );
  
  // Draw question mark
  ctx.fillStyle = '#0a0a0f';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', powerUp.x, powerUp.y);
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
  
  // Draw timer
  ctx.fillStyle = playerColor;
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`POWER: ${timeLeft}s`, 640, 360);
  
  // Draw timer bar
  const barWidth = (timeLeft / 10) * 200;
  ctx.fillStyle = playerColor;
  ctx.fillRect(540, 380, barWidth, 10);
  ctx.strokeStyle = playerColor;
  ctx.strokeRect(540, 380, 200, 10);
}