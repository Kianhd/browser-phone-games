const socket = io();
socket.emit('registerTV');

// DOM Elements
const codeEl = document.getElementById('code');
const qrEl = document.getElementById('qr');
const plist = document.getElementById('plist');
const playerCount = document.getElementById('playerCount');

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

// QR Code generation
function generateQR(code) {
  const controllerURL = `${location.origin}/controller`;
  const qrData = `${controllerURL}?room=${code}`;
  const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=png&margin=10&data=${encodeURIComponent(qrData)}`;
  
  // Add error handling for QR code
  qrEl.onload = () => {
    console.log('QR code loaded successfully');
  };
  qrEl.onerror = () => {
    console.log('QR code failed to load, trying backup service');
    // Backup QR service
    const backupURL = `https://chart.googleapis.com/chart?chs=240x240&cht=qr&chl=${encodeURIComponent(qrData)}`;
    qrEl.src = backupURL;
  };
  
  qrEl.src = qrURL;
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
    emptyState.className = 'players-hint';
    emptyState.textContent = 'Waiting for players to join...';
    plist.appendChild(emptyState);
    return;
  }
  
  players.forEach((player, idx) => {
    const chip = document.createElement('div');
    chip.className = `player-chip ${player.ready ? 'ready' : ''}`;
    chip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${avatarHTML(player.name, idx)}
        <span>${player.name}</span>
      </div>
      <span class="player-status">${player.ready ? 'Ready' : 'Waiting'}</span>
    `;
    plist.appendChild(chip);
  });
}

// Navigation
function showView(viewName) {
  gameSelection.classList.toggle('hidden', viewName !== 'selection');
  braincellCollection.classList.toggle('hidden', viewName !== 'collection');
  gameScreen.classList.toggle('hidden', viewName !== 'game');
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

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
  // Main game card click
  document.querySelector('[data-action=\"show-braincell\"]')?.addEventListener('click', () => {
    showView('collection');
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
  
  // Mode selection
  document.querySelectorAll('.mode-card[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      // Remove previous selection
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
      
      // Select this card
      card.classList.add('selected');
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

// Socket event handlers
socket.on('hubState', (state) => {
  hub = state;
  
  // Update room code and QR
  codeEl.textContent = state.code;
  generateQR(state.code);
  
  // Update players list
  updatePlayersList(state.players);
  
  // Update game controls if a game is selected
  if (selectedGame) {
    updateGameControls();
  }
});

socket.on('gameSelected', ({ id, meta }) => {
  selectedGame = id;
  
  // Update selection in UI
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
  const selectedCard = document.querySelector(`[data-id=\"${id}\"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
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
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">A) ${data.q.A}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">B) ${data.q.B}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">C) ${data.q.C}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">D) ${data.q.D}</div>
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
  const options = document.querySelectorAll('.optcard');
  
  // Highlight correct answer
  options.forEach((opt, idx) => {
    const letter = ['A', 'B', 'C', 'D'][idx];
    if (letter === correct) {
      opt.classList.add('correct');
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
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">A) ${data.q.A}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">B) ${data.q.B}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">C) ${data.q.C}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">D) ${data.q.D}</div>
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
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">A) ${data.q.A}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">B) ${data.q.B}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">C) ${data.q.C}</div>
          <div class="optcard" style="text-align: center; font-size: 18px; font-weight: 600;">D) ${data.q.D}</div>
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
showView('selection');
// Initialize highlight after a short delay to ensure DOM is ready
setTimeout(() => updateTVHighlight(), 100);

// Refresh Hub button functionality
document.getElementById('refreshHub')?.addEventListener('click', refreshHub);

function refreshHub() {
  // Show loading state
  const refreshBtn = document.getElementById('refreshHub');
  const originalText = refreshBtn?.innerHTML;
  if (refreshBtn) {
    refreshBtn.innerHTML = '<span class="refresh-icon">🔄</span><span class="refresh-text">Refreshing...</span>';
    refreshBtn.disabled = true;
  }
  
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
  
  // Emit hub refresh to server (clears players and resets everything)
  socket.emit('refreshHub');
  
  // Restore button after short delay
  setTimeout(() => {
    if (refreshBtn) {
      refreshBtn.innerHTML = originalText;
      refreshBtn.disabled = false;
    }
  }, 1500);
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
  inGameControls: false
};

// Get game cards dynamically from the actual DOM
function getGameCards() {
  const partyCards = Array.from(document.querySelectorAll('.category-section:first-child .mode-card'));
  const couplesCards = Array.from(document.querySelectorAll('.category-section:last-child .mode-card'));
  return [
    { key: 'party', title: 'Party / Friends', cards: partyCards },
    { key: 'couples', title: 'Couples', cards: couplesCards }
  ];
}

function updateTVHighlight() {
  // Remove all existing highlights
  document.querySelectorAll('.tv-highlighted').forEach(el => el.classList.remove('tv-highlighted'));
  
  if (tvState.currentView === 'selection') {
    // Highlight the braincell card
    const braincellCard = document.querySelector('[data-action="show-braincell"]');
    if (braincellCard) braincellCard.classList.add('tv-highlighted');
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
        // Highlighting category section
        const categorySections = document.querySelectorAll('.category-section');
        if (categorySections[tvState.selectedCategory]) {
          categorySections[tvState.selectedCategory].classList.add('tv-highlighted');
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
    if (direction === 'select') {
      // Actually click the braincell card
      const braincellCard = document.querySelector('[data-action="show-braincell"]');
      if (braincellCard) {
        braincellCard.click();
        tvState.currentView = 'collection';
        tvState.selectedCategory = 0;
        tvState.selectedGame = -1;
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