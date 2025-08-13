// Premium Controller with Smooth Continuous Input
const socket = io();

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const gameController = document.getElementById('gameController');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const statusMessage = document.getElementById('statusMessage');
const playerBadge = document.querySelector('.player-badge');

// Controller State
let joinedRoom = null;
let playerNumber = null;
let inputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  action: false
};
let sendInterval = null;
let lastInputTime = 0;

// Haptic Feedback Patterns
const haptics = {
  light: () => vibrate(10),
  medium: () => vibrate(25),
  heavy: () => vibrate(50),
  double: () => vibrate([25, 50, 25]),
  success: () => vibrate([25, 50, 100])
};

function vibrate(pattern) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkURLParams();
  setupInputHandlers();
  setupContinuousInput();
});

// Check for room code in URL
function checkURLParams() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('r');
  if (roomCode) {
    roomInput.value = roomCode.toUpperCase();
    setTimeout(() => joinBtn.click(), 500);
  }
}

// Join Room
joinBtn.addEventListener('click', () => {
  const room = roomInput.value.trim().toUpperCase();
  if (!room) {
    showStatus('Enter a room code', 'error');
    return;
  }
  
  joinBtn.disabled = true;
  showStatus('Connecting...', 'info');
  
  socket.emit('joinRoom', { room }, (res) => {
    if (!res.ok) {
      showStatus(res.error || 'Failed to join', 'error');
      joinBtn.disabled = false;
      return;
    }
    
    joinedRoom = room;
    playerNumber = res.player;
    playerBadge.textContent = `P${playerNumber}`;
    
    // Set player color
    const playerColors = ['#ff3b3b', '#ffffff', '#ffd700', '#00bfff'];
    playerBadge.style.color = playerColors[playerNumber - 1];
    
    // Transition to controller
    joinScreen.style.display = 'none';
    gameController.classList.remove('hidden');
    
    haptics.success();
    startSendingInput();
  });
});

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  
  if (type === 'error') {
    haptics.heavy();
  }
}

// Input Handling
function setupInputHandlers() {
  const dpadButtons = document.querySelectorAll('.dpad-btn');
  const actionBtn = document.getElementById('actionBtn');
  
  // D-Pad controls with continuous input
  dpadButtons.forEach(btn => {
    const dir = btn.dataset.dir;
    
    // Touch events
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleDirectionStart(dir);
      btn.classList.add('active');
      haptics.light();
    });
    
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      handleDirectionEnd(dir);
      btn.classList.remove('active');
    });
    
    // Mouse events for testing
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      handleDirectionStart(dir);
      btn.classList.add('active');
    });
    
    btn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      handleDirectionEnd(dir);
      btn.classList.remove('active');
    });
    
    // Prevent context menu
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  
  // Action button
  actionBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    inputState.action = true;
    haptics.medium();
    sendInput();
    
    setTimeout(() => {
      inputState.action = false;
    }, 100);
  });
  
  actionBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    inputState.action = true;
    sendInput();
    
    setTimeout(() => {
      inputState.action = false;
    }, 100);
  });
  
  // Prevent touch scrolling
  document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
}

function handleDirectionStart(dir) {
  inputState[dir] = true;
  lastInputTime = Date.now();
}

function handleDirectionEnd(dir) {
  inputState[dir] = false;
}

// Continuous Input System
function setupContinuousInput() {
  // Send input state at 60 FPS for smooth movement
  setInterval(() => {
    if (joinedRoom && hasActiveInput()) {
      sendInput();
    }
  }, 16); // ~60 FPS
}

function hasActiveInput() {
  return inputState.left || inputState.right || 
         inputState.up || inputState.down || inputState.action;
}

function startSendingInput() {
  // Send initial state
  sendInput();
}

function sendInput() {
  if (!joinedRoom) return;
  
  socket.emit('input', {
    room: joinedRoom,
    input: { ...inputState }
  });
}

// Visual Feedback
let feedbackTimeout;
function showFeedback(type) {
  const indicator = document.getElementById('feedbackIndicator');
  clearTimeout(feedbackTimeout);
  
  indicator.className = `feedback-indicator ${type}`;
  indicator.style.opacity = '1';
  
  feedbackTimeout = setTimeout(() => {
    indicator.style.opacity = '0';
  }, 200);
}

// Socket Events
socket.on('disconnect', () => {
  if (joinedRoom) {
    showStatus('Disconnected', 'error');
    haptics.heavy();
    setTimeout(() => {
      location.reload();
    }, 2000);
  }
});

socket.on('reconnect', () => {
  if (joinedRoom) {
    showStatus('Reconnected', 'success');
    haptics.light();
  }
});

// Keyboard Support for Testing
document.addEventListener('keydown', (e) => {
  if (!joinedRoom) return;
  
  switch(e.key) {
    case 'ArrowUp':
    case 'w':
      handleDirectionStart('up');
      document.getElementById('upBtn').classList.add('active');
      break;
    case 'ArrowDown':
    case 's':
      handleDirectionStart('down');
      document.getElementById('downBtn').classList.add('active');
      break;
    case 'ArrowLeft':
    case 'a':
      handleDirectionStart('left');
      document.getElementById('leftBtn').classList.add('active');
      break;
    case 'ArrowRight':
    case 'd':
      handleDirectionStart('right');
      document.getElementById('rightBtn').classList.add('active');
      break;
    case ' ':
      inputState.action = true;
      sendInput();
      setTimeout(() => inputState.action = false, 100);
      break;
  }
});

document.addEventListener('keyup', (e) => {
  if (!joinedRoom) return;
  
  switch(e.key) {
    case 'ArrowUp':
    case 'w':
      handleDirectionEnd('up');
      document.getElementById('upBtn').classList.remove('active');
      break;
    case 'ArrowDown':
    case 's':
      handleDirectionEnd('down');
      document.getElementById('downBtn').classList.remove('active');
      break;
    case 'ArrowLeft':
    case 'a':
      handleDirectionEnd('left');
      document.getElementById('leftBtn').classList.remove('active');
      break;
    case 'ArrowRight':
    case 'd':
      handleDirectionEnd('right');
      document.getElementById('rightBtn').classList.remove('active');
      break;
  }
});

// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);