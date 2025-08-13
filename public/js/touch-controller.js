// Touch Slider Controller - Direct 1:1 Movement
const socket = io();

// Simple sound system for controller
let audioCtx = null;

function initControllerAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.log('Audio not supported');
  }
}

function playControllerSound(freq, duration, volume = 0.03) {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.frequency.value = freq;
  osc.type = 'sine';
  
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const gameScreen = document.getElementById('gameScreen');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const status = document.getElementById('status');
const playerLabel = document.getElementById('playerLabel');
const roomLabel = document.getElementById('roomLabel');
const verticalController = document.getElementById('verticalController');
const horizontalController = document.getElementById('horizontalController');
const paddleIndicator = document.getElementById('paddleIndicator');
const paddleIndicatorH = document.getElementById('paddleIndicatorH');

// State
let joinedRoom = null;
let playerNumber = null;
let touchActive = false;
let currentPosition = 0.5; // 0 to 1 normalized
let sendInterval = null;
let countdownActive = false;
let countdownNumber = null;

// Check URL params for room code
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('r');
  if (roomCode) {
    roomInput.value = roomCode.toUpperCase();
    setTimeout(() => joinBtn.click(), 500);
  }
  
  // Initialize audio on first interaction
  document.addEventListener('touchstart', initControllerAudio, { once: true });
  document.addEventListener('click', initControllerAudio, { once: true });
});

// Join Room
joinBtn.addEventListener('click', () => {
  const room = roomInput.value.trim().toUpperCase();
  if (!room) {
    showStatus('Enter room code', 'error');
    return;
  }
  
  playControllerSound(440, 0.1, 0.04); // Join button sound
  joinBtn.disabled = true;
  showStatus('Connecting...', '');
  
  socket.emit('joinRoom', { room }, (res) => {
    if (!res.ok) {
      showStatus(res.error || 'Failed to join', 'error');
      joinBtn.disabled = false;
      return;
    }
    
    playControllerSound(660, 0.2, 0.05); // Success sound
    joinedRoom = room;
    playerNumber = res.player;
    setupController();
  });
});

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type}`;
  if ('vibrate' in navigator && type === 'error') {
    navigator.vibrate(50);
  }
}

// Setup Controller Based on Player Number
function setupController() {
  // Update UI
  playerLabel.textContent = `PLAYER ${playerNumber}`;
  roomLabel.textContent = `ROOM: ${joinedRoom}`;
  
  // Set player color class
  gameScreen.className = `game-screen player-${playerNumber}`;
  
  // Show appropriate controller
  if (playerNumber <= 2) {
    // Vertical controller for players 1 & 2
    verticalController.classList.remove('hidden');
    horizontalController.classList.add('hidden');
    setupVerticalTouch();
  } else {
    // Horizontal controller for players 3 & 4
    verticalController.classList.add('hidden');
    horizontalController.classList.remove('hidden');
    setupHorizontalTouch();
  }
  
  // Transition to game screen
  joinScreen.style.display = 'none';
  gameScreen.classList.remove('hidden');
  
  // Haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 100]);
  }
  
  // Start sending position updates
  startPositionUpdates();
}

// Vertical Touch Control (Players 1 & 2)
function setupVerticalTouch() {
  const touchArea = verticalController;
  const indicator = paddleIndicator;
  
  // Touch events
  touchArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchActive = true;
    handleVerticalTouch(e.touches[0], touchArea, indicator);
  });
  
  touchArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (touchActive) {
      handleVerticalTouch(e.touches[0], touchArea, indicator);
    }
  });
  
  touchArea.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchActive = false;
  });
  
  // Mouse events for testing
  touchArea.addEventListener('mousedown', (e) => {
    touchActive = true;
    handleVerticalMouse(e, touchArea, indicator);
  });
  
  touchArea.addEventListener('mousemove', (e) => {
    if (touchActive) {
      handleVerticalMouse(e, touchArea, indicator);
    }
  });
  
  touchArea.addEventListener('mouseup', () => {
    touchActive = false;
  });
  
  touchArea.addEventListener('mouseleave', () => {
    touchActive = false;
  });
}

function handleVerticalTouch(touch, touchArea, indicator) {
  const rect = touchArea.getBoundingClientRect();
  const y = touch.clientY - rect.top;
  const height = rect.height;
  
  // Calculate normalized position (0 at top, 1 at bottom)
  currentPosition = Math.max(0, Math.min(1, y / height));
  
  // Update visual indicator
  const indicatorHeight = 100;
  const maxTop = height - indicatorHeight;
  indicator.style.top = (currentPosition * maxTop) + 'px';
  indicator.style.marginTop = '0';
}

function handleVerticalMouse(e, touchArea, indicator) {
  const rect = touchArea.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;
  
  currentPosition = Math.max(0, Math.min(1, y / height));
  
  const indicatorHeight = 100;
  const maxTop = height - indicatorHeight;
  indicator.style.top = (currentPosition * maxTop) + 'px';
  indicator.style.marginTop = '0';
}

// Horizontal Touch Control (Players 3 & 4)
function setupHorizontalTouch() {
  const touchArea = horizontalController;
  const indicator = paddleIndicatorH;
  
  // Touch events
  touchArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchActive = true;
    handleHorizontalTouch(e.touches[0], touchArea, indicator);
  });
  
  touchArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (touchActive) {
      handleHorizontalTouch(e.touches[0], touchArea, indicator);
    }
  });
  
  touchArea.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchActive = false;
  });
  
  // Mouse events for testing
  touchArea.addEventListener('mousedown', (e) => {
    touchActive = true;
    handleHorizontalMouse(e, touchArea, indicator);
  });
  
  touchArea.addEventListener('mousemove', (e) => {
    if (touchActive) {
      handleHorizontalMouse(e, touchArea, indicator);
    }
  });
  
  touchArea.addEventListener('mouseup', () => {
    touchActive = false;
  });
  
  touchArea.addEventListener('mouseleave', () => {
    touchActive = false;
  });
}

function handleHorizontalTouch(touch, touchArea, indicator) {
  const rect = touchArea.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const width = rect.width;
  
  // Calculate normalized position (0 at left, 1 at right)
  currentPosition = Math.max(0, Math.min(1, x / width));
  
  // Update visual indicator
  const indicatorWidth = 100;
  const maxLeft = width - indicatorWidth;
  indicator.style.left = (currentPosition * maxLeft) + 'px';
  indicator.style.marginLeft = '0';
}

function handleHorizontalMouse(e, touchArea, indicator) {
  const rect = touchArea.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const width = rect.width;
  
  currentPosition = Math.max(0, Math.min(1, x / width));
  
  const indicatorWidth = 100;
  const maxLeft = width - indicatorWidth;
  indicator.style.left = (currentPosition * maxLeft) + 'px';
  indicator.style.marginLeft = '0';
}

// Send Position Updates
function startPositionUpdates() {
  // Send position at 60 FPS for smooth movement
  if (sendInterval) clearInterval(sendInterval);
  sendInterval = setInterval(() => {
    if (joinedRoom) {
      socket.emit('input', {
        room: joinedRoom,
        position: currentPosition
      });
    }
  }, 10); // ~100 FPS for ultra-responsive controls
}

// Socket Events
socket.on('disconnect', () => {
  if (joinedRoom) {
    showStatus('Disconnected', 'error');
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    setTimeout(() => location.reload(), 2000);
  }
});

socket.on('countdownTick', ({ count }) => {
  countdownActive = true;
  countdownNumber = count;
  showCountdownOverlay(count);
  
  if (count === 1) {
    playControllerSound(660, 0.4, 0.08); // Final countdown sound
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } else {
    playControllerSound(440, 0.2, 0.05); // Regular countdown sound
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
  }
});

socket.on('countdownComplete', () => {
  countdownActive = false;
  countdownNumber = null;
  hideCountdownOverlay();
  playControllerSound(880, 0.3, 0.08); // Game start sound
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 50, 50, 300]); // Victory pattern
  }
});

socket.on('gameOver', () => {
  if ('vibrate' in navigator) {
    navigator.vibrate([100, 100, 100, 100, 200]);
  }
});

// Prevent default touch behaviors
document.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

document.addEventListener('gesturestart', (e) => {
  e.preventDefault();
});

// Countdown overlay functions
function showCountdownOverlay(count) {
  let overlay = document.getElementById('countdownOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'countdownOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    document.body.appendChild(overlay);
  }
  
  const countdownText = count === 0 ? 'GO!' : count.toString();
  const color = count === 1 ? '#ff3b3b' : count === 0 ? '#00ff00' : '#ffffff';
  
  overlay.innerHTML = `
    <div style="
      font-size: ${count === 0 ? '80px' : '120px'};
      font-weight: bold;
      text-align: center;
      color: ${color};
      text-shadow: 0 0 30px ${color};
      animation: pulse 0.5s ease-in-out;
    ">
      ${countdownText}
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(0.8); opacity: 0; }
        50% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
    </style>
  `;
  
  overlay.style.display = 'flex';
}

function hideCountdownOverlay() {
  const overlay = document.getElementById('countdownOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Enter key to join
roomInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});