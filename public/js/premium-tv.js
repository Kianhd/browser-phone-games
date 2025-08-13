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
let winScore = 5;
let gameState = null;
let previousGameState = null;
let animationId = null;
let countdownActive = false;
let countdownNumber = null;

// Interpolation for smooth paddle movement
let interpolatedPaddles = {};
let lastUpdateTime = Date.now();

// Für Elise note sequence
let furEliseIndex = 0;
// Notes: E5, D#5, E5, D#5, E5, B4, D5, C5, A4... (continuing the famous melody)
const furEliseNotes = [
  659.25, 622.25, 659.25, 622.25, 659.25, 493.88, 587.33, 523.25, 440.00, // Opening phrase
  261.63, 329.63, 440.00, 493.88, // Continuation
  329.63, 415.30, 493.88, 523.25, // Bridge
  329.63, 659.25, 622.25, 659.25, 622.25, 659.25, 493.88, 587.33, 523.25, 440.00, // Repeat
  261.63, 329.63, 440.00, 493.88, // Continuation
  329.63, 523.25, 493.88, 440.00, // Ending phrase
  493.88, // Final note before loop
];

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

// Piano-like sound for Für Elise notes
function playPianoNote(frequency) {
  if (!audioContext || !soundEnabled) return;
  
  // Create multiple oscillators for richer piano sound
  const fundamental = audioContext.createOscillator();
  const overtone1 = audioContext.createOscillator();
  const overtone2 = audioContext.createOscillator();
  
  const gainNode = audioContext.createGain();
  const gainNode2 = audioContext.createGain();
  const gainNode3 = audioContext.createGain();
  
  // Set frequencies (fundamental + overtones for piano timbre)
  fundamental.frequency.value = frequency;
  overtone1.frequency.value = frequency * 2; // First overtone
  overtone2.frequency.value = frequency * 3; // Second overtone
  
  fundamental.type = 'sine';
  overtone1.type = 'sine';
  overtone2.type = 'sine';
  
  // Connect oscillators
  fundamental.connect(gainNode);
  overtone1.connect(gainNode2);
  overtone2.connect(gainNode3);
  
  gainNode.connect(audioContext.destination);
  gainNode2.connect(audioContext.destination);
  gainNode3.connect(audioContext.destination);
  
  // Piano-like envelope (quick attack, gradual decay)
  const now = audioContext.currentTime;
  const duration = 0.8;
  
  // Fundamental
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02); // Quick attack
  gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.1); // Quick decay to sustain
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Gradual release
  
  // Overtones (quieter)
  gainNode2.gain.setValueAtTime(0, now);
  gainNode2.gain.linearRampToValueAtTime(0.05, now + 0.02);
  gainNode2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6);
  
  gainNode3.gain.setValueAtTime(0, now);
  gainNode3.gain.linearRampToValueAtTime(0.02, now + 0.02);
  gainNode3.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.4);
  
  // Start and stop oscillators
  fundamental.start(now);
  overtone1.start(now);
  overtone2.start(now);
  
  fundamental.stop(now + duration);
  overtone1.stop(now + duration);
  overtone2.stop(now + duration);
}

// Sound effects
const sounds = {
  paddleHit: () => {
    // Play the next note in Für Elise sequence
    const note = furEliseNotes[furEliseIndex % furEliseNotes.length];
    playPianoNote(note);
    furEliseIndex++;
  },
  wallHit: () => playSound(150, 0.15, 0.1, 'sawtooth'),
  powerUpSpawn: () => playSound(440, 0.2, 0.06, 'triangle'),
  powerUpCollect: () => playSound(660, 0.3, 0.08, 'sine'),
  score: () => playSound(330, 0.4, 0.1, 'triangle'),
  countdown: () => playSound(440, 0.3, 0.1, 'triangle'),
  countdownFinal: () => playSound(660, 0.5, 0.12, 'sine'),
  gameStart: () => {
    // Reset Für Elise sequence at game start
    furEliseIndex = 0;
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

  // Score selection
  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.score-btn.active').classList.remove('active');
      btn.classList.add('active');
      winScore = parseInt(btn.dataset.score);
      playSound(528, 0.1, 0.05, 'triangle'); // Different sound for score selection
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
  socket.emit('startGame', { room: currentRoom, mode: gameMode, winScore: winScore });
});

// Socket Listeners
function setupSocketListeners() {
  socket.on('roomUpdate', (data) => {
    if (!data) return;
    updatePlayerStatus(data.slots);
  });

  socket.on('startGame', ({ mode }) => {
    gameMode = mode;
    furEliseIndex = 0; // Reset Für Elise sequence for new game
    menuPanel.style.display = 'none';
    gameContainer.classList.add('active');
    
    // Show the HTML scoreboard
    document.getElementById('scoreDisplay').style.display = 'flex';
    
    startRenderLoop();
  });

  socket.on('gameState', (state) => {
    previousGameState = gameState;
    gameState = state;
    
    // Set up interpolation targets for smooth paddle movement
    if (gameState && gameState.paddles) {
      const now = Date.now();
      Object.keys(gameState.paddles).forEach(key => {
        const newPaddle = gameState.paddles[key];
        if (!interpolatedPaddles[key]) {
          // First time, set directly
          interpolatedPaddles[key] = { ...newPaddle };
        } else {
          // Store target for interpolation
          interpolatedPaddles[key].targetX = newPaddle.x;
          interpolatedPaddles[key].targetY = newPaddle.y;
          interpolatedPaddles[key].lastUpdate = now;
        }
      });
      lastUpdateTime = now;
    }
    
    // Detect game events and play sounds
    if (previousGameState) {
      detectGameEvents(previousGameState, gameState);
    }
  });

  socket.on('countdownTick', ({ count }) => {
    countdownActive = true;
    countdownNumber = count;
    if (count === 1) {
      sounds.countdownFinal();
    } else {
      sounds.countdown();
    }
  });

  socket.on('countdownComplete', () => {
    countdownActive = false;
    countdownNumber = null;
    playSound(880, 0.4, 0.1, 'sine'); // Game start sound
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
  
  // Detect paddle hits by velocity direction changes
  if (prevState.ball && currState.ball) {
    const vxChanged = Math.sign(prevState.ball.vx) !== Math.sign(currState.ball.vx);
    const vyChanged = Math.sign(prevState.ball.vy) !== Math.sign(currState.ball.vy);
    
    // Check if ball hit a paddle (velocity direction changed)
    if (vxChanged || vyChanged) {
      // Also check if it's not a wall bounce by checking position
      const nearLeftPaddle = currState.ball.x < 100;
      const nearRightPaddle = currState.ball.x > 1180;
      const nearTopPaddle = currState.ball.y < 100;
      const nearBottomPaddle = currState.ball.y > 620;
      
      if (nearLeftPaddle || nearRightPaddle || nearTopPaddle || nearBottomPaddle) {
        sounds.paddleHit();
      }
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

  // Update interpolations for smooth movement
  updateInterpolation();
  
  // Draw game elements
  drawField();
  drawPaddles();
  drawPowerUp();
  drawBall();
  updateHTMLScoreboard();
  drawPowerUpTimer();
  drawCountdown();

  animationId = requestAnimationFrame(render);
}

// Smooth interpolation for paddle movement
function updateInterpolation() {
  if (!gameState || !gameState.paddles) return;
  
  const now = Date.now();
  const lerpSpeed = 0.3; // Interpolation speed (0 = no movement, 1 = instant)
  
  Object.keys(interpolatedPaddles).forEach(key => {
    const interpolated = interpolatedPaddles[key];
    if (interpolated.targetX !== undefined && interpolated.targetY !== undefined) {
      // Smooth interpolation (lerp) towards target position
      interpolated.x = lerp(interpolated.x, interpolated.targetX, lerpSpeed);
      interpolated.y = lerp(interpolated.y, interpolated.targetY, lerpSpeed);
    }
  });
}

// Linear interpolation helper
function lerp(start, end, factor) {
  return start + (end - start) * factor;
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
    const interpolated = interpolatedPaddles[key];
    const playerNum = parseInt(key);
    
    if (playerNum > gameMode) return;
    
    // Use interpolated position for smooth movement, but original paddle for other properties
    const drawX = interpolated ? interpolated.x : paddle.x;
    const drawY = interpolated ? interpolated.y : paddle.y;
    
    ctx.fillStyle = playerColors[playerNum];
    
    // Draw split paddle or normal paddle
    if (paddle.split && paddle.gapSize > 0) {
      // Draw two parts with gap
      if (paddle.h > paddle.w) {
        // Vertical paddle split
        const gapHalf = paddle.gapSize / 2;
        // Top part
        ctx.fillRect(
          drawX - paddle.w/2,
          drawY - paddle.h/2,
          paddle.w,
          (paddle.h/2) - gapHalf
        );
        // Bottom part
        ctx.fillRect(
          drawX - paddle.w/2,
          drawY + gapHalf,
          paddle.w,
          (paddle.h/2) - gapHalf
        );
      } else {
        // Horizontal paddle split
        const gapHalf = paddle.gapSize / 2;
        // Left part
        ctx.fillRect(
          drawX - paddle.w/2,
          drawY - paddle.h/2,
          (paddle.w/2) - gapHalf,
          paddle.h
        );
        // Right part
        ctx.fillRect(
          drawX + gapHalf,
          drawY - paddle.h/2,
          (paddle.w/2) - gapHalf,
          paddle.h
        );
      }
    } else {
      // Draw normal paddle
      ctx.fillRect(
        drawX - paddle.w/2, 
        drawY - paddle.h/2, 
        paddle.w, 
        paddle.h
      );
    }
    
    // Add glow effect for powered-up paddle
    if (gameState.activePowerUp && gameState.activePowerUp.player === playerNum) {
      ctx.strokeStyle = playerColors[playerNum];
      ctx.lineWidth = 3;
      ctx.strokeRect(
        drawX - paddle.w/2 - 5, 
        drawY - paddle.h/2 - 5, 
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

function updateHTMLScoreboard() {
  if (!gameState) return;
  
  const scoreItems = document.querySelectorAll('.score-item');
  
  // Update scores and show/hide based on game mode
  scoreItems.forEach((item, index) => {
    const playerNum = index + 1;
    
    if (playerNum <= gameMode) {
      // Show this player's score
      item.style.display = 'block';
      item.textContent = gameState.scores[index];
    } else {
      // Hide unused players
      item.style.display = 'none';
    }
  });
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

function drawCountdown() {
  if (!countdownActive || countdownNumber === null) return;
  
  // Create pulsing effect
  const pulseScale = 1 + Math.sin(Date.now() * 0.01) * 0.1;
  
  // Draw countdown background overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, 1280, 720);
  
  // Draw countdown number
  ctx.save();
  ctx.translate(640, 360);
  ctx.scale(pulseScale, pulseScale);
  
  if (countdownNumber === 0) {
    // Show "GO!" instead of 0
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GO!', 0, 0);
    
    // Add glow effect
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 40;
    ctx.fillText('GO!', 0, 0);
    ctx.shadowBlur = 0;
  } else {
    // Show countdown number
    ctx.fillStyle = countdownNumber === 1 ? '#ff3b3b' : '#ffffff';
    ctx.font = 'bold 200px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countdownNumber.toString(), 0, 0);
    
    // Add glow effect
    ctx.shadowColor = countdownNumber === 1 ? '#ff3b3b' : '#ffffff';
    ctx.shadowBlur = 50;
    ctx.fillText(countdownNumber.toString(), 0, 0);
    ctx.shadowBlur = 0;
  }
  
  ctx.restore();
}