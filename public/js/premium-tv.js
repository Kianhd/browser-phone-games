// Premium TV Display with Advanced Graphics
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

// Game State
let currentRoom = null;
let gameMode = 2;
let gameState = null;
let animationId = null;
let particles = [];

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
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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

// Game Rendering
function startRenderLoop() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(render);
}

function render() {
  if (!gameState) {
    animationId = requestAnimationFrame(render);
    return;
  }

  // Clear canvas with trail effect
  ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw game elements
  drawField();
  drawPaddles();
  drawBall();
  drawParticles();
  updateLocalParticles();

  animationId = requestAnimationFrame(render);
}

function drawField() {
  // Center line with glow
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  
  if (gameMode >= 2) {
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
  }
  
  if (gameMode >= 3) {
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
  }
  
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPaddles() {
  if (!gameState.paddles) return;

  Object.keys(gameState.paddles).forEach(key => {
    const paddle = gameState.paddles[key];
    const playerNum = parseInt(key);
    
    if (playerNum > gameMode) return;
    
    // Scale positions to canvas size
    const x = (paddle.x / 1280) * canvas.width;
    const y = (paddle.y / 720) * canvas.height;
    const w = (paddle.w / 1280) * canvas.width;
    const h = (paddle.h / 720) * canvas.height;
    
    // Draw paddle glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h));
    gradient.addColorStop(0, hexToRgba(playerColors[playerNum], 0.3));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - w, y - h, w * 2, h * 2);
    
    // Draw paddle
    ctx.fillStyle = playerColors[playerNum];
    ctx.fillRect(x - w/2, y - h/2, w, h);
    
    // Add glass effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x - w/2, y - h/2, w, h/3);
  });
}

function drawBall() {
  if (!gameState.ball) return;
  
  const ball = gameState.ball;
  const x = (ball.x / 1280) * canvas.width;
  const y = (ball.y / 720) * canvas.height;
  const radius = 12;
  
  // Draw trail
  if (ball.trail) {
    ball.trail.forEach((point, i) => {
      const px = (point.x / 1280) * canvas.width;
      const py = (point.y / 720) * canvas.height;
      const alpha = (i / ball.trail.length) * 0.5;
      
      ctx.beginPath();
      ctx.arc(px, py, radius * (i / ball.trail.length), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    });
  }
  
  // Draw ball glow
  const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
  glowGradient.addColorStop(0, 'rgba(255, 59, 59, 0.4)');
  glowGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw ball
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner glow
  const innerGradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
  innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
  ctx.fillStyle = innerGradient;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  if (!gameState.particles) return;
  
  gameState.particles.forEach(p => {
    const x = (p.x / 1280) * canvas.width;
    const y = (p.y / 720) * canvas.height;
    
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function updateLocalParticles() {
  // Add ambient particles
  if (Math.random() < 0.02) {
    particles.push({
      x: Math.random() * canvas.width,
      y: canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -Math.random() * 2 - 1,
      size: Math.random() * 3 + 1,
      alpha: 0.5,
      color: hexToRgba('#ff3b3b', 0.3)
    });
  }
  
  // Update and draw local particles
  particles = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.01;
    p.size *= 0.99;
    
    if (p.alpha > 0) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    }
    return false;
  });
}

// Utility Functions
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}