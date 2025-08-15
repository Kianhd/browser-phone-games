// Touch Slider Controller - Direct 1:1 Movement
const socket = io();

// Initialize Hybrid Connection Manager for ultra-low latency
let hybridConnection = null;
let useWebRTC = false;

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
const readyScreen = document.getElementById('readyScreen');
const gameScreen = document.getElementById('gameScreen');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const readyBtn = document.getElementById('readyBtn');
const startGameBtnController = document.getElementById('startGameBtnController');
const status = document.getElementById('status');
const playerLabel = document.getElementById('playerLabel');
const roomLabel = document.getElementById('roomLabel');
const readyPlayerLabel = document.getElementById('readyPlayerLabel');
const readyRoomLabel = document.getElementById('readyRoomLabel');
const verticalController = document.getElementById('verticalController');
const horizontalController = document.getElementById('horizontalController');
const paddleIndicator = document.getElementById('paddleIndicator');
const paddleIndicatorH = document.getElementById('paddleIndicatorH');

// State
let joinedRoom = null;
let playerNumber = null;
let isReady = false;
let touchActive = false;
let currentPosition = 0.5; // 0 to 1 normalized
let sendInterval = null;
let countdownActive = false;
let countdownNumber = null;

// Initialize Universal Connection Manager for controller
let universalController = null;

// Check URL params for room code and connection data
window.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('r');
  const rtcMode = params.get('mode');
  const rtcCode = params.get('rtc');
  const connectionData = params.get('data');
  
  if (roomCode) {
    roomInput.value = roomCode.toUpperCase();
    
    // Check for universal connection data first
    if (connectionData && rtcMode === 'smart') {
      await initializeUniversalConnection(connectionData);
    } else if (rtcMode === 'direct' || rtcCode) {
      // Fallback to WebRTC-only initialization
      await initializeWebRTCController(rtcCode);
    }
    
    setTimeout(() => joinBtn.click(), 500);
  }
  
  // Initialize audio on first interaction
  document.addEventListener('touchstart', initControllerAudio, { once: true });
  document.addEventListener('click', initControllerAudio, { once: true });
});

// Initialize Universal Connection for controller
async function initializeUniversalConnection(encodedData) {
  try {
    universalController = new UniversalConnectionManager();
    
    // Decode and parse connection data
    const decodedData = atob(encodedData);
    const connectionInfo = JSON.parse(decodedData);
    
    console.log('📱 Universal connection data received:', connectionInfo);
    
    // Attempt connection using universal system
    const connection = await universalController.connectFromQR(JSON.stringify(connectionInfo));
    
    if (connection.success) {
      console.log('🌐 Universal connection established:', connection.type);
      
      // Update connection status display
      updateControllerConnectionDisplay({
        type: connection.type,
        state: 'connected',
        latency: connection.method.latency
      });
      
      // Set up hybrid connection based on the successful method
      if (connection.type === 'webrtc') {
        useWebRTC = true;
      }
    }
    
  } catch (error) {
    console.error('❌ Universal connection failed:', error);
    // Fall back to standard socket.io connection
    console.log('🔄 Falling back to standard connection...');
  }
}

// Initialize WebRTC controller connection
async function initializeWebRTCController(connectionCode) {
  try {
    hybridConnection = new HybridConnectionManager();
    
    // Set up connection monitoring
    hybridConnection.onConnectionChange = (info) => {
      console.log('📱 Controller connection changed:', info);
      updateControllerConnectionDisplay(info);
      
      if (info.type === 'webrtc' && info.state === 'connected') {
        useWebRTC = true;
        console.log('🚀 WebRTC P2P connection established!');
      }
    };
    
    const result = await hybridConnection.initializeConnection(false);
    console.log('📱 Controller connection initialized:', result);
    
  } catch (error) {
    console.error('❌ WebRTC controller initialization failed:', error);
    useWebRTC = false;
  }
}

// Update controller connection display
function updateControllerConnectionDisplay(info) {
  // You could add UI elements to show connection status on controller
  const statusText = info.type === 'webrtc' ? 
    '🚀 Direct Connection' : 
    '🌐 Internet Connection';
  
  console.log(`📱 Connection Status: ${statusText}`);
}

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

// Ready Button
readyBtn.addEventListener('click', () => {
  playControllerSound(660, 0.15, 0.06); // Ready sound
  isReady = true;
  
  // Send ready status to server
  socket.emit('playerReady', { room: joinedRoom, player: playerNumber });
  
  // Update ready button
  readyBtn.textContent = '✓ READY';
  readyBtn.disabled = true;
  
  // Don't transition to game screen yet for non-host players
  if (playerNumber === 1) {
    // Player 1 can transition to game screen immediately
    readyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
  } else {
    // Other players show waiting message
    readyBtn.textContent = '✓ WAITING FOR HOST TO START';
    readyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    readyBtn.style.color = 'rgba(255, 255, 255, 0.7)';
  }
  
  // Start sending position updates
  startPositionUpdates();
  
  // Haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate([100, 50, 100]);
  }
});

// Start Game Button (only for player 1)
startGameBtnController.addEventListener('click', () => {
  if (!startGameBtnController.disabled && joinedRoom) {
    playControllerSound(880, 0.2, 0.08); // Start game sound
    
    // Get current ready count to determine mode
    let readyCount = 0;
    if (window.currentRoomData && window.currentRoomData.readyStates) {
      window.currentRoomData.readyStates.forEach(ready => {
        if (ready) readyCount++;
      });
    }
    
    const gameMode = Math.max(2, readyCount);
    socket.emit('startGame', { room: joinedRoom, mode: gameMode, winScore: 5 });
    
    // Disable button after clicking
    startGameBtnController.disabled = true;
    startGameBtnController.textContent = 'STARTING...';
    
    // Show scroll hint for host as well
    setTimeout(() => showScrollHint(), 1000);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 200]);
    }
  }
});

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type}`;
  if ('vibrate' in navigator && type === 'error') {
    navigator.vibrate(50);
  }
  
  // Show troubleshooting section for connection errors
  if (type === 'error' && (message.includes('Failed') || message.includes('failed') || message.includes('error'))) {
    showTroubleshootingSection();
  }
}

// Show troubleshooting interface
function showTroubleshootingSection() {
  const troubleshootSection = document.getElementById('troubleshootSection');
  if (troubleshootSection) {
    troubleshootSection.classList.remove('hidden');
  }
}

// Hide troubleshooting interface
function hideTroubleshootingSection() {
  const troubleshootSection = document.getElementById('troubleshootSection');
  if (troubleshootSection) {
    troubleshootSection.classList.add('hidden');
  }
}

// Retry connection functionality
function retryConnection() {
  console.log('🔄 Retrying connection...');
  
  // Hide troubleshooting section
  hideTroubleshootingSection();
  
  // Reset status
  showStatus('Retrying connection...', '');
  
  // Re-enable join button
  joinBtn.disabled = false;
  
  // Check if we have universal connection data to retry
  const params = new URLSearchParams(window.location.search);
  const connectionData = params.get('data');
  const rtcMode = params.get('mode');
  
  if (connectionData && rtcMode === 'smart') {
    // Retry universal connection
    initializeUniversalConnection(connectionData).then(() => {
      // Auto-retry join if room code is available
      if (roomInput.value.trim()) {
        setTimeout(() => joinBtn.click(), 1000);
      }
    }).catch(() => {
      showStatus('Retry failed. Please check your connection.', 'error');
    });
  } else {
    // Standard retry - just re-enable joining
    showStatus('Ready to try again', '');
  }
  
  // Haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 100]);
  }
}

// Setup Controller Based on Player Number
function setupController() {
  // Update ready screen UI
  readyPlayerLabel.textContent = `PLAYER ${playerNumber}`;
  readyRoomLabel.textContent = `ROOM: ${joinedRoom}`;
  
  // Update game screen UI for later
  playerLabel.textContent = `PLAYER ${playerNumber}`;
  roomLabel.textContent = `ROOM: ${joinedRoom}`;
  
  // Set player color class
  gameScreen.className = `game-screen player-${playerNumber}`;
  
  // Show appropriate controller for later
  if (playerNumber <= 2) {
    // Vertical controller for players 1 & 2
    verticalController.classList.remove('hidden');
    horizontalController.classList.add('hidden');
    setupVerticalTouch();
  } else if (playerNumber === 5) {
    // Special radial controller for player 5 (pentagon mode)
    verticalController.classList.remove('hidden');
    horizontalController.classList.add('hidden');
    setupVerticalTouch(); // Use vertical for radial in/out movement
  } else {
    // Horizontal controller for players 3 & 4
    verticalController.classList.add('hidden');
    horizontalController.classList.remove('hidden');
    setupHorizontalTouch();
  }
  
  // Show start button for Player 1 immediately after joining
  if (playerNumber === 1) {
    startGameBtnController.classList.remove('hidden');
  }
  
  // Update controller hint text based on player number
  updateControllerHint();
  
  // Transition to ready screen first
  joinScreen.style.display = 'none';
  readyScreen.classList.remove('hidden');
  
  // Haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 100]);
  }
}

// Vertical Touch Control (Players 1 & 2)
function setupVerticalTouch() {
  const touchArea = verticalController;
  const indicator = paddleIndicator;
  
  // Touch events
  touchArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchActive = true;
    indicator.classList.add('active'); // Add visual feedback
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
    indicator.classList.remove('active'); // Remove visual feedback
  });
  
  // Mouse events for testing
  touchArea.addEventListener('mousedown', (e) => {
    touchActive = true;
    indicator.classList.add('active'); // Add visual feedback
    handleVerticalMouse(e, touchArea, indicator);
  });
  
  touchArea.addEventListener('mousemove', (e) => {
    if (touchActive) {
      handleVerticalMouse(e, touchArea, indicator);
    }
  });
  
  touchArea.addEventListener('mouseup', () => {
    touchActive = false;
    indicator.classList.remove('active'); // Remove visual feedback
  });
  
  touchArea.addEventListener('mouseleave', () => {
    touchActive = false;
    indicator.classList.remove('active'); // Remove visual feedback
  });
}

function handleVerticalTouch(touch, touchArea, indicator) {
  const rect = touchArea.getBoundingClientRect();
  const y = touch.clientY - rect.top;
  const height = rect.height;
  
  // Calculate normalized position (0 at top, 1 at bottom)
  currentPosition = Math.max(0, Math.min(1, y / height));
  
  // Immediately update visual indicator (client-side prediction)
  updatePaddleIndicator(indicator, currentPosition, height, true);
  
  // IMMEDIATE position send for ultra-low latency
  sendPositionImmediate();
  
  // Haptic feedback for responsive feel
  if ('vibrate' in navigator) {
    navigator.vibrate(1); // Micro-vibration for touch feedback
  }
}

function handleVerticalMouse(e, touchArea, indicator) {
  const rect = touchArea.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;
  
  currentPosition = Math.max(0, Math.min(1, y / height));
  
  // Immediately update visual indicator (client-side prediction)
  updatePaddleIndicator(indicator, currentPosition, height, true);
  
  // IMMEDIATE position send for ultra-low latency
  sendPositionImmediate();
  
  // Haptic feedback for responsive feel
  if ('vibrate' in navigator) {
    navigator.vibrate(1); // Micro-vibration for touch feedback
  }
}

// Horizontal Touch Control (Players 3 & 4)
function setupHorizontalTouch() {
  const touchArea = horizontalController;
  const indicator = paddleIndicatorH;
  
  // Touch events
  touchArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchActive = true;
    indicator.classList.add('active'); // Add visual feedback
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
    indicator.classList.remove('active'); // Remove visual feedback
  });
  
  // Mouse events for testing
  touchArea.addEventListener('mousedown', (e) => {
    touchActive = true;
    indicator.classList.add('active'); // Add visual feedback
    handleHorizontalMouse(e, touchArea, indicator);
  });
  
  touchArea.addEventListener('mousemove', (e) => {
    if (touchActive) {
      handleHorizontalMouse(e, touchArea, indicator);
    }
  });
  
  touchArea.addEventListener('mouseup', () => {
    touchActive = false;
    indicator.classList.remove('active'); // Remove visual feedback
  });
  
  touchArea.addEventListener('mouseleave', () => {
    touchActive = false;
    indicator.classList.remove('active'); // Remove visual feedback
  });
}

function handleHorizontalTouch(touch, touchArea, indicator) {
  const rect = touchArea.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const width = rect.width;
  
  // Calculate normalized position (0 at left, 1 at right)
  currentPosition = Math.max(0, Math.min(1, x / width));
  
  // Immediately update visual indicator (client-side prediction)
  updatePaddleIndicator(indicator, currentPosition, width, false);
  
  // IMMEDIATE position send for ultra-low latency
  sendPositionImmediate();
  
  // Haptic feedback for responsive feel
  if ('vibrate' in navigator) {
    navigator.vibrate(1); // Micro-vibration for touch feedback
  }
}

function handleHorizontalMouse(e, touchArea, indicator) {
  const rect = touchArea.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const width = rect.width;
  
  currentPosition = Math.max(0, Math.min(1, x / width));
  
  // Immediately update visual indicator (client-side prediction)
  updatePaddleIndicator(indicator, currentPosition, width, false);
  
  // IMMEDIATE position send for ultra-low latency
  sendPositionImmediate();
  
  // Haptic feedback for responsive feel
  if ('vibrate' in navigator) {
    navigator.vibrate(1); // Micro-vibration for touch feedback
  }
}

// BeanPong paddle indicator update function
function updatePaddleIndicator(indicator, position, containerSize, isVertical) {
  const indicatorSize = 100;
  
  if (isVertical) {
    // Vertical movement (players 1 & 2)
    const maxTop = containerSize - indicatorSize;
    indicator.style.top = (position * maxTop) + 'px';
    indicator.style.marginTop = '0';
  } else {
    // Horizontal movement (players 3 & 4) 
    const maxLeft = containerSize - indicatorSize;
    indicator.style.left = (position * maxLeft) + 'px';
    indicator.style.marginLeft = '0';
  }
}

// Immediate position update for ultra-low latency
function sendPositionImmediate() {
  if (joinedRoom && currentPosition !== null) {
    const inputData = {
      room: joinedRoom,
      position: currentPosition,
      player: playerNumber,
      timestamp: Date.now() // Add timestamp for latency tracking
    };
    
    // Try WebRTC first for ultra-low latency
    if (useWebRTC && hybridConnection) {
      const sent = hybridConnection.sendInput(inputData);
      if (sent) {
        // WebRTC successful, no need for socket fallback
        return;
      }
    }
    
    // Fallback to socket.io
    socket.emit('input', inputData);
  }
}

// Send Position Updates - Optimized for real-time gaming
function startPositionUpdates() {
  // Send position at 144 FPS for maximum responsiveness (gaming monitor standard)
  if (sendInterval) clearInterval(sendInterval);
  sendInterval = setInterval(() => {
    sendPositionImmediate();
  }, 7); // ~144 FPS for ultra-responsive gaming
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

socket.on('roomUpdate', (data) => {
  if (!data) return;
  
  // Store room data globally for access by start button
  window.currentRoomData = data;
  
  // Only update start button for player 1
  if (playerNumber !== 1) return;
  
  // Calculate ready players
  let readyCount = 0;
  data.readyStates.forEach(ready => {
    if (ready) readyCount++;
  });
  
  // Enable start button if 2+ players are ready
  const canStart = readyCount >= 2;
  startGameBtnController.disabled = !canStart;
  
  if (canStart) {
    if (readyCount === 5) {
      startGameBtnController.textContent = '🌟 START BEAN PENTAGON';
    } else {
      startGameBtnController.textContent = `START ${readyCount} PLAYER BEANPONG`;
    }
  } else {
    startGameBtnController.textContent = 'WAITING FOR PLAYERS...';
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

socket.on('startGame', () => {
  // Transition non-host players to game screen when game starts
  if (playerNumber !== 1) {
    readyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
  }
  
  // Show scroll hint for all players
  showScrollHint();
  
  // Haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 50, 50, 200]);
  }
});

socket.on('speedWarning', ({ newSpeed }) => {
  // Vibrate and play warning sound
  if ('vibrate' in navigator) {
    navigator.vibrate([100, 50, 100]);
  }
  playControllerSound(440, 0.15, 0.06);
  
  // Show brief overlay
  showSpeedWarningOverlay(newSpeed);
});

socket.on('speedIncreased', ({ newSpeed }) => {
  // Vibrate confirmation
  if ('vibrate' in navigator) {
    navigator.vibrate([50, 50, 200]);
  }
  playControllerSound(660, 0.2, 0.08);
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

// Update controller hint text based on player number
function updateControllerHint() {
  const verticalHint = document.querySelector('#verticalController .touch-hint');
  const horizontalHint = document.querySelector('#horizontalController .touch-hint');
  
  if (playerNumber === 5) {
    // Pentagon mode - radial movement
    if (verticalHint) {
      verticalHint.textContent = 'SLIDE IN & OUT';
    }
  } else if (playerNumber <= 2) {
    // Vertical movement
    if (verticalHint) {
      verticalHint.textContent = 'SLIDE UP & DOWN';
    }
  } else {
    // Horizontal movement
    if (horizontalHint) {
      horizontalHint.textContent = 'SLIDE LEFT & RIGHT';
    }
  }
}

// Show scroll hint when game starts
function showScrollHint() {
  let hintOverlay = document.getElementById('scrollHintOverlay');
  if (!hintOverlay) {
    hintOverlay = document.createElement('div');
    hintOverlay.id = 'scrollHintOverlay';
    hintOverlay.style.cssText = `
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
    document.body.appendChild(hintOverlay);
  }
  
  let controlText, icon;
  
  // Check if we're in pentagon mode (5 players)
  const isPentagonMode = window.currentRoomData && 
                        window.currentRoomData.readyStates && 
                        window.currentRoomData.readyStates.filter(ready => ready).length === 5;
  
  if (isPentagonMode && playerNumber === 5) {
    controlText = 'SCROLL IN & OUT';
    icon = '🌟';
  } else if (playerNumber <= 2) {
    controlText = 'SCROLL UP & DOWN';
    icon = '↕️';
  } else {
    controlText = 'SCROLL LEFT & RIGHT';
    icon = '↔️';
  }
  
  hintOverlay.innerHTML = `
    <div style="
      text-align: center;
      color: #ffffff;
      animation: fadeInScale 0.5s ease-out;
    ">
      <div style="font-size: 64px; margin-bottom: 16px;">${icon}</div>
      <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
        ${controlText}
      </div>
      <div style="font-size: 16px; opacity: 0.8;">
        to control your paddle
      </div>
    </div>
    <style>
      @keyframes fadeInScale {
        0% { transform: scale(0.8); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
    </style>
  `;
  
  hintOverlay.style.display = 'flex';
  
  // Hide hint after 3 seconds
  setTimeout(() => {
    hintOverlay.style.animation = 'fadeInScale 0.5s ease-out reverse';
    setTimeout(() => {
      if (hintOverlay.parentNode) {
        hintOverlay.parentNode.removeChild(hintOverlay);
      }
    }, 500);
  }, 3000);
}

// Show speed warning overlay for controllers
function showSpeedWarningOverlay(newSpeed) {
  let warningOverlay = document.getElementById('speedWarningOverlay');
  if (!warningOverlay) {
    warningOverlay = document.createElement('div');
    warningOverlay.id = 'speedWarningOverlay';
    warningOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 165, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      pointer-events: none;
    `;
    document.body.appendChild(warningOverlay);
  }
  
  warningOverlay.innerHTML = `
    <div style="
      text-align: center;
      color: #ffffff;
      animation: pulseWarning 0.5s ease-in-out infinite;
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">
        SPEED INCREASING
      </div>
      <div style="font-size: 16px;">
        New speed: ${newSpeed.toFixed(1)}x
      </div>
    </div>
    <style>
      @keyframes pulseWarning {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    </style>
  `;
  
  warningOverlay.style.display = 'flex';
  
  // Hide warning after 2.5 seconds
  setTimeout(() => {
    if (warningOverlay.parentNode) {
      warningOverlay.parentNode.removeChild(warningOverlay);
    }
  }, 2500);
}

// Enter key to join
roomInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

// Retry connection button
const retryBtn = document.getElementById('retryConnection');
if (retryBtn) {
  retryBtn.addEventListener('click', retryConnection);
}