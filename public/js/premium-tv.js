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
  
  // Initialize player count display
  updatePlayerCountDisplay(0);
  
  // Fix button width to prevent layout shifts
  fixCreateButtonWidth();
  
  // Initialize audio on first user interaction
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });
});

function fixCreateButtonWidth() {
  // Set button width based on the longer text to prevent layout shifts
  const createRoomBtn = document.getElementById('createRoom');
  if (createRoomBtn) {
    // Temporarily set to longer text to measure width
    const originalText = createRoomBtn.textContent;
    createRoomBtn.textContent = 'CREATE NEW ROOM';
    const width = createRoomBtn.offsetWidth;
    
    // Restore original text and set fixed width
    createRoomBtn.textContent = originalText;
    createRoomBtn.style.width = width + 'px';
    createRoomBtn.style.minWidth = width + 'px';
  }
}

function updatePlayerCountDisplay(count) {
  const playerCountEl = document.getElementById('playerCount');
  if (playerCountEl) {
    playerCountEl.textContent = `${count} / 5`;
    
    // Change styling based on mode
    if (count === 5) {
      playerCountEl.style.color = '#ffd700';
      playerCountEl.style.borderColor = 'rgba(255, 215, 0, 0.3)';
      playerCountEl.style.background = 'rgba(255, 215, 0, 0.1)';
    } else {
      playerCountEl.style.color = 'var(--accent-red)';
      playerCountEl.style.borderColor = 'rgba(255, 59, 59, 0.2)';
      playerCountEl.style.background = 'rgba(255, 59, 59, 0.1)';
    }
  }
}

function resizeCanvas() {
  // Use square canvas for 3+ player modes, widescreen for 2 player
  if (gameMode >= 3) {
    canvas.width = 800;
    canvas.height = 800;
  } else {
    canvas.width = 1280;
    canvas.height = 720;
  }
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

// Score Selection (Mode selection removed - auto-adapts to player count)
function setupModeButtons() {
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
  
  // If this is creating a new room (not the first room)
  if (createRoomBtn.textContent === 'CREATE NEW ROOM') {
    // Reset the interface first
    resetRoomInterface();
    // Reset the unlock state for pentagon mode
    pentagonModeUnlocked = false;
    // Reset current room to force new room creation
    currentRoom = null;
  }
  
  socket.emit('createRoom', (res) => {
    currentRoom = res.room;
    roomCodeEl.textContent = res.room;
    generateQR(res.room);
    
    // Change button text after first room creation
    createRoomBtn.textContent = 'CREATE NEW ROOM';
    createRoomBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    createRoomBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
  });
});

function resetRoomInterface() {
  // Reset player count display
  updatePlayerCountDisplay(0);
  
  // Reset start button
  startGameBtn.disabled = true;
  startGameBtn.textContent = 'WAITING FOR PLAYERS...';
  
  // Reset player cards to default state
  for (let i = 1; i <= 5; i++) {
    const card = document.querySelector(`.player-card[data-player="${i}"]`);
    const status = card.querySelector('.player-status');
    if (card && status) {
      card.classList.remove('connected', 'ready');
      status.textContent = '⭕';
    }
  }
  
  // Hide 5th player card and reset grid styling
  const player5Card = document.getElementById('player5Card');
  const playersGrid = document.querySelector('.players-grid');
  player5Card.classList.add('hidden');
  playersGrid.classList.remove('five-players', 'pentagon-mode');
  
  // Hide QR code and show placeholder
  qrImg.classList.add('hidden');
  document.getElementById('qrPlaceholder').style.display = 'flex';
  
  // Reset room code
  roomCodeEl.textContent = '------';
}

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
  
  // Use the auto-determined game mode based on connected players
  socket.emit('startGame', { room: currentRoom, mode: gameMode, winScore: winScore });
  console.log('Starting game with mode:', gameMode, 'players'); // Debug log
});

// Socket Listeners
function setupSocketListeners() {
  socket.on('roomUpdate', (data) => {
    console.log('Room update received:', data); // Debug log
    if (!data) return;
    updatePlayerStatus(data.slots, data.readyStates);
  });

  socket.on('startGame', ({ mode }) => {
    gameMode = mode;
    furEliseIndex = 0; // Reset Für Elise sequence for new game
    
    // Resize canvas for the new game mode
    resizeCanvas();
    
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

// Global variable to track if pentagon mode was already unlocked
let pentagonModeUnlocked = false;

function triggerPentagonUnlock() {
  // Play victory sound sequence
  playSound(523, 0.2, 0.1, 'sine'); // C5
  setTimeout(() => playSound(659, 0.2, 0.1, 'sine'), 200); // E5
  setTimeout(() => playSound(784, 0.2, 0.1, 'sine'), 400); // G5
  setTimeout(() => playSound(1047, 0.4, 0.12, 'sine'), 600); // C6 - victory note
  
  // Show unlock message
  showPentagonUnlockMessage();
}

function showPentagonUnlockMessage() {
  // Create unlock overlay
  const unlockOverlay = document.createElement('div');
  unlockOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.5s ease-in;
  `;
  
  unlockOverlay.innerHTML = `
    <div style="
      text-align: center;
      color: #ffd700;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: unlockPulse 2s ease-in-out;
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">🌟</div>
      <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px; text-shadow: 0 0 20px #ffd700;">
        SPECIAL MODE UNLOCKED!
      </div>
      <div style="font-size: 18px; opacity: 0.9;">
        Pentagon Mode Activated
      </div>
    </div>
    <style>
      @keyframes fadeIn {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes unlockPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    </style>
  `;
  
  document.body.appendChild(unlockOverlay);
  
  // Remove overlay after 3 seconds
  setTimeout(() => {
    unlockOverlay.style.animation = 'fadeIn 0.5s ease-out reverse';
    setTimeout(() => {
      if (unlockOverlay.parentNode) {
        unlockOverlay.parentNode.removeChild(unlockOverlay);
      }
    }, 500);
  }, 3000);
}

function updatePlayerStatus(slots, readyStates = []) {
  let connectedCount = 0;
  let readyCount = 0;
  
  // Track previous connected count for join sound
  const previousConnectedCount = window.previousConnectedCount || 0;
  
  // Show/hide 5th player card based on whether we have 5 slots
  const player5Card = document.getElementById('player5Card');
  const playersGrid = document.querySelector('.players-grid');
  
  if (slots.length >= 5) {
    player5Card.classList.remove('hidden');
    playersGrid.classList.add('five-players');
  } else {
    player5Card.classList.add('hidden');
    playersGrid.classList.remove('five-players');
  }
  
  slots.forEach((connected, i) => {
    const card = document.querySelector(`.player-card[data-player="${i + 1}"]`);
    if (!card) return; // Skip if card doesn't exist
    
    const status = card.querySelector('.player-status');
    
    if (connected) {
      card.classList.add('connected');
      connectedCount++;
      
      // Check if player is ready
      if (readyStates[i]) {
        card.classList.add('ready');
        status.textContent = '✅'; // Green tick when ready
        readyCount++;
      } else {
        card.classList.remove('ready');
        status.textContent = '🔵'; // Blue circle when connected but not ready
      }
    } else {
      card.classList.remove('connected', 'ready');
      status.textContent = '⭕'; // Red circle when not connected
    }
  });

  // Add golden glow to players grid when 5 players are connected
  if (connectedCount === 5) {
    playersGrid.classList.add('pentagon-mode');
  } else {
    playersGrid.classList.remove('pentagon-mode');
  }

  // Auto-determine game mode based on ready players (not just connected)
  gameMode = Math.max(2, readyCount); // Minimum 2 players, max 5
  
  // Play pop sound when new player joins
  if (connectedCount > previousConnectedCount && previousConnectedCount > 0) {
    playSound(800, 0.1, 0.08, 'sine'); // Small pop sound
  }
  
  // Store current count for next comparison
  window.previousConnectedCount = connectedCount;
  
  // Update player count display
  updatePlayerCountDisplay(connectedCount);
  
  // Trigger pentagon mode unlock if 5 players are ready
  if (readyCount === 5 && !pentagonModeUnlocked) {
    triggerPentagonUnlock();
    pentagonModeUnlocked = true;
  }

  // Enable start button when 2 or more players are READY (not just connected)
  const canStart = readyCount >= 2;
  startGameBtn.disabled = !canStart;
  
  // Update start button text based on ready players
  if (!canStart) {
    if (connectedCount < 2) {
      startGameBtn.textContent = 'WAITING FOR PLAYERS...';
    } else {
      startGameBtn.textContent = `WAITING FOR PLAYERS TO BE READY... (${readyCount}/${connectedCount})`;
    }
  } else {
    if (connectedCount === 5 && readyCount === 5) {
      startGameBtn.textContent = '🌟 START PENTAGON MODE';
    } else {
      startGameBtn.textContent = `START ${readyCount} PLAYER GAME`;
    }
  }
  
  console.log(`Players status: ${connectedCount} connected, ${readyCount} ready, canStart: ${canStart}`); // Debug log
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
      const fieldWidth = currState.fieldWidth || (gameMode >= 3 ? 800 : 1280);
      const fieldHeight = currState.fieldHeight || (gameMode >= 3 ? 800 : 720);
      
      const nearLeftPaddle = currState.ball.x < 100;
      const nearRightPaddle = currState.ball.x > fieldWidth - 100;
      const nearTopPaddle = currState.ball.y < 100;
      const nearBottomPaddle = currState.ball.y > fieldHeight - 100;
      
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
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  // Get field dimensions from game state or use defaults
  const fieldWidth = gameState?.fieldWidth || (gameMode >= 3 ? 800 : 1280);
  const fieldHeight = gameState?.fieldHeight || (gameMode >= 3 ? 800 : 720);
  
  if (gameMode === 5) {
    // Draw pentagon field
    drawPentagon();
  } else {
    // Draw rectangular borders
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, fieldWidth - 20, fieldHeight - 20);
  }
  
  // No center line for cleaner look when power-ups appear
}

function drawPentagon() {
  const centerX = 400;
  const centerY = 400;
  const radius = 350;
  
  ctx.strokeStyle = gameMode === 5 ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 3;
  
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.stroke();
  
  // Add golden glow effect for pentagon
  if (gameMode === 5) {
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
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
    
    ctx.fillStyle = gameMode === 5 ? '#ffd700' : playerColors[playerNum];
    
    // Handle pentagon mode rotation
    if (gameMode === 5 && paddle.angle !== undefined) {
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(paddle.angle);
      ctx.fillRect(-paddle.w/2, -paddle.h/2, paddle.w, paddle.h);
      
      // Add golden glow for pentagon paddles
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.strokeRect(-paddle.w/2, -paddle.h/2, paddle.w, paddle.h);
      
      ctx.restore();
      return; // Skip normal paddle drawing
    }
    
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
  
  // Subtle pulse instead of harsh blinking
  const pulseOpacity = 0.7 + 0.3 * Math.sin(elapsed * 0.008);
  const finalOpacity = timeLeft < 3000 ? pulseOpacity : 1;
  
  // Subtle, professional colors
  let boxColor, symbol, shadowColor;
  if (powerUp.type === 'grow') {
    boxColor = `rgba(46, 204, 113, ${finalOpacity})`; // Subtle green
    shadowColor = 'rgba(46, 204, 113, 0.3)';
    symbol = '+';
  } else if (powerUp.type === 'shrink') {
    boxColor = `rgba(231, 76, 60, ${finalOpacity})`; // Subtle red
    shadowColor = 'rgba(231, 76, 60, 0.3)';
    symbol = '−';
  } else if (powerUp.type === 'split') {
    boxColor = `rgba(155, 89, 182, ${finalOpacity})`; // Subtle purple
    shadowColor = 'rgba(155, 89, 182, 0.3)';
    symbol = '⟐';
  } else {
    boxColor = `rgba(241, 196, 15, ${finalOpacity})`; // Subtle gold
    shadowColor = 'rgba(241, 196, 15, 0.3)';
    symbol = '?';
  }
  
  const size = powerUp.size * 0.8; // Slightly smaller, more elegant
  
  // Draw subtle shadow first
  ctx.save();
  ctx.fillStyle = shadowColor;
  ctx.filter = 'blur(8px)';
  ctx.fillRect(
    powerUp.x - size - 4,
    powerUp.y - size - 4,
    (size * 2) + 8,
    (size * 2) + 8
  );
  ctx.filter = 'none';
  
  // Draw main power-up box with rounded corners effect
  const gradient = ctx.createLinearGradient(
    powerUp.x - size, powerUp.y - size,
    powerUp.x + size, powerUp.y + size
  );
  gradient.addColorStop(0, boxColor);
  gradient.addColorStop(1, boxColor.replace(/[\d\.]+\)/, '0.7)'));
  
  ctx.fillStyle = gradient;
  ctx.fillRect(
    powerUp.x - size,
    powerUp.y - size,
    size * 2,
    size * 2
  );
  
  // Subtle border
  ctx.strokeStyle = `rgba(255, 255, 255, ${finalOpacity * 0.4})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(
    powerUp.x - size,
    powerUp.y - size,
    size * 2,
    size * 2
  );
  
  // Draw symbol with subtle styling
  ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, powerUp.x, powerUp.y);
  
  ctx.restore();
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
  
  // Update speed indicator if it exists
  updateSpeedIndicator();
}

function updateSpeedIndicator() {
  if (!gameState) return;
  
  let speedIndicator = document.getElementById('speedIndicator');
  if (!speedIndicator) {
    // Create speed indicator
    speedIndicator = document.createElement('div');
    speedIndicator.id = 'speedIndicator';
    speedIndicator.style.cssText = `
      position: absolute;
      top: 8px;
      right: 20px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: rgba(0, 0, 0, 0.3);
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    document.getElementById('gameContainer').appendChild(speedIndicator);
  }
  
  if (gameMode === 5) {
    speedIndicator.textContent = '⭐ PENTAGON MODE';
    speedIndicator.style.color = '#ffd700';
    speedIndicator.style.borderColor = 'rgba(255, 215, 0, 0.3)';
  } else if (gameState.speedMultiplier) {
    const speedText = gameState.speedMultiplier.toFixed(1);
    speedIndicator.textContent = `Speed: ${speedText}x`;
    speedIndicator.style.color = 'rgba(255, 255, 255, 0.6)';
    speedIndicator.style.borderColor = 'rgba(255, 255, 255, 0.1)';
  }
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
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  ctx.fillText(`P${gameState.activePowerUp.player} ${powerName}: ${timeLeft}s`, centerX, centerY - 20);
  
  // Draw timer bar with better styling
  const barWidth = (timeLeft / 10) * 200;
  const barX = centerX - 100;
  const barY = centerY + 5;
  
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
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw countdown number
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
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