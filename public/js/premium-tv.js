// BeanPong TV Display with Power-ups
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

// Load kidney bean ball image
const ballImage = new Image();
ballImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xNzYgMTI4QzEwNC4zIDEyOCA0NiAxODYuMyA0NiAyNThDNDYgMzI5LjcgMTA0LjMgMzg4IDE3NiAzODhIMzM2QzQwNy43IDM4OCA0NjYgMzI5LjcgNDY2IDI1OEM0NjYgMTg2LjMgNDA3LjcgMTI4IDMzNiAxMjhIMTc2WiIgZmlsbD0iIzlCNEY5NiIvPgo8cGF0aCBkPSJNMTc2IDEyOEM5MS4xIDEyOCAyMCAxOTkuMSAyMCAyODRDMjAgMzY4LjkgOTEuMSA0NDAgMTc2IDQ0MEgzMzZDNDIwLjkgNDQwIDQ5MiAzNjguOSA0OTIgMjg0QzQ5MiAxOTkuMSA0MjAuOSAxMjggMzM2IDEyOEgxNzZaIiBmaWxsPSIjQzQ1QjVDIi8+CjxwYXRoIGQ9Ik0zMjAgMTYwQzMzNi40IDE2MCAzNTIgMTc1LjYgMzUyIDE5MkMzNTIgMjA4LjQgMzM2LjQgMjI0IDMyMCAyMjRDMzAzLjYgMjI0IDI4OCAyMDguNCAyODggMTkyQzI4OCAxNzUuNiAzMDMuNiAxNjAgMzIwIDE2MFoiIGZpbGw9IiNGRkZGRkYiIGZpbGwtb3BhY2l0eT0iMC4zIi8+CjxwYXRoIGQ9Ik0xOTIgMTc2QzE5Mi4yIDE4MS40IDE5Ni42IDE4NS44IDIwMiAxODZDMjA3LjQgMTg1LjggMjExLjggMTgxLjQgMjEyIDE3NkMyMTEuOCAxNzAuNiAyMDcuNCAxNjYuMiAyMDIgMTY2QzE5Ni42IDE2Ni4yIDE5Mi4yIDE3MC42IDE5MiAxNzZaIiBmaWxsPSIjRkZGRkZGIi8+CjxwYXRoIGQ9Ik0yODAgMjQwQzMwMS42IDI0MCAzMjAgMjU4LjQgMzIwIDI4MEMzMjAgMzAxLjYgMzAxLjYgMzIwIDI4MCAzMjBDMjU4LjQgMzIwIDI0MCAzMDEuNiAyNDAgMjgwQzI4MCAyNTguNCAyNTguNCAyNDAgMjgwIDI0MFoiIGZpbGw9IiNGRkQ3MDAiLz4KPC9zdmc+Cg==';
let ballImageLoaded = false;
ballImage.onload = () => {
  ballImageLoaded = true;
  console.log('Ball image loaded successfully');
};
ballImage.onerror = () => {
  console.warn('Ball image failed to load, using fallback shapes');
};

// Load plate image for paddles
const plateImage = new Image();
plateImage.src = '/Plate.png'; // Use the actual image file
let plateImageLoaded = false;
plateImage.onload = () => plateImageLoaded = true;

// Interpolation for smooth paddle movement
let interpolatedPaddles = {};
let lastUpdateTime = Date.now();

// Plate impact physics system
let plateImpacts = {}; // Track impact animations for each paddle

// Trigger subtle plate impact animation
function triggerPlateImpact(playerNum, impactVelocity) {
  plateImpacts[playerNum] = {
    startTime: Date.now(),
    pushDistance: Math.min(impactVelocity * 0.3, 8), // Max 8px push
    duration: 150, // Very quick 150ms animation
    direction: Math.random() * Math.PI * 2 // Random subtle direction
  };
}

// Update plate impact animations
function updatePlateImpacts() {
  const currentTime = Date.now();
  Object.keys(plateImpacts).forEach(playerNum => {
    const impact = plateImpacts[playerNum];
    const elapsed = currentTime - impact.startTime;
    
    if (elapsed > impact.duration) {
      delete plateImpacts[playerNum]; // Animation finished
    } else {
      // Spring physics for natural movement
      const progress = elapsed / impact.duration;
      const springBack = 1 - Math.pow(progress - 1, 2); // Easing out
      impact.currentPush = impact.pushDistance * springBack;
    }
  });
}

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

async function initAudio() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume the audio context if it's suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Test audio with a very quiet sound to ensure it's working
    if (audioContext.state === 'running') {
      const testOsc = audioContext.createOscillator();
      const testGain = audioContext.createGain();
      testOsc.connect(testGain);
      testGain.connect(audioContext.destination);
      testGain.gain.setValueAtTime(0.001, audioContext.currentTime); // Very quiet
      testOsc.frequency.value = 440;
      testOsc.start(audioContext.currentTime);
      testOsc.stop(audioContext.currentTime + 0.01);
    }
  } catch (e) {
    console.log('Web Audio API not supported or failed to initialize:', e);
  }
}

async function playSound(frequency, duration, volume = 0.1, type = 'sine') {
  if (!soundEnabled) return;
  
  // Initialize audio if not already done
  if (!audioContext) {
    await initAudio();
  }
  
  // Resume context if suspended
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  
  if (!audioContext || audioContext.state !== 'running') return;
  
  try {
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
  } catch (e) {
    console.log('Failed to play sound:', e);
  }
}

// Piano-like sound for Für Elise notes
async function playPianoNote(frequency) {
  if (!soundEnabled) return;
  
  // Initialize audio if not already done
  if (!audioContext) {
    await initAudio();
  }
  
  // Resume context if suspended
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  
  if (!audioContext || audioContext.state !== 'running') return;
  
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
  },
  // New funny power-up sounds
  drunkBall: () => {
    playSound(200, 0.3, 0.08, 'sine');
    setTimeout(() => playSound(180, 0.2, 0.06, 'sine'), 200);
    setTimeout(() => playSound(220, 0.2, 0.06, 'sine'), 400);
  },
  paddleHiccups: () => playSound(400, 0.1, 0.08, 'square'),
  bigHead: () => {
    playSound(100, 0.4, 0.1, 'sawtooth');
    setTimeout(() => playSound(120, 0.3, 0.08, 'sawtooth'), 200);
  },
  butterfly: () => {
    playSound(800, 0.1, 0.04, 'sine');
    setTimeout(() => playSound(900, 0.1, 0.04, 'sine'), 100);
    setTimeout(() => playSound(700, 0.1, 0.04, 'sine'), 200);
  },
  sneezeAttack: () => playSound(300, 0.2, 0.1, 'noise'),
  echoBall: () => {
    playSound(500, 0.3, 0.06, 'triangle');
    setTimeout(() => playSound(500, 0.2, 0.04, 'triangle'), 200);
    setTimeout(() => playSound(500, 0.1, 0.03, 'triangle'), 400);
  },
  ballTantrum: () => playSound(150, 0.5, 0.12, 'sawtooth'),
  sleepyTime: () => {
    playSound(200, 0.8, 0.06, 'sine');
    setTimeout(() => playSound(180, 0.6, 0.05, 'sine'), 400);
  },
  ballSneeze: () => playSound(600, 0.15, 0.08, 'square'),
  ballExplosion: () => {
    playSound(100, 0.3, 0.15, 'noise');
    setTimeout(() => playSound(80, 0.2, 0.1, 'noise'), 100);
  },
  paddleHiccup: () => playSound(350, 0.1, 0.06, 'square')
};

// Background Game Canvas
const backgroundCanvas = document.getElementById('backgroundGameCanvas');
const backgroundCtx = backgroundCanvas.getContext('2d');
let backgroundBalls = [];
let backgroundAnimationId = null;

// Initialize background game
function initBackgroundGame() {
  if (!backgroundCanvas || !backgroundCtx) return;
  
  // Create 5 balls with random properties
  backgroundBalls = [];
  for (let i = 0; i < 5; i++) {
    backgroundBalls.push({
      x: Math.random() * (backgroundCanvas.width - 40) + 20,
      y: Math.random() * (backgroundCanvas.height - 40) + 20,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      radius: 8,
      color: '#ffffff',
      rotation: Math.random() * Math.PI * 2,
      angularVelocity: (Math.random() - 0.5) * 0.1
    });
  }
  
  // Start background animation
  if (backgroundAnimationId) cancelAnimationFrame(backgroundAnimationId);
  animateBackground();
}

function animateBackground() {
  if (!backgroundCtx) return;
  
  // Clear canvas
  backgroundCtx.fillStyle = '#0a0a0f';
  backgroundCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  
  // Update and draw balls
  backgroundBalls.forEach(ball => {
    // Update position
    ball.x += ball.vx;
    ball.y += ball.vy;
    
    // Update rotation
    ball.rotation += ball.angularVelocity;
    
    // Bounce off walls
    if (ball.x <= ball.radius || ball.x >= backgroundCanvas.width - ball.radius) {
      ball.vx *= -1;
      ball.x = Math.max(ball.radius, Math.min(backgroundCanvas.width - ball.radius, ball.x));
      // Add slight rotation change on bounce
      ball.angularVelocity += (Math.random() - 0.5) * 0.02;
    }
    if (ball.y <= ball.radius || ball.y >= backgroundCanvas.height - ball.radius) {
      ball.vy *= -1;
      ball.y = Math.max(ball.radius, Math.min(backgroundCanvas.height - ball.radius, ball.y));
      // Add slight rotation change on bounce
      ball.angularVelocity += (Math.random() - 0.5) * 0.02;
    }
    
    // Draw kidney bean ball
    if (ballImageLoaded && ballImage.complete) {
      const ballSize = 32; // Same size as game balls for consistency
      backgroundCtx.save();
      backgroundCtx.translate(ball.x, ball.y);
      backgroundCtx.rotate(ball.rotation);
      backgroundCtx.globalAlpha = 0.4; // Make background balls more transparent
      backgroundCtx.drawImage(ballImage, -ballSize/2, -ballSize/2, ballSize, ballSize);
      backgroundCtx.globalAlpha = 1; // Reset alpha
      backgroundCtx.restore();
    } else {
      // Fallback: draw using the same kidney bean shape as the main game
      const ballSize = 32; // Same size as game balls for consistency
      backgroundCtx.save();
      backgroundCtx.translate(ball.x, ball.y);
      backgroundCtx.rotate(ball.rotation);
      backgroundCtx.globalAlpha = 0.4;
      backgroundCtx.fillStyle = '#C45B5C'; // Same color as main game bean
      backgroundCtx.beginPath();
      // Use the exact same kidney bean shape as game balls
      const scale = ballSize / 20; // Scale to match ball size
      backgroundCtx.moveTo(-10 * scale, -4 * scale);
      backgroundCtx.bezierCurveTo(-14 * scale, -10 * scale, -14 * scale, 10 * scale, -10 * scale, 4 * scale);
      backgroundCtx.bezierCurveTo(-4 * scale, 10 * scale, 4 * scale, 10 * scale, 10 * scale, 4 * scale);
      backgroundCtx.bezierCurveTo(14 * scale, 1 * scale, 14 * scale, -1 * scale, 10 * scale, -4 * scale);
      backgroundCtx.bezierCurveTo(4 * scale, -10 * scale, -4 * scale, -10 * scale, -10 * scale, -4 * scale);
      backgroundCtx.closePath();
      backgroundCtx.fill();
      backgroundCtx.globalAlpha = 1;
      backgroundCtx.restore();
    }
    
    // No glow effects - keep beans in their pure natural form
  });
  
  backgroundAnimationId = requestAnimationFrame(animateBackground);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupModeButtons();
  setupSocketListeners();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Initialize player count display
  updatePlayerCountDisplay(0);
  
  // Initialize background game
  initBackgroundGame();
  
  // Initialize audio immediately and on various user interactions
  initAudio();
  
  // Multiple fallbacks for audio initialization
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });
  document.addEventListener('keydown', initAudio, { once: true });
  document.addEventListener('mousemove', initAudio, { once: true });
  
  // Try to initialize audio when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !audioContext) {
      initAudio();
    }
  });
});

function updatePlayerCountDisplay(count) {
  const playerCountEl = document.getElementById('playerCount');
  if (playerCountEl) {
    playerCountEl.textContent = `${count} / 5`;
    
    // Reset any inline styles to let CSS handle the styling
    playerCountEl.style.color = '';
    playerCountEl.style.borderColor = '';
    playerCountEl.style.background = '';
    
    // Add special class for pentagon mode
    if (count === 5) {
      playerCountEl.classList.add('pentagon-mode');
    } else {
      playerCountEl.classList.remove('pentagon-mode');
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
    btn.addEventListener('click', async () => {
      // Ensure audio is ready for immediate playback
      await initAudio();
      document.querySelector('.score-btn.active').classList.remove('active');
      btn.classList.add('active');
      winScore = parseInt(btn.dataset.score);
      playSound(528, 0.1, 0.05, 'triangle'); // Different sound for score selection
    });
  });
}

// Room Management
createRoomBtn.addEventListener('click', async () => {
  // Ensure audio is ready for immediate playback
  await initAudio();
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

startGameBtn.addEventListener('click', async () => {
  if (!currentRoom) return;
  // Ensure audio is ready for immediate playback
  await initAudio();
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
    
    // Stop background animation
    if (backgroundAnimationId) {
      cancelAnimationFrame(backgroundAnimationId);
      backgroundAnimationId = null;
    }
    
    // Hide menu and background canvas, show game
    menuPanel.style.display = 'none';
    backgroundCanvas.style.display = 'none';
    gameContainer.classList.add('active');
    
    // Show the HTML scoreboard
    document.getElementById('scoreDisplay').style.display = 'flex';
    
    startRenderLoop();
  });

  socket.on('gameState', (state) => {
    // Check for ball-paddle collisions to trigger impact animations
    if (gameState && gameState.ball && state.ball) {
      const prevBall = gameState.ball;
      const currBall = state.ball;
      
      // Simple collision detection by velocity change
      const velocityChange = Math.abs(currBall.vx - prevBall.vx) + Math.abs(currBall.vy - prevBall.vy);
      if (velocityChange > 2) { // Ball bounced significantly
        // Find closest paddle and trigger impact
        if (state.paddles) {
          Object.keys(state.paddles).forEach(key => {
            const paddle = state.paddles[key];
            const playerNum = parseInt(key);
            const distance = Math.sqrt(
              Math.pow(currBall.x - paddle.x, 2) + 
              Math.pow(currBall.y - paddle.y, 2)
            );
            
            // If ball is close to this paddle, trigger impact
            if (distance < 100) {
              triggerPlateImpact(playerNum, velocityChange);
              
              // Send haptic feedback to controller for this player's impact
              if (playerNumber === playerNum && 'vibrate' in navigator) {
                navigator.vibrate(Math.min(velocityChange * 10, 50)); // Stronger vibration for harder hits
              }
            }
          });
        }
      }
    }
    
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
      // Show background canvas again when reloading
      backgroundCanvas.style.display = 'block';
      initBackgroundGame();
      location.reload();
    }, 1000);
  });

  socket.on('speedWarning', ({ currentSpeed, newSpeed }) => {
    showSpeedWarning(newSpeed);
  });

  socket.on('speedIncreased', ({ newSpeed }) => {
    showSpeedIncrease(newSpeed);
    showSpeedIncreaseBackground(newSpeed);
  });

  socket.on('powerUpSound', ({ type }) => {
    if (sounds[type]) {
      sounds[type]();
    }
  });

  socket.on('ballSneeze', () => {
    sounds.ballSneeze();
  });

  socket.on('ballExplosion', () => {
    sounds.ballExplosion();
  });

  socket.on('paddleHiccup', () => {
    sounds.paddleHiccup();
  });

  socket.on('powerUpEnded', () => {
    // Clear any background color override
    document.body.style.backgroundColor = '';
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
  let hasFifthPlayer = false;
  
  // Track previous connected count for join sound
  const previousConnectedCount = window.previousConnectedCount || 0;
  
  // First, count connected players and check if 5th slot is connected
  slots.forEach((connected, i) => {
    if (connected) {
      connectedCount++;
      if (i === 4) { // 5th player (index 4)
        hasFifthPlayer = true;
      }
    }
  });
  
  // Only show 5th player card if a 5th player has actually joined (easter egg!)
  const player5Card = document.getElementById('player5Card');
  const playersGrid = document.querySelector('.players-grid');
  
  if (hasFifthPlayer) {
    // Check if this is the first time showing P5 (easter egg reveal)
    if (player5Card.classList.contains('hidden')) {
      // Play special sound for P5 reveal
      playSound(880, 0.15, 0.1, 'sine'); // Higher pitch pop
      setTimeout(() => playSound(1047, 0.2, 0.12, 'sine'), 100); // C6 note
      
      // Add reveal animation class
      player5Card.style.animation = 'revealP5 0.5s ease-out';
    }
    
    player5Card.classList.remove('hidden');
    playersGrid.classList.add('five-players');
  } else {
    player5Card.classList.add('hidden');
    playersGrid.classList.remove('five-players');
    player5Card.style.animation = ''; // Reset animation
  }
  
  // Process all player cards
  slots.forEach((connected, i) => {
    const card = document.querySelector(`.player-card[data-player="${i + 1}"]`);
    if (!card) return; // Skip if card doesn't exist
    
    const status = card.querySelector('.player-status');
    
    if (connected) {
      card.classList.add('connected');
      
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
      startGameBtn.textContent = '🌟 START BEAN PENTAGON';
    } else {
      startGameBtn.textContent = `START ${readyCount} PLAYER BEANPONG`;
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

// BeanPong Game Rendering
function startRenderLoop() {
  if (animationId) cancelAnimationFrame(animationId);
  render();
}

function render() {
  if (!gameState) {
    animationId = requestAnimationFrame(render);
    return;
  }

  // Apply background color override for power-ups
  let backgroundColor = '#0a0a0f';
  if (gameState.backgroundColorOverride) {
    const overlay = gameState.backgroundColorOverride;
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    backgroundColor = '#0a0a0f';
  }

  // Clear canvas with background color
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Update interpolations for smooth movement
  updateInterpolation();
  updatePlateImpacts(); // Update impact animations
  
  // Draw game elements
  drawField();
  drawPaddles();
  drawPowerUp();
  drawBall();
  drawEchoBallTrail();
  drawExtraBalls();
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
    let drawX = interpolated ? interpolated.x : paddle.x;
    let drawY = interpolated ? interpolated.y : paddle.y;
    
    // Apply subtle impact physics movement
    const impact = plateImpacts[playerNum];
    if (impact && impact.currentPush) {
      const pushX = Math.cos(impact.direction) * impact.currentPush;
      const pushY = Math.sin(impact.direction) * impact.currentPush;
      drawX += pushX;
      drawY += pushY;
    }
    
    // Determine rotation based on player position
    let rotation = 0;
    if (gameMode === 5 && paddle.angle !== undefined) {
      rotation = paddle.angle;
    } else {
      // Standard rotations for each player position
      switch(playerNum) {
        case 1: rotation = Math.PI/2; break;  // Left - plate faces right (+90°)
        case 2: rotation = -Math.PI/2; break; // Right - plate faces left (-90°)
        case 3: rotation = Math.PI; break;    // Top - plate faces down (180°)
        case 4: rotation = 0; break;          // Bottom - plate faces up (0°)
        case 5: rotation = 0; break;          // Center - upward facing (0°)
      }
    }
    
    // Calculate subtle dynamic rotation for movement effect (very small)
    let dynamicRotation = 0;
    if (interpolated && paddle) {
      const movementDelta = Math.abs((interpolated.x - paddle.x) + (interpolated.y - paddle.y));
      dynamicRotation = Math.sin(Date.now() * 0.01 + playerNum) * movementDelta * 0.0005; // Reduced for subtlety
    }
    
    ctx.save();
    ctx.translate(drawX, drawY);
    // Apply both the player-specific rotation AND the subtle dynamic rotation
    ctx.rotate(rotation + dynamicRotation);
    
    // Draw plate image if loaded, otherwise fallback to rectangle
    if (plateImageLoaded) {
      // Calculate proper plate dimensions - make plates bigger and maintain aspect ratio
      const plateScale = 1.8; // Make plates 80% bigger for better visibility
      const plateWidth = Math.max(paddle.w, paddle.h) * plateScale;
      const plateHeight = plateWidth; // Keep plates circular
      
      // Apply subtle color tint using a more sophisticated method
      if (playerNum !== 1 && gameMode !== 5) {
        // Create a subtle colored overlay
        ctx.fillStyle = playerColors[playerNum];
        ctx.globalAlpha = 0.15; // Very subtle tint
        ctx.beginPath();
        ctx.ellipse(0, 0, plateWidth/2, plateHeight/2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      // Special golden glow for pentagon mode
      if (gameMode === 5) {
        ctx.fillStyle = '#ffd700';
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, plateWidth/2 + 5, plateHeight/2 + 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      // Draw the plate image with high quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(plateImage, -plateWidth/2, -plateHeight/2, plateWidth, plateHeight); // Keep plates perfectly circular
      
      // Add glow effect for powered-up paddle
      if (gameState.activePowerUp && gameState.activePowerUp.player === playerNum) {
        ctx.strokeStyle = playerColors[playerNum];
        ctx.lineWidth = 4;
        ctx.shadowColor = playerColors[playerNum];
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(0, 0, plateWidth/2 + 8, plateHeight/2 + 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      
      // Add golden glow for pentagon paddles
      if (gameMode === 5) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.ellipse(0, 0, plateWidth/2 + 3, plateHeight/2 + 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    } else {
      // Fallback to regular rectangle
      ctx.fillStyle = gameMode === 5 ? '#ffd700' : playerColors[playerNum];
      ctx.fillRect(-paddle.w/2, -paddle.h/2, paddle.w, paddle.h);
      
      // Add golden glow for pentagon paddles
      if (gameMode === 5) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(-paddle.w/2, -paddle.h/2, paddle.w, paddle.h);
      }
    }
    
    ctx.restore();
    
    // Skip the split paddle drawing below if we've already drawn
    if (gameMode === 5 && paddle.angle !== undefined) {
      return;
    }
    
    // Handle split paddle effect for power-ups
    if (paddle.split && paddle.gapSize > 0) {
      // For split plates, we draw two separate plates with a gap
      const plateScale = 1.8;
      const plateSize = Math.max(paddle.w, paddle.h) * plateScale * 0.7; // Smaller individual plates
      const gapDistance = paddle.gapSize + 20; // Extra spacing for plate visibility
      
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(rotation);
      
      if (plateImageLoaded) {
        // Draw first plate
        ctx.translate(0, -gapDistance/2);
        if (gameMode === 5) {
          ctx.fillStyle = '#ffd700';
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, plateSize/2 + 3, plateSize/2 + 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(plateImage, -plateSize/2, -plateSize/2, plateSize, plateSize);
        
        // Draw second plate
        ctx.translate(0, gapDistance);
        if (gameMode === 5) {
          ctx.fillStyle = '#ffd700';
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, plateSize/2 + 3, plateSize/2 + 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(plateImage, -plateSize/2, -plateSize/2, plateSize, plateSize);
        
        // Add glow effects for both plates if powered up
        if (gameState.activePowerUp && gameState.activePowerUp.player === playerNum) {
          ctx.strokeStyle = playerColors[playerNum];
          ctx.lineWidth = 3;
          ctx.shadowColor = playerColors[playerNum];
          ctx.shadowBlur = 15;
          
          // Glow for second plate
          ctx.beginPath();
          ctx.ellipse(0, 0, plateSize/2 + 5, plateSize/2 + 5, 0, 0, Math.PI * 2);
          ctx.stroke();
          
          // Glow for first plate
          ctx.translate(0, -gapDistance);
          ctx.beginPath();
          ctx.ellipse(0, 0, plateSize/2 + 5, plateSize/2 + 5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        // Fallback rectangles for split mode
        ctx.fillStyle = gameMode === 5 ? '#ffd700' : playerColors[playerNum];
        if (paddle.h > paddle.w) {
          const segmentHeight = (paddle.h - paddle.gapSize) / 2;
          ctx.fillRect(-paddle.w/2, -paddle.h/2, paddle.w, segmentHeight);
          ctx.fillRect(-paddle.w/2, paddle.gapSize/2, paddle.w, segmentHeight);
        } else {
          const segmentWidth = (paddle.w - paddle.gapSize) / 2;
          ctx.fillRect(-paddle.w/2, -paddle.h/2, segmentWidth, paddle.h);
          ctx.fillRect(paddle.gapSize/2, -paddle.h/2, segmentWidth, paddle.h);
        }
      }
      
      ctx.restore();
    }
  });
}

function drawBall() {
  if (!gameState.ball) return;
  
  const ball = gameState.ball;
  const ballSize = 32; // Bigger kidney bean ball for better visibility
  
  // Special effects for different power-ups
  if (gameState.butterflyActive) {
    // Draw butterfly wings
    ctx.fillStyle = 'rgba(255, 192, 203, 0.6)';
    ctx.beginPath();
    ctx.ellipse(ball.x - 12, ball.y - 3, 8, 4, Math.PI / 6, 0, Math.PI * 2);
    ctx.ellipse(ball.x + 12, ball.y - 3, 8, 4, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
  }
  
  if (gameState.ballTantrumActive && gameState.ballTantrumStage === 'angry') {
    // Angry ball - red kidney bean shaking
    const shake = (Math.random() - 0.5) * 4;
    
    if (ballImageLoaded) {
      ctx.save();
      ctx.translate(ball.x + shake, ball.y + shake);
      
      // Apply rotation even during tantrum
      if (ball.rotation !== undefined) {
        ctx.rotate(ball.rotation);
      }
      
      // Apply red tint filter
      ctx.filter = 'hue-rotate(200deg) saturate(2) brightness(0.8)';
      ctx.drawImage(ballImage, -ballSize/2, -ballSize/2, ballSize, ballSize);
      ctx.filter = 'none';
      ctx.restore();
    } else {
      // Fallback angry kidney bean shape
      ctx.save();
      ctx.translate(ball.x + shake, ball.y + shake);
      if (ball.rotation !== undefined) {
        ctx.rotate(ball.rotation);
      }
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      // Draw kidney bean shape
      ctx.moveTo(-10, -4);
      ctx.bezierCurveTo(-14, -10, -14, 10, -10, 4);
      ctx.bezierCurveTo(-4, 10, 4, 10, 10, 4);
      ctx.bezierCurveTo(14, 1, 14, -1, 10, -4);
      ctx.bezierCurveTo(4, -10, -4, -10, -10, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    // Add angry face
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('😠', ball.x + shake, ball.y + shake + 2);
    return;
  }
  
  // Draw the kidney bean ball
  if (ballImageLoaded) {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    
    // Apply rotation
    if (ball.rotation !== undefined) {
      ctx.rotate(ball.rotation);
    }
    
    // Apply special effects
    if (gameState.sleepyTimeActive) {
      ctx.globalAlpha = 0.6; // Make it more transparent when sleepy
      ctx.filter = 'brightness(0.7) saturate(0.5)'; // Darker and desaturated
    } else if (gameState.drunkBallActive) {
      // Add rainbow hue rotation for drunk effect
      const hue = (Date.now() * 0.1) % 360;
      ctx.filter = `hue-rotate(${hue}deg) saturate(1.5) brightness(1.2)`;
    }
    
    ctx.drawImage(ballImage, -ballSize/2, -ballSize/2, ballSize, ballSize);
    
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.restore();
  } else {
    // Fallback to kidney bean shape if image hasn't loaded
    ctx.save();
    ctx.translate(ball.x, ball.y);
    if (ball.rotation !== undefined) {
      ctx.rotate(ball.rotation);
    }
    ctx.fillStyle = gameState.sleepyTimeActive ? 'rgba(196, 91, 92, 0.6)' : '#C45B5C';
    ctx.beginPath();
    // Draw kidney bean shape
    ctx.moveTo(-10, -4);
    ctx.bezierCurveTo(-14, -10, -14, 10, -10, 4);
    ctx.bezierCurveTo(-4, 10, 4, 10, 10, 4);
    ctx.bezierCurveTo(14, 1, 14, -1, 10, -4);
    ctx.bezierCurveTo(4, -10, -4, -10, -10, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  
  // Add ZZZ for sleepy time
  if (gameState.sleepyTimeActive) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ZZZ', ball.x + 15, ball.y - 15);
  }
  
  // No glow effects - keep beans in their pure natural form
}

function drawPowerUp() {
  if (!gameState.powerUp) return;
  
  const powerUp = gameState.powerUp;
  const elapsed = Date.now() - powerUp.spawnTime;
  const timeLeft = 10000 - elapsed;
  
  // Subtle pulse instead of harsh blinking
  const pulseOpacity = 0.7 + 0.3 * Math.sin(elapsed * 0.008);
  const finalOpacity = timeLeft < 3000 ? pulseOpacity : 1;
  
  // Power-up colors and symbols
  let boxColor, symbol, shadowColor;
  if (powerUp.type === 'grow') {
    boxColor = `rgba(46, 204, 113, ${finalOpacity})`;
    shadowColor = 'rgba(46, 204, 113, 0.3)';
    symbol = '+';
  } else if (powerUp.type === 'shrink') {
    boxColor = `rgba(231, 76, 60, ${finalOpacity})`;
    shadowColor = 'rgba(231, 76, 60, 0.3)';
    symbol = '−';
  } else if (powerUp.type === 'split') {
    boxColor = `rgba(155, 89, 182, ${finalOpacity})`;
    shadowColor = 'rgba(155, 89, 182, 0.3)';
    symbol = '⟐';
  } else if (powerUp.type === 'drunkBall') {
    boxColor = `rgba(255, 192, 203, ${finalOpacity})`;
    shadowColor = 'rgba(255, 192, 203, 0.3)';
    symbol = '🍺';
  } else if (powerUp.type === 'paddleHiccups') {
    boxColor = `rgba(255, 255, 0, ${finalOpacity})`;
    shadowColor = 'rgba(255, 255, 0, 0.3)';
    symbol = '😵';
  } else if (powerUp.type === 'bigHead') {
    boxColor = `rgba(255, 165, 0, ${finalOpacity})`;
    shadowColor = 'rgba(255, 165, 0, 0.3)';
    symbol = '🎈';
  } else if (powerUp.type === 'butterfly') {
    boxColor = `rgba(144, 238, 144, ${finalOpacity})`;
    shadowColor = 'rgba(144, 238, 144, 0.3)';
    symbol = '🦋';
  } else if (powerUp.type === 'sneezeAttack') {
    boxColor = `rgba(255, 20, 147, ${finalOpacity})`;
    shadowColor = 'rgba(255, 20, 147, 0.3)';
    symbol = '🤧';
  } else if (powerUp.type === 'echoBall') {
    boxColor = `rgba(138, 43, 226, ${finalOpacity})`;
    shadowColor = 'rgba(138, 43, 226, 0.3)';
    symbol = '👻';
  } else if (powerUp.type === 'ballTantrum') {
    boxColor = `rgba(255, 0, 0, ${finalOpacity})`;
    shadowColor = 'rgba(255, 0, 0, 0.3)';
    symbol = '😠';
  } else if (powerUp.type === 'sleepyTime') {
    boxColor = `rgba(75, 0, 130, ${finalOpacity})`;
    shadowColor = 'rgba(75, 0, 130, 0.3)';
    symbol = '😴';
  } else {
    boxColor = `rgba(241, 196, 15, ${finalOpacity})`;
    shadowColor = 'rgba(241, 196, 15, 0.3)';
    symbol = '?';
  }
  
  const size = powerUp.size * 0.8;
  
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
  
  // Draw main power-up box
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
  
  // Draw symbol
  ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
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
    // Create speed indicator - positioned under score display
    speedIndicator = document.createElement('div');
    speedIndicator.id = 'speedIndicator';
    speedIndicator.style.cssText = `
      position: absolute;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: rgba(0, 0, 0, 0.3);
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
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

// Add the missing drawing functions
function drawEchoBallTrail() {
  if (!gameState.echoBallActive || !gameState.echoBallTrail) return;
  
  gameState.echoBallTrail.forEach((trail, index) => {
    const opacity = 0.3 * (index / gameState.echoBallTrail.length);
    const trailSize = 16;
    
    if (ballImageLoaded) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(trail.x, trail.y);
      
      // Apply rotation with a slight delay effect
      if (trail.rotation !== undefined) {
        ctx.rotate(trail.rotation);
      } else if (gameState.ball && gameState.ball.rotation) {
        // Use slightly delayed rotation for trail effect
        const rotationDelay = index * 0.1;
        ctx.rotate(gameState.ball.rotation - rotationDelay);
      }
      
      ctx.drawImage(ballImage, -trailSize/2, -trailSize/2, trailSize, trailSize);
      ctx.restore();
    } else {
      // Fallback to kidney bean shape
      ctx.save();
      ctx.translate(trail.x, trail.y);
      if (trail.rotation !== undefined) {
        ctx.rotate(trail.rotation);
      }
      ctx.fillStyle = `rgba(196, 91, 92, ${opacity})`;
      ctx.beginPath();
      // Draw small kidney bean shape
      ctx.moveTo(-6, -3);
      ctx.bezierCurveTo(-8, -6, -8, 6, -6, 3);
      ctx.bezierCurveTo(-3, 6, 3, 6, 6, 3);
      ctx.bezierCurveTo(8, 1, 8, -1, 6, -3);
      ctx.bezierCurveTo(3, -6, -3, -6, -6, -3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawExtraBalls() {
  if (!gameState.extraBalls) return;
  
  gameState.extraBalls.forEach(ball => {
    const extraBallSize = 18;
    
    if (ballImageLoaded) {
      ctx.save();
      ctx.translate(ball.x, ball.y);
      
      // Apply rotation if available
      if (ball.rotation !== undefined) {
        ctx.rotate(ball.rotation);
      }
      
      ctx.drawImage(ballImage, -extraBallSize/2, -extraBallSize/2, extraBallSize, extraBallSize);
      ctx.restore();
    } else {
      // Fallback to kidney bean shape
      ctx.save();
      ctx.translate(ball.x, ball.y);
      if (ball.rotation !== undefined) {
        ctx.rotate(ball.rotation);
      }
      ctx.fillStyle = '#C45B5C';
      ctx.beginPath();
      // Draw small kidney bean shape
      ctx.moveTo(-6, -3);
      ctx.bezierCurveTo(-8, -6, -8, 6, -6, 3);
      ctx.bezierCurveTo(-3, 6, 3, 6, 6, 3);
      ctx.bezierCurveTo(8, 1, 8, -1, 6, -3);
      ctx.bezierCurveTo(3, -6, -3, -6, -6, -3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    // Add glow
    ctx.save();
    ctx.translate(ball.x, ball.y);
    if (ball.rotation !== undefined) {
      ctx.rotate(ball.rotation);
    }
    ctx.strokeStyle = 'rgba(196, 91, 92, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Draw kidney bean-shaped glow
    ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function showSpeedIncreaseBackground(newSpeed) {
  // Create background text overlay
  let speedOverlay = document.getElementById('speedIncreaseOverlay');
  if (!speedOverlay) {
    speedOverlay = document.createElement('div');
    speedOverlay.id = 'speedIncreaseOverlay';
    speedOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 120px;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.1);
      pointer-events: none;
      z-index: 5;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    document.getElementById('gameContainer').appendChild(speedOverlay);
  }
  
  speedOverlay.textContent = `SPEED ${newSpeed.toFixed(1)}X`;
  speedOverlay.style.opacity = '1';
  
  // Fade out after 3 seconds
  setTimeout(() => {
    speedOverlay.style.transition = 'opacity 2s ease-out';
    speedOverlay.style.opacity = '0';
  }, 1000);
}

// Show speed warning before increase
function showSpeedWarning(newSpeed) {
  let speedIndicator = document.getElementById('speedIndicator');
  if (!speedIndicator) return;
  
  // Flash warning
  speedIndicator.style.background = 'rgba(255, 165, 0, 0.3)';
  speedIndicator.style.borderColor = 'rgba(255, 165, 0, 0.6)';
  speedIndicator.style.color = '#ffaa00';
  speedIndicator.textContent = `⚠️ Speed increasing to ${newSpeed.toFixed(1)}x`;
  
  // Sound warning
  playSound(440, 0.15, 0.08, 'triangle');
  
  // Reset after 3 seconds
  setTimeout(() => {
    speedIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
    speedIndicator.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    speedIndicator.style.color = 'rgba(255, 255, 255, 0.6)';
  }, 3000);
}

// Show speed increase notification
function showSpeedIncrease(newSpeed) {
  let speedIndicator = document.getElementById('speedIndicator');
  if (!speedIndicator) return;
  
  // Flash green for increase
  speedIndicator.style.background = 'rgba(0, 255, 0, 0.2)';
  speedIndicator.style.borderColor = 'rgba(0, 255, 0, 0.5)';
  speedIndicator.style.color = '#00ff00';
  speedIndicator.textContent = `🚀 Speed: ${newSpeed.toFixed(1)}x`;
  
  // Sound confirmation
  playSound(660, 0.2, 0.08, 'sine');
  
  // Reset after 2 seconds
  setTimeout(() => {
    speedIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
    speedIndicator.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    speedIndicator.style.color = 'rgba(255, 255, 255, 0.6)';
    speedIndicator.textContent = `Speed: ${newSpeed.toFixed(1)}x`;
  }, 2000);
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