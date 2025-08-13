// Touch Slider Controller - Direct 1:1 Movement
const socket = io();

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

// Check URL params for room code
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('r');
  if (roomCode) {
    roomInput.value = roomCode.toUpperCase();
    setTimeout(() => joinBtn.click(), 500);
  }
});

// Join Room
joinBtn.addEventListener('click', () => {
  const room = roomInput.value.trim().toUpperCase();
  if (!room) {
    showStatus('Enter room code', 'error');
    return;
  }
  
  joinBtn.disabled = true;
  showStatus('Connecting...', '');
  
  socket.emit('joinRoom', { room }, (res) => {
    if (!res.ok) {
      showStatus(res.error || 'Failed to join', 'error');
      joinBtn.disabled = false;
      return;
    }
    
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
  }, 16); // ~60 FPS
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

// Enter key to join
roomInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});