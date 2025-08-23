const socket = io();

// Initialize and register TV when ready
function initializeTV() {
  console.log('🔌 Initializing TV connection...');
  initializePremiumElements();
  socket.emit('registerTV');
}

// Ensure DOM is ready before registering TV
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🔌 DOM ready, initializing TV...');
    initializeTV();
  });
} else {
  console.log('🔌 DOM already ready, initializing TV immediately...');
  initializeTV();
}

// DOM Elements - Legacy and New Premium Card
const codeEl = document.getElementById('code'); // Legacy support
const plist = document.getElementById('plist');
const playerCount = document.getElementById('playerCount');

// Premium Mission Card Elements - with safety checks
let roomCodeText, connectionStatus, qrImage, qrErrorState;
let copyCodeBtn, refreshQRBtn, retryQRBtn, refreshSessionBtn;

// Initialize elements when DOM is ready
function initializePremiumElements() {
  roomCodeText = document.getElementById('roomCodeText');
  connectionStatus = document.getElementById('connectionStatus');
  qrImage = document.getElementById('qrImage');
  qrErrorState = document.getElementById('qrErrorState');
  copyCodeBtn = document.getElementById('copyCodeBtn');
  refreshQRBtn = document.getElementById('refreshQR');
  retryQRBtn = document.getElementById('retryQR');
  refreshSessionBtn = document.getElementById('refreshSession');
  
  console.log('🔍 Premium elements initialized:', {
    roomCodeText: !!roomCodeText,
    connectionStatus: !!connectionStatus,
    qrImage: !!qrImage,
    qrErrorState: !!qrErrorState,
    copyCodeBtn: !!copyCodeBtn,
    refreshQRBtn: !!refreshQRBtn,
    retryQRBtn: !!retryQRBtn,
    refreshSessionBtn: !!refreshSessionBtn
  });
}

// UI Views
const gameSelection = document.getElementById('gameSelection');
const braincellCollection = document.getElementById('braincellCollection');
const gameControls = document.getElementById('gameControls');
const gameScreen = document.getElementById('gameScreen');

// Controls
const startBtn = document.getElementById('startBtn');
const roundsSelect = document.getElementById('roundsSelect');
const selectedGameTitle = document.getElementById('selectedGameTitle');
const selectedGameDesc = document.getElementById('selectedGameDesc');
const gameRequirements = document.getElementById('gameRequirements');

let hub = null;
let selectedGame = null;
let currentGameScores = {}; // Track current game scores

// Function to create a scores header for games
function createScoresHeader(scores, title) {
  if (!scores || Object.keys(scores).length === 0) return '';
  
  const scoresHTML = Object.entries(scores)
    .sort(([,a], [,b]) => b - a)
    .map(([pid, score], idx) => {
      const player = hub.players.find(p => p.pid === pid);
      return `
        <div class="score-item">
          ${avatarHTML(player?.name || 'Player', idx)}
          <span class="score-name">${player?.name || 'Player'}</span>
          <span class="score-value">${score}</span>
        </div>
      `;
    }).join('');

  return `
    <div class="scores-header">
      <div class="scores-title">${title} - Live Scores</div>
      <div class="scores-list">
        ${scoresHTML}
      </div>
    </div>
  `;
}

// Game metadata
const gameInfo = {
  'party.quick-quiz': { title: 'Quick Quiz Royale', desc: 'Fast-paced general knowledge showdown' },
  'party.finish-phrase': { title: 'Finish the Phrase', desc: 'Complete popular sayings and expressions' },
  'party.fact-fiction': { title: 'Fact or Fiction?', desc: 'Separate the real facts from clever fiction' },
  'party.phone-confessions': { title: 'Phone Confessions', desc: 'Navigate modern digital dilemmas' },
  'party.answer-roulette': { title: 'Answer Roulette', desc: 'High-stakes knowledge gambling game' },
  'party.lie-detector': { title: 'Lie Detector', desc: 'Uncover truth from elaborate lies' },
  'party.buzzkill': { title: 'Buzzkill Bonus', desc: 'Double points lightning round' },
  'couples.how-good': { title: 'How Good Do You Know Me?', desc: 'Test your intimate partner knowledge' },
  'couples.survival': { title: "Couple's Survival", desc: 'Work together to overcome challenges' },
  'couples.finish-phrase': { title: 'Finish the Phrase (Love)', desc: 'Complete romantic sayings together' },
  'couples.relationship': { title: 'Relationship Roulette', desc: 'Random scenarios for couples' },
  'couples.secret-sync': { title: 'Secret Sync', desc: 'Think alike to score big points' }
};

// =====================================
// FORTUNE 500 GRADE QR CODE SYSTEM
// =====================================

class PremiumQRManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.currentCode = null;
    this.fallbackServices = [
      { name: 'QRServer', url: 'https://api.qrserver.com/v1/create-qr-code/?size=115x115&format=png&margin=8&data=' },
      { name: 'Google Charts', url: 'https://chart.googleapis.com/chart?chs=115x115&cht=qr&chl=' }
    ];
  }

  async generateQR(roomCode) {
    console.log(`🎯 PremiumQRManager: generateQR called with roomCode: "${roomCode}"`);
    
    if (!roomCode) {
      console.error('❌ PremiumQRManager: No room code provided');
      this.showErrorState('No room code available');
      return;
    }

    // Elements should be initialized by now, but double-check
    if (!qrImage || !qrErrorState) {
      console.error('❌ Critical: QR elements not found after initialization!', {
        qrImage: !!qrImage,
        qrErrorState: !!qrErrorState
      });
      return;
    }

    console.log(`🚀 Starting immediate QR generation for room code "${roomCode}"`);

    this.currentCode = roomCode;
    this.retryCount = 0;
    this.hideErrorState();
    
    try {
      await this.attemptQRGeneration(roomCode);
      console.log('✅ QR generation completed successfully');
    } catch (error) {
      console.error('❌ PremiumQRManager: QR generation failed:', error);
      this.showErrorState('QR generation failed');
    }
  }

  async attemptQRGeneration(roomCode) {
    const timestamp = Date.now();
    const primaryURL = `/api/qr/png?roomId=${encodeURIComponent(roomCode)}&sz=115&v=${timestamp}`;
    
    console.log(`📡 Attempting server-side QR: ${primaryURL}`);
    
    try {
      const success = await this.loadQRImage(primaryURL, 'Server');
      if (success) {
        this.updateConnectionStatus('QR Ready', 'success');
        return;
      }
    } catch (error) {
      console.warn('Server QR failed, trying fallbacks:', error);
    }

    // Try fallback services
    await this.tryFallbackServices(roomCode);
  }

  async tryFallbackServices(roomCode) {
    const controllerURL = `${location.origin}/controller?room=${roomCode}`;
    
    for (const service of this.fallbackServices) {
      if (this.retryCount >= this.maxRetries) break;
      
      this.retryCount++;
      const fallbackURL = service.url + encodeURIComponent(controllerURL);
      
      console.log(`🔄 Trying ${service.name} (attempt ${this.retryCount}):`, fallbackURL);
      
      try {
        const success = await this.loadQRImage(fallbackURL, service.name);
        if (success) {
          this.updateConnectionStatus(`QR Ready (${service.name})`, 'success');
          return;
        }
      } catch (error) {
        console.warn(`${service.name} failed:`, error);
        await this.delay(this.retryDelay);
      }
    }

    // All attempts failed
    this.showErrorState('All QR services failed');
    this.updateConnectionStatus('QR Failed', 'error');
  }

  loadQRImage(url, source) {
    return new Promise((resolve, reject) => {
      console.log(`🔍 loadQRImage called - Source: ${source}, URL: ${url}`);
      
      if (!qrImage) {
        console.error('❌ QR image element not found!');
        reject(new Error('QR image element not found'));
        return;
      }

      console.log('📷 QR image element found, creating new Image...');
      const img = new Image();
      
      // Remove crossOrigin for local requests
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.log('🏠 Local URL detected, skipping crossOrigin');
      } else {
        img.crossOrigin = 'anonymous';
        console.log('🌐 External URL detected, setting crossOrigin');
      }
      
      const timeout = setTimeout(() => {
        console.error(`⏱️ ${source} QR load timeout after 8 seconds`);
        reject(new Error(`${source} QR load timeout`));
      }, 8000);

      img.onload = () => {
        console.log(`🎉 ${source} Image onload fired - Size: ${img.width}x${img.height}`);
        clearTimeout(timeout);
        qrImage.src = url;
        console.log(`✅ ${source} QR loaded successfully and set to qrImage`);
        resolve(true);
      };

      img.onerror = (event) => {
        console.error(`❌ ${source} Image onerror fired:`, event);
        clearTimeout(timeout);
        reject(new Error(`${source} QR load error`));
      };

      console.log(`🚀 Starting image load for ${source}...`);
      img.src = url;
    });
  }

  hideErrorState() {
    if (qrErrorState) qrErrorState.style.display = 'none';
    if (qrImage) qrImage.style.display = 'block';
  }

  showErrorState(message) {
    if (qrImage) qrImage.style.display = 'none';
    if (qrErrorState) {
      qrErrorState.style.display = 'flex';
      const errorText = qrErrorState.querySelector('.error-text');
      if (errorText) errorText.textContent = message;
    }
  }

  updateConnectionStatus(text, type = 'default') {
    if (connectionStatus) {
      connectionStatus.textContent = text;
      connectionStatus.className = `stat-text ${type}`;
    }
  }

  async retry() {
    if (this.currentCode) {
      console.log('🔄 Manual QR retry triggered');
      await this.generateQR(this.currentCode);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize Premium QR Manager
const qrManager = new PremiumQRManager();

// Legacy function for backward compatibility
function generateQR(code) {
  qrManager.generateQR(code);
}

// Player management
function playerColor(idx) {
  const colors = ['#ff2b2b', '#ffffff', '#ffd166', '#6ec1ff', '#6EFF9D', '#ff6b9d', '#c77dff', '#7209b7'];
  return colors[idx % colors.length];
}

function avatarHTML(name, idx) {
  const letter = (name || '?').trim()[0]?.toUpperCase() || '?';
  const color = playerColor(idx);
  return `<span class="avatar" style="background:${color};color:#000">${letter}</span>`;
}

function updatePlayersList(players) {
  playerCount.textContent = players.length;
  plist.innerHTML = '';
  
  if (players.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'hall-footer';
    emptyState.innerHTML = '<span class="footer-text">Waiting for legends to join...</span>';
    plist.appendChild(emptyState);
    return;
  }
  
  players.forEach((player, idx) => {
    const chip = document.createElement('div');
    chip.className = `legend-card ${player.ready ? 'ready' : ''}`;
    chip.innerHTML = `
      <div class="legend-avatar" style="background: ${playerColor(idx)};">${avatarHTML(player.name, idx)}</div>
      <div class="legend-info">
        <div class="legend-name">${player.name}</div>
        <div class="legend-status ${player.ready ? 'ready' : ''}">${player.ready ? 'Ready for Battle' : 'Preparing...'}</div>
      </div>
    `;
    plist.appendChild(chip);
  });
}

// Navigation
function showView(viewName) {
  console.log('TV: showView called with:', viewName);
  console.log('TV: DOM elements check:', {
    gameSelection: !!gameSelection,
    braincellCollection: !!braincellCollection,
    gameScreen: !!gameScreen
  });
  
  gameSelection.classList.toggle('hidden', viewName !== 'selection');
  braincellCollection.classList.toggle('hidden', viewName !== 'collection');
  gameScreen.classList.toggle('hidden', viewName !== 'game');
  
  console.log('TV: View classes after toggle:', {
    gameSelectionHidden: gameSelection.classList.contains('hidden'),
    braincellCollectionHidden: braincellCollection.classList.contains('hidden'),
    gameScreenHidden: gameScreen.classList.contains('hidden')
  });
}

function updateGameControls() {
  if (!selectedGame || !hub) {
    gameControls.classList.add('hidden');
    return;
  }
  
  const info = gameInfo[selectedGame];
  const availability = hub.availability[selectedGame];
  const playerCount = hub.players.length;
  
  selectedGameTitle.textContent = info.title;
  selectedGameDesc.textContent = info.desc;
  
  // Check if we can start the game
  const canStart = playerCount >= availability.min && playerCount <= availability.max;
  startBtn.disabled = !canStart;
  
  if (canStart) {
    gameRequirements.textContent = `Ready to start with ${playerCount} players`;
    gameRequirements.style.color = '#6EFF9D';
  } else if (playerCount < availability.min) {
    gameRequirements.textContent = `Need ${availability.min - playerCount} more players (min: ${availability.min})`;
    gameRequirements.style.color = '#ff6b6b';
  } else {
    gameRequirements.textContent = `Too many players (max: ${availability.max})`;
    gameRequirements.style.color = '#ff6b6b';
  }
  
  gameControls.classList.remove('hidden');
}

// =====================================
// PREMIUM CARD EVENT LISTENERS
// =====================================

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOMContentLoaded fired - setting up event listeners...');
  
  // Premium card button listeners
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', copyRoomCode);
  }
  
  if (refreshQRBtn) {
    refreshQRBtn.addEventListener('click', () => {
      if (hub?.code) {
        qrManager.generateQR(hub.code);
      }
    });
  }
  
  if (retryQRBtn) {
    retryQRBtn.addEventListener('click', () => {
      qrManager.retry();
    });
  }
  
  if (refreshSessionBtn) {
    refreshSessionBtn.addEventListener('click', refreshHub);
  }
  // Main game card click - The Last Braincell
  document.querySelector('[data-action=\"show-braincell\"]')?.addEventListener('click', () => {
    showView('collection');
    tvState.currentView = 'collection';
    tvState.selectedCategory = 0; // Show party games
    tvState.selectedGame = -1;
    updateTVHighlight();
  });
  
  // Love's Proving Ground click
  document.querySelector('[data-action=\"show-couples\"]')?.addEventListener('click', () => {
    showView('collection');
    tvState.currentView = 'collection';
    tvState.selectedCategory = 1; // Show couples games
    tvState.selectedGame = -1;
    updateTVHighlight();
  });
  
  // Back button
  document.querySelector('[data-action=\"back-to-selection\"]')?.addEventListener('click', () => {
    showView('selection');
    selectedGame = null;
    gameControls.classList.add('hidden');
  });
  
  // Coming soon buttons
  document.querySelectorAll('[data-action=\"coming-soon\"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Add some feedback for coming soon
      const rect = btn.getBoundingClientRect();
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: ${rect.top - 40}px;
        left: ${rect.left + rect.width/2}px;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        pointer-events: none;
      `;
      toast.textContent = 'Coming Soon!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    });
  });
  
  // Battle card selection
  document.querySelectorAll('.battle-card[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      // Remove previous selection
      document.querySelectorAll('.battle-card').forEach(c => c.classList.remove('card-selected'));
      
      // Select this card
      card.classList.add('card-selected');
      selectedGame = card.dataset.id;
      
      // Emit to server
      socket.emit('chooseGame', { id: selectedGame });
      
      // Update UI
      updateGameControls();
    });
  });
  
  // Start game button
  startBtn?.addEventListener('click', () => {
    const rounds = parseInt(roundsSelect.value) || 10;
    socket.emit('startGame', { rounds });
  });
});

// =====================================
// PREMIUM CARD FUNCTIONS  
// =====================================

function updatePremiumCard(state) {
  console.log('🔧 updatePremiumCard called with state:', {
    code: state.code,
    roomCodeText: !!roomCodeText
  });
  
  // Ensure roomCodeText element is available (fallback initialization)
  if (!roomCodeText) {
    console.log('🔄 Re-initializing roomCodeText element...');
    roomCodeText = document.getElementById('roomCodeText');
  }
  
  // Update room code in premium card
  if (roomCodeText && state.code) {
    console.log('📝 Setting room code text to:', state.code);
    roomCodeText.textContent = state.code;
  } else if (roomCodeText) {
    console.log('📝 No room code, showing placeholder');
    roomCodeText.textContent = '———';
  } else {
    console.error('❌ roomCodeText element still not found after retry!');
  }
  
  // Legacy support
  if (codeEl) {
    codeEl.textContent = state.code;
  }
  
  // Generate QR code exactly like manual refresh
  if (state.code) {
    
    // Ensure elements are properly initialized before QR generation
    if (!qrImage || !roomCodeText) {
      initializePremiumElements();
    }
    
    // Check if elements are ready after initialization
    const elementsReady = qrImage && roomCodeText && connectionStatus;
    // Check element readiness
    console.log('Elements ready:', {
      qrImage: !!qrImage,
      roomCodeText: !!roomCodeText,
      connectionStatus: !!connectionStatus,
      allReady: elementsReady
    });
    
    if (elementsReady) {
      // Generate QR immediately if elements are ready
      qrManager.generateQR(state.code);
      updateConnectionStatus('Connected', 'success');
    } else {
      // Wait a bit longer if elements still not ready
      setTimeout(() => {
        if (!qrImage) initializePremiumElements(); // One more try
        qrManager.generateQR(state.code);
        updateConnectionStatus('Connected', 'success');
      }, 200);
    }
  } else {
    updateConnectionStatus('Connecting...', 'loading');
  }
}

function updateConnectionStatus(text, type = 'default') {
  if (connectionStatus) {
    connectionStatus.textContent = text;
    connectionStatus.className = `stat-text ${type}`;
  }
}

// Copy room code functionality
async function copyRoomCode() {
  if (!hub?.code) return;
  
  try {
    await navigator.clipboard.writeText(hub.code);
    showToast('Room code copied!', 'success');
    
    // Visual feedback
    if (copyCodeBtn) {
      copyCodeBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        copyCodeBtn.style.transform = '';
      }, 150);
    }
  } catch (error) {
    console.error('Copy failed:', error);
    showToast('Copy failed', 'error');
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `premium-toast ${type}`;
  toast.textContent = message;
  
  // Add styles
  Object.assign(toast.style, {
    position: 'fixed',
    top: '24px',
    right: '24px',
    background: type === 'success' ? 'rgba(110, 255, 157, 0.1)' : 'rgba(255, 107, 107, 0.1)',
    border: type === 'success' ? '1px solid rgba(110, 255, 157, 0.3)' : '1px solid rgba(255, 107, 107, 0.3)',
    color: type === 'success' ? '#6EFF9D' : '#ff6b6b',
    padding: '12px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    zIndex: '10000',
    backdropFilter: 'blur(12px)',
    transform: 'translateY(-20px)',
    opacity: '0',
    transition: 'all 0.3s ease'
  });
  
  document.body.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Socket event handlers
socket.on('hubState', (state) => {
  const previousPlayerCount = hub ? hub.players.length : 0;
  const isFirstLoad = !hub; // Track if this is the first hubState received
  hub = state;
  
  console.log('Premium TV hubState received:', {
    roomCode: state.code,
    isFirstLoad,
    previousPlayerCount,
    currentPlayerCount: state.players.length,
    currentView: tvState.currentView,
    shouldAutoAdvance: previousPlayerCount === 0 && state.players.length >= 1,
    qrImageExists: !!document.getElementById('qrImage'),
    elementsReady: {
      roomCodeText: !!document.getElementById('roomCodeText'),
      qrImage: !!document.getElementById('qrImage'),
      qrErrorState: !!document.getElementById('qrErrorState')
    }
  });
  
  
  // Update premium mission card
  updatePremiumCard(state);
  
  // Update players list
  updatePlayersList(state.players);
  
  // Auto-advance to arena selection when first player joins
  if (previousPlayerCount === 0 && state.players.length >= 1) {
    console.log('TV: Auto-advancing to arena selection...');
    // Small delay for smooth transition
    setTimeout(() => {
      console.log('TV: Executing auto-advance, current view:', tvState.currentView);
      // Only advance if we're still on the selection view
      if (tvState.currentView === 'selection') {
        console.log('TV: Advancing to collection view...');
        // Directly call showView instead of relying on click event
        showView('collection');
        tvState.currentView = 'collection';
        tvState.selectedCategory = 0;
        tvState.selectedGame = -1;
        updateTVHighlight();
        console.log('TV: Auto-advance completed, new view:', tvState.currentView);
      } else {
        console.log('TV: Not on selection view, skipping auto-advance');
      }
    }, 1000); // 1 second delay for smooth transition
  }
  
  // Update game controls if a game is selected
  if (selectedGame) {
    updateGameControls();
  }
});

socket.on('gameSelected', ({ id, meta }) => {
  selectedGame = id;
  
  // Update selection in UI
  document.querySelectorAll('.battle-card').forEach(c => c.classList.remove('card-selected'));
  const selectedCard = document.querySelector(`[data-id=\"${id}\"]`);
  if (selectedCard) {
    selectedCard.classList.add('card-selected');
  }
  
  updateGameControls();
});

// Game event handlers
socket.on('preQuestion', (data) => {
  showView('game');
  // Reset scores if this is the first question
  if (data.idx === 1) {
    currentGameScores = {};
  }
  
  gameScreen.innerHTML = `
    <div class="game-header-controls">
      <button id="leaveGameBtn" class="leave-game-btn" title="Leave Game & Return to Lobby">
        <span class="leave-icon">🚪</span>
        <span class="leave-text">Leave Game</span>
      </button>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 32px;">
      <h1 style="font-size: 48px; margin-bottom: 16px; color: #fff;">${data.title}</h1>
      <p style="font-size: 24px; color: #bdbdbd; margin-bottom: 32px;">Question ${data.idx} of ${data.total}</p>
      <div style="font-size: 72px; margin-bottom: 24px;">🧠</div>
      <p style="font-size: 18px; color: #bdbdbd;">Get ready...</p>
    </div>
  `;
  
  // Add leave game functionality
  document.getElementById('leaveGameBtn')?.addEventListener('click', leaveGame);
});

socket.on('lbQuestion', (data) => {
  const timeLeft = Math.max(0, data.endsAt - Date.now());
  const scoresHeader = createScoresHeader(currentGameScores, data.title);
  
  gameScreen.innerHTML = `
    <div class="game-header-controls">
      <button id="leaveGameBtn" class="leave-game-btn" title="Leave Game & Return to Lobby">
        <span class="leave-icon">🚪</span>
        <span class="leave-text">Leave Game</span>
      </button>
    </div>
    ${scoresHeader}
    <div style="padding: 32px; max-width: 1200px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 36px; margin-bottom: 8px; color: #fff;">${data.title} ${data.isLightning ? '⚡' : ''}</h1>
        ${data.isLightning ? '<div style="color: #ffd166; font-size: 18px; font-weight: 600; margin-bottom: 8px;">⚡ LIGHTNING ROUND - DOUBLE POINTS! ⚡</div>' : ''}
        <p style="font-size: 18px; color: #bdbdbd;">Question ${data.idx} of ${data.total}</p>
        <div class="timerbar" style="margin: 16px auto; max-width: 400px;">
          <div class="fill" id="timerFill"></div>
        </div>
      </div>
      
      <div style="background: var(--premium-gradient); border-radius: 20px; padding: 32px; margin-bottom: 24px; border: var(--border-premium);">
        <h2 style="font-size: 28px; margin-bottom: 24px; text-align: center; color: #fff;">${data.q.q}</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">A) ${data.q.A}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">B) ${data.q.B}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">C) ${data.q.C}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">D) ${data.q.D}</div>
        </div>
      </div>
    </div>
  `;
  
  // Add leave game functionality
  document.getElementById('leaveGameBtn')?.addEventListener('click', leaveGame);
});

socket.on('timer', ({ left, total }) => {
  const fill = document.getElementById('timerFill');
  if (fill) {
    const percentage = (left / total) * 100;
    fill.style.width = `${percentage}%`;
  }
});

socket.on('lbReveal', (data) => {
  // Update current game scores
  currentGameScores = data.scores || {};
  
  const correct = data.correct;
  const options = document.querySelectorAll('.cosmic-option');
  
  // Highlight correct answer
  options.forEach((opt, idx) => {
    const letter = ['A', 'B', 'C', 'D'][idx];
    if (letter === correct) {
      opt.classList.add('option-correct');
    }
  });
  
  // Show scores
  setTimeout(() => {
    const scoresHTML = Object.entries(data.scores)
      .sort(([,a], [,b]) => b - a)
      .map(([pid, score], idx) => {
        const player = hub.players.find(p => p.pid === pid);
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--glass-strong); border-radius: 12px; margin: 8px 0;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${avatarHTML(player?.name || 'Player', idx)}
              <span style="font-weight: 600;">${player?.name || 'Player'}</span>
            </div>
            <span style="font-size: 18px; font-weight: 700; color: #6EFF9D;">${score}</span>
          </div>
        `;
      }).join('');
    
    gameScreen.innerHTML += `
      <div style="background: var(--premium-gradient); border-radius: 20px; padding: 24px; margin: 24px 32px; border: var(--border-premium);">
        <h3 style="text-align: center; margin-bottom: 16px; color: #fff;">Current Scores</h3>
        ${scoresHTML}
      </div>
    `;
  }, 1000);
});

socket.on('lbGameOver', (data) => {
  const winner = Object.entries(data.scores).sort(([,a], [,b]) => b - a)[0];
  const winnerPlayer = hub.players.find(p => p.pid === winner[0]);
  
  gameScreen.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 32px;">
      <div style="font-size: 120px; margin-bottom: 24px;">🏆</div>
      <h1 style="font-size: 48px; margin-bottom: 16px; color: #fff;">Game Over!</h1>
      <div style="font-size: 64px; margin-bottom: 16px;">${avatarHTML(winnerPlayer?.name || 'Winner', 0)}</div>
      <h2 style="font-size: 32px; margin-bottom: 8px; color: #6EFF9D;">${winnerPlayer?.name || 'Winner'} Wins!</h2>
      <p style="font-size: 24px; color: #bdbdbd; margin-bottom: 32px;">Final Score: ${winner[1]} points</p>
      
      <button onclick="location.reload()" style="background: var(--accent); border: none; border-radius: 12px; padding: 16px 32px; color: #000; font-weight: 700; font-size: 18px; cursor: pointer;">
        Play Again
      </button>
    </div>
  `;
});

// Couples game events (similar structure but different layout)
socket.on('csSelf', (data) => {
  const scoresHeader = createScoresHeader(currentGameScores, 'Couples Mode');
  
  gameScreen.innerHTML = `
    <div class="game-header-controls">
      <button id="leaveGameBtn" class="leave-game-btn" title="Leave Game & Return to Lobby">
        <span class="leave-icon">🚪</span>
        <span class="leave-text">Leave Game</span>
      </button>
    </div>
    ${scoresHeader}
    <div style="padding: 32px; max-width: 800px; margin: 0 auto; text-align: center;">
      <h1 style="font-size: 36px; margin-bottom: 8px; color: #fff;">Your Answer</h1>
      <p style="font-size: 18px; color: #bdbdbd; margin-bottom: 16px;">Question ${data.idx} of ${data.total}</p>
      <div class="timerbar" style="margin: 16px auto; max-width: 400px;">
        <div class="fill" id="timerFill"></div>
      </div>
      
      <div style="background: var(--premium-gradient); border-radius: 20px; padding: 32px; margin: 24px 0; border: var(--border-premium);">
        <h2 style="font-size: 24px; margin-bottom: 24px; color: #fff;">${data.q.q}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">A) ${data.q.A}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">B) ${data.q.B}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">C) ${data.q.C}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">D) ${data.q.D}</div>
        </div>
      </div>
      
      <p style="color: #ff6b9d; font-size: 16px;">💝 Answer for yourself AND guess your partner's choice!</p>
    </div>
  `;
  
  // Add leave game functionality
  document.getElementById('leaveGameBtn')?.addEventListener('click', leaveGame);
});

socket.on('csGuess', (data) => {
  gameScreen.innerHTML = `
    <div style="padding: 32px; max-width: 800px; margin: 0 auto; text-align: center;">
      <h1 style="font-size: 36px; margin-bottom: 8px; color: #fff;">Guess Your Partner</h1>
      <p style="font-size: 18px; color: #bdbdbd; margin-bottom: 16px;">Question ${data.idx} of ${data.total}</p>
      <div class="timerbar" style="margin: 16px auto; max-width: 400px;">
        <div class="fill" id="timerFill"></div>
      </div>
      
      <div style="background: var(--premium-gradient); border-radius: 20px; padding: 32px; margin: 24px 0; border: var(--border-premium);">
        <h2 style="font-size: 24px; margin-bottom: 24px; color: #fff;">${data.q.q}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">A) ${data.q.A}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">B) ${data.q.B}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">C) ${data.q.C}</div>
          <div class="cosmic-option" style="text-align: center; font-size: 18px; font-weight: 600;">D) ${data.q.D}</div>
        </div>
      </div>
      
      <p style="color: #ff6b9d; font-size: 16px;">💭 What do you think your partner chose?</p>
    </div>
  `;
});

socket.on('csReveal', (data) => {
  // Update current game scores
  currentGameScores = data.scores || {};
  
  const players = hub.players.slice(0, 2);
  const scoresHeader = createScoresHeader(currentGameScores, 'Couples Mode');
  
  gameScreen.innerHTML = `
    ${scoresHeader}
    <div style="padding: 32px; max-width: 1000px; margin: 0 auto; text-align: center;">
      <h1 style="font-size: 36px; margin-bottom: 24px; color: #fff;">Results</h1>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
        ${players.map((player, idx) => `
          <div style="background: var(--premium-gradient); border-radius: 16px; padding: 24px; border: var(--border-premium);">
            <div style="font-size: 48px; margin-bottom: 12px;">${avatarHTML(player.name, idx)}</div>
            <h3 style="margin-bottom: 16px; color: #fff;">${player.name}</h3>
            <p style="margin: 8px 0; color: #bdbdbd;">Their answer: <span style="color: #fff; font-weight: 700;">${data.picks[player.pid]?.self || 'No answer'}</span></p>
            <p style="margin: 8px 0; color: #bdbdbd;">Their guess: <span style="color: #fff; font-weight: 700;">${data.picks[player.pid]?.guess || 'No guess'}</span></p>
            <p style="font-size: 20px; font-weight: 700; color: #6EFF9D; margin-top: 16px;">${data.scores[player.pid] || 0} points</p>
          </div>
        `).join('')}
      </div>
      
      <div style="background: var(--premium-gradient); border-radius: 16px; padding: 24px; border: var(--border-premium);">
        <p style="font-size: 18px; color: #fff; margin-bottom: 8px;">No correct answer - couples mode!</p>
        <p style="font-size: 16px; color: #bdbdbd;">+5 points for matching your partner's choice</p>
      </div>
    </div>
  `;
});

socket.on('csGameOver', (data) => {
  const players = hub.players.slice(0, 2);
  const totalScore = Object.values(data.scores).reduce((a, b) => a + b, 0);
  
  gameScreen.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 32px;">
      <div style="font-size: 120px; margin-bottom: 24px;">💕</div>
      <h1 style="font-size: 48px; margin-bottom: 24px; color: #fff;">Couples Challenge Complete!</h1>
      
      <div style="display: flex; gap: 24px; margin-bottom: 32px;">
        ${players.map((player, idx) => `
          <div style="text-align: center;">
            <div style="font-size: 64px; margin-bottom: 8px;">${avatarHTML(player.name, idx)}</div>
            <h3 style="color: #fff; margin-bottom: 4px;">${player.name}</h3>
            <p style="font-size: 20px; font-weight: 700; color: #6EFF9D;">${data.scores[player.pid] || 0} points</p>
          </div>
        `).join('')}
      </div>
      
      <p style="font-size: 24px; color: #ff6b9d; margin-bottom: 32px;">Combined Score: ${totalScore} points</p>
      
      <button onclick="location.reload()" style="background: var(--accent); border: none; border-radius: 12px; padding: 16px 32px; color: #000; font-weight: 700; font-size: 18px; cursor: pointer;">
        Play Again
      </button>
    </div>
  `;
});

// Handle reconnection and snapshots
socket.on('restoreSnapshot', (snapshot) => {
  if (snapshot?.kind === 'trivia') {
    showView('game');
    // Restore game state would go here
  }
});

// Error handling
socket.on('toast', ({ msg }) => {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    background: rgba(255,43,43,0.9);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
});

// Initialize
console.log('TV: Initializing, current tvState:', tvState);
console.log('TV: DOM elements available:', {
  gameSelection: !!gameSelection,
  braincellCollection: !!braincellCollection,
  gameScreen: !!gameScreen
});
showView('selection');
// Initialize highlight after a short delay to ensure DOM is ready
setTimeout(() => {
  updateTVHighlight();
  console.log('TV: Initialization complete');
}, 100);

// Refresh Hub button functionality
document.getElementById('refreshHub')?.addEventListener('click', refreshHub);

// Manual Enter Arena button functionality
document.getElementById('manualEnterArena')?.addEventListener('click', () => {
  console.log('Manual arena entry via ID clicked');
  showView('collection');
  tvState.currentView = 'collection';
  tvState.selectedCategory = 0;
  tvState.selectedGame = -1;
  updateTVHighlight();
});

function refreshHub() {
  console.log('🔄 Premium Hub Refresh initiated');
  
  // Show loading state on premium card
  if (refreshSessionBtn) {
    const originalContent = refreshSessionBtn.innerHTML;
    refreshSessionBtn.innerHTML = `
      <div class="btn-content">
        <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
        <span class="btn-text">Refreshing...</span>
      </div>
    `;
    refreshSessionBtn.disabled = true;
    
    // Restore button after delay
    setTimeout(() => {
      refreshSessionBtn.innerHTML = originalContent;
      refreshSessionBtn.disabled = false;
    }, 2000);
  }
  
  // Update premium card states
  if (roomCodeText) {
    roomCodeText.textContent = '———';
  }
  
  // Legacy support
  if (codeEl) {
    codeEl.textContent = '———';
  }
  
  // Clear QR error state
  qrManager.hideErrorState();
  updateConnectionStatus('Refreshing session...', 'loading');
  
  // Reset game state
  selectedGame = null;
  currentGameScores = {};
  tvState = {
    currentView: 'selection',
    selectedCategory: 0,
    selectedGame: -1,
    inGameControls: false
  };
  
  // Clear any game controls
  gameControls.classList.add('hidden');
  
  // Return to selection view
  showView('selection');
  updateTVHighlight();
  
  // Emit hub refresh to server
  socket.emit('refreshHub');
  
  // Show success toast
  setTimeout(() => {
    showToast('Session refreshed successfully!', 'success');
  }, 1000);
}

// Leave Game functionality for TV
function leaveGame() {
  // Show confirmation
  const confirmed = confirm('Are you sure you want to leave this game and return to the lobby?');
  if (!confirmed) return;
  
  // Reset game state
  selectedGame = null;
  currentGameScores = {};
  tvState = {
    currentView: 'selection',
    selectedCategory: 0,
    selectedGame: -1,
    inGameControls: false
  };
  
  // Clear any game controls and return to selection view
  gameControls.classList.add('hidden');
  showView('selection');
  updateTVHighlight();
  
  // Emit leave game to server
  socket.emit('leaveGame');
}

// TV Navigation System - Handle controller input
let tvState = {
  currentView: 'selection', // 'selection', 'collection', 'game'
  selectedCategory: 0, // For collection view
  selectedGame: -1, // For collection view
  inGameControls: false,
  selectedGateway: 0 // 0 = braincell, 1 = couples (for selection view)
};

// Get game cards dynamically from the actual DOM
function getGameCards() {
  const partyCards = Array.from(document.querySelectorAll('.battleground-sector:first-child .battle-card'));
  const couplesCards = Array.from(document.querySelectorAll('.battleground-sector:last-child .battle-card'));
  return [
    { key: 'party', title: 'Party Legends Arena', cards: partyCards },
    { key: 'couples', title: 'Love\'s Proving Ground', cards: couplesCards }
  ];
}

function updateTVHighlight() {
  // Remove all existing highlights
  document.querySelectorAll('.tv-highlighted').forEach(el => el.classList.remove('tv-highlighted'));
  
  if (tvState.currentView === 'selection') {
    // Highlight the selected gateway
    const gateways = document.querySelectorAll('.epic-gateway');
    if (gateways[tvState.selectedGateway]) {
      gateways[tvState.selectedGateway].classList.add('tv-highlighted');
    }
  } else if (tvState.currentView === 'collection') {
    if (tvState.inGameControls) {
      // Highlight start button
      if (startBtn && !startBtn.disabled) {
        startBtn.classList.add('tv-highlighted');
      }
    } else {
      const categories = getGameCards();
      const currentCategory = categories[tvState.selectedCategory];
      
      if (tvState.selectedGame === -1) {
        // Highlighting battleground sector
        const battlegroundSectors = document.querySelectorAll('.battleground-sector');
        if (battlegroundSectors[tvState.selectedCategory]) {
          battlegroundSectors[tvState.selectedCategory].classList.add('tv-highlighted');
        }
      } else {
        // Highlighting specific game card
        if (currentCategory && currentCategory.cards[tvState.selectedGame]) {
          currentCategory.cards[tvState.selectedGame].classList.add('tv-highlighted');
        }
      }
    }
  }
}

socket.on('tvNavigate', ({ action, data }) => {
  if (action === 'navigate') {
    handleTVNavigation(data.direction);
  } else if (action === 'start') {
    // Trigger start game if valid
    if (selectedGame && startBtn && !startBtn.disabled) {
      startBtn.click();
    }
  }
});

function handleTVNavigation(direction) {
  if (tvState.currentView === 'selection') {
    const gateways = document.querySelectorAll('.epic-gateway');
    
    if (direction === 'left' && tvState.selectedGateway > 0) {
      tvState.selectedGateway--;
      updateTVHighlight();
    } else if (direction === 'right' && tvState.selectedGateway < gateways.length - 1) {
      tvState.selectedGateway++;
      updateTVHighlight();
    } else if (direction === 'select') {
      // Click the selected gateway
      if (gateways[tvState.selectedGateway]) {
        gateways[tvState.selectedGateway].click();
      }
    }
  } else if (tvState.currentView === 'collection') {
    const categories = getGameCards();
    
    if (direction === 'back') {
      if (tvState.inGameControls) {
        tvState.inGameControls = false;
        selectedGame = null;
        gameControls.classList.add('hidden');
      } else if (tvState.selectedGame !== -1) {
        tvState.selectedGame = -1;
      } else {
        // Actually click the back button
        const backBtn = document.querySelector('[data-action="back-to-selection"]');
        if (backBtn) {
          backBtn.click();
          tvState.currentView = 'selection';
        }
      }
    } else if (direction === 'up') {
      if (!tvState.inGameControls && tvState.selectedGame === -1) {
        tvState.selectedCategory = Math.max(0, tvState.selectedCategory - 1);
      } else if (tvState.selectedGame !== -1) {
        const currentCategory = categories[tvState.selectedCategory];
        tvState.selectedGame = Math.max(0, tvState.selectedGame - 1);
      }
    } else if (direction === 'down') {
      if (!tvState.inGameControls && tvState.selectedGame === -1) {
        tvState.selectedCategory = Math.min(categories.length - 1, tvState.selectedCategory + 1);
      } else if (tvState.selectedGame !== -1) {
        const currentCategory = categories[tvState.selectedCategory];
        if (currentCategory) {
          tvState.selectedGame = Math.min(currentCategory.cards.length - 1, tvState.selectedGame + 1);
        }
      }
    } else if (direction === 'right' && tvState.selectedGame === -1) {
      // Enter games for current category
      const currentCategory = categories[tvState.selectedCategory];
      if (currentCategory && currentCategory.cards.length > 0) {
        tvState.selectedGame = 0;
      }
    } else if (direction === 'left' && tvState.selectedGame !== -1) {
      // Go back to category selection
      tvState.selectedGame = -1;
    } else if (direction === 'select') {
      if (tvState.inGameControls) {
        // Actually click the start button
        if (startBtn && !startBtn.disabled) {
          startBtn.click();
        }
      } else if (tvState.selectedGame !== -1) {
        // Actually click the game card
        const currentCategory = categories[tvState.selectedCategory];
        if (currentCategory && currentCategory.cards[tvState.selectedGame]) {
          currentCategory.cards[tvState.selectedGame].click();
          tvState.inGameControls = true;
        }
      } else {
        // Select the current category (enter games for this category)
        const currentCategory = categories[tvState.selectedCategory];
        if (currentCategory && currentCategory.cards.length > 0) {
          tvState.selectedGame = 0;
        }
      }
    }
  }
  
  updateTVHighlight();
}