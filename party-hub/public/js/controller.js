const socket = io();
const screen = document.getElementById('screen');

let pid = localStorage.getItem('pid') || null;
let name = localStorage.getItem('name') || '';
let hubState = null;
let isHost = false;
let selectedGameIndex = 0;
let currentMenuSection = 'main'; // main, braincell, party, couples
let selectedCategoryIndex = 0;
let selectedModeIndex = 0;

// Game modes data with proper structure
const gameCategories = {
  main: [
    { id: 'braincell', name: '🧠 The Last Braincell', action: 'enter-braincell', desc: 'Ultimate trivia showdown' }
  ],
  braincell: [
    { id: 'party', name: '🎉 Party / Friends', action: 'enter-party', desc: '7 party game modes' },
    { id: 'couples', name: '💘 Couples', action: 'enter-couples', desc: '5 couples modes' }
  ],
  party: [
    { id: 'party.quick-quiz', name: '👑 Quick Quiz Royale', desc: 'Fast-paced trivia' },
    { id: 'party.finish-phrase', name: '✍️ Finish the Phrase', desc: 'Complete sayings' },
    { id: 'party.fact-fiction', name: '🤔 Fact or Fiction?', desc: 'Spot the truth' },
    { id: 'party.phone-confessions', name: '📱 Phone Confessions', desc: 'Digital dilemmas' },
    { id: 'party.answer-roulette', name: '🎲 Answer Roulette', desc: 'High stakes' },
    { id: 'party.lie-detector', name: '🚨 Lie Detector', desc: 'Find the lies' },
    { id: 'party.buzzkill', name: '⚡ Buzzkill Bonus', desc: 'Double points' }
  ],
  couples: [
    { id: 'couples.how-good', name: '💑 How Well You Know Me', desc: 'Test knowledge' },
    { id: 'couples.survival', name: '🕹️ Couple\'s Survival', desc: 'Work together' },
    { id: 'couples.finish-phrase', name: '💌 Love Phrases', desc: 'Romantic sayings' },
    { id: 'couples.relationship', name: '🎰 Relationship Roulette', desc: 'Random scenarios' },
    { id: 'couples.secret-sync', name: '🔮 Secret Sync', desc: 'Think alike' }
  ]
};

function uiName(){
  screen.innerHTML = `
    <div class="premium-join">
      <div class="join-header">
        <div class="join-logo">🎮</div>
        <h1 class="join-title">Game Night HQ</h1>
      </div>
      <div class="join-form">
        <input id="nameInput" class="premium-input" placeholder="Enter your name" value="${name||''}" maxlength="16"/>
        <button id="joinBtn" class="premium-btn primary">
          <span class="btn-icon">🚀</span>
          <span class="btn-text">Join Party</span>
        </button>
      </div>
    </div>`;
  document.getElementById('joinBtn').onclick = ()=>{
    name = (document.getElementById('nameInput').value||'Player').trim();
    localStorage.setItem('name', name);
    socket.emit('joinHub', { name, pid });
  };
}

function uiHostController(){
  const currentCategory = gameCategories[currentMenuSection];
  const selectedItem = currentCategory[currentMenuSection === 'main' ? selectedCategoryIndex : selectedModeIndex];
  const currentGame = hubState?.currentGame;
  
  screen.innerHTML = `
    <div class="premium-remote">
      <!-- Remote Header -->
      <div class="remote-header">
        <div class="remote-brand">
          <span class="brand-icon">🎮</span>
          <span class="brand-name">Game Night HQ</span>
        </div>
        <div class="connection-status">
          <span class="status-dot active"></span>
          <span class="status-text">Connected</span>
        </div>
      </div>

      <!-- Simplified Display -->
      <div class="remote-screen">
        <div class="screen-content">
          <div class="remote-title">TV Remote Control</div>
          <div class="remote-instruction">Navigate the TV screen using the controls below</div>
          
          <div class="player-count">
            <span class="count-icon">👥</span>
            <span class="count-text">${hubState?.players?.length || 0} Players</span>
          </div>
        </div>
      </div>

      <!-- D-Pad Navigation -->
      <div class="remote-controls">
        <div class="dpad-container">
          <button id="dpadUp" class="dpad-btn dpad-up">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>
            </svg>
          </button>
          <button id="dpadLeft" class="dpad-btn dpad-left">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
          <button id="dpadOk" class="dpad-btn dpad-center">
            <span class="ok-text">OK</span>
          </button>
          <button id="dpadRight" class="dpad-btn dpad-right">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 14l6-6z"/>
            </svg>
          </button>
          <button id="dpadDown" class="dpad-btn dpad-down">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="remote-actions">
        <button id="backBtn" class="action-btn back-btn" ${currentMenuSection === 'main' ? 'disabled' : ''}>
          <span class="action-icon">⬅️</span>
          <span class="action-text">Back</span>
        </button>
        
        ${currentGame ? `
          <button id="startBtn" class="action-btn start-btn">
            <span class="action-icon">🚀</span>
            <span class="action-text">Start Game</span>
          </button>
        ` : `
          <div class="action-hint">Select a game mode to start</div>
        `}
      </div>

      <!-- Remote Footer -->
      <div class="remote-footer">
        <button id="leaveBtn" class="footer-btn">
          <span class="footer-icon">🚪</span>
          <span class="footer-text">Leave Party</span>
        </button>
      </div>
    </div>
    
    <!-- Premium CSS for TV Remote -->
    <style>
      .premium-remote {
        background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
        border-radius: 24px;
        padding: 20px;
        box-shadow: 
          0 20px 60px rgba(0,0,0,0.5),
          inset 0 1px 0 rgba(255,255,255,0.1),
          inset 0 -1px 0 rgba(0,0,0,0.3);
        position: relative;
        overflow: hidden;
      }
      
      .premium-remote::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: 
          radial-gradient(circle at 20% 30%, rgba(255,43,43,0.05), transparent 40%),
          radial-gradient(circle at 80% 70%, rgba(110,193,255,0.03), transparent 40%);
        pointer-events: none;
      }
      
      .remote-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding: 0 8px;
      }
      
      .remote-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .brand-icon {
        font-size: 20px;
      }
      
      .brand-name {
        font-size: 14px;
        font-weight: 700;
        background: linear-gradient(135deg, #fff, #bdbdbd);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .connection-status {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #6EFF9D;
        box-shadow: 0 0 8px #6EFF9D;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .status-text {
        font-size: 11px;
        color: #6EFF9D;
        font-weight: 600;
      }
      
      .remote-screen {
        background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 16px;
        margin-bottom: 24px;
        backdrop-filter: blur(10px);
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.1),
          0 4px 12px rgba(0,0,0,0.3);
      }
      
      .menu-title {
        font-size: 12px;
        color: #bdbdbd;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 12px;
      }
      
      .menu-breadcrumb {
        font-size: 12px;
        color: #bdbdbd;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .breadcrumb-arrow {
        color: #666;
      }
      
      .current-selection, .game-selection {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(255,255,255,0.05);
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08);
      }
      
      .selection-icon, .game-icon {
        font-size: 32px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      }
      
      .selection-info, .game-details {
        flex: 1;
      }
      
      .selection-name, .game-name {
        font-weight: 700;
        font-size: 16px;
        margin-bottom: 2px;
      }
      
      .selection-desc, .game-desc {
        font-size: 12px;
        color: #bdbdbd;
      }
      
      .game-selected {
        font-size: 11px;
        color: #6EFF9D;
        margin-top: 4px;
        font-weight: 600;
      }
      
      .player-count {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
        font-size: 13px;
        color: #bdbdbd;
      }
      
      .dpad-container {
        position: relative;
        width: 180px;
        height: 180px;
        margin: 0 auto 24px;
      }
      
      .dpad-btn {
        position: absolute;
        background: linear-gradient(135deg, #2a2a3e, #1a1a2e);
        border: 1px solid rgba(255,255,255,0.15);
        color: #fff;
        cursor: pointer;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 
          0 4px 12px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.1),
          inset 0 -2px 4px rgba(0,0,0,0.3);
      }
      
      .dpad-btn:active {
        transform: scale(0.95);
        box-shadow: 
          0 2px 6px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.05),
          inset 0 -1px 2px rgba(0,0,0,0.3);
      }
      
      .dpad-btn:hover:not(:active) {
        background: linear-gradient(135deg, #3a3a4e, #2a2a3e);
        border-color: rgba(255,255,255,0.25);
        box-shadow: 
          0 6px 16px rgba(0,0,0,0.5),
          0 0 24px rgba(255,43,43,0.1),
          inset 0 1px 0 rgba(255,255,255,0.15),
          inset 0 -2px 4px rgba(0,0,0,0.3);
      }
      
      .dpad-up, .dpad-down {
        width: 50px;
        height: 50px;
        left: 65px;
        border-radius: 8px;
      }
      
      .dpad-up {
        top: 10px;
        border-top-left-radius: 16px;
        border-top-right-radius: 16px;
      }
      
      .dpad-down {
        bottom: 10px;
        border-bottom-left-radius: 16px;
        border-bottom-right-radius: 16px;
      }
      
      .dpad-left, .dpad-right {
        width: 50px;
        height: 50px;
        top: 65px;
        border-radius: 8px;
      }
      
      .dpad-left {
        left: 10px;
        border-top-left-radius: 16px;
        border-bottom-left-radius: 16px;
      }
      
      .dpad-right {
        right: 10px;
        border-top-right-radius: 16px;
        border-bottom-right-radius: 16px;
      }
      
      .dpad-center {
        width: 60px;
        height: 60px;
        top: 60px;
        left: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff2b2b, #ff4444);
        border: 2px solid rgba(255,255,255,0.2);
        font-weight: 800;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 
          0 6px 20px rgba(255,43,43,0.4),
          inset 0 1px 0 rgba(255,255,255,0.3),
          inset 0 -2px 4px rgba(0,0,0,0.3);
      }
      
      .dpad-center:hover {
        background: linear-gradient(135deg, #ff4444, #ff6666);
        box-shadow: 
          0 8px 24px rgba(255,43,43,0.5),
          0 0 32px rgba(255,43,43,0.3),
          inset 0 1px 0 rgba(255,255,255,0.4),
          inset 0 -2px 4px rgba(0,0,0,0.3);
      }
      
      .dpad-center:active {
        box-shadow: 
          0 3px 12px rgba(255,43,43,0.4),
          inset 0 1px 0 rgba(255,255,255,0.2),
          inset 0 -1px 2px rgba(0,0,0,0.3);
      }
      
      .ok-text {
        color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      
      .dpad-btn svg {
        width: 24px;
        height: 24px;
        filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
      }
      
      .remote-actions {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
        min-height: 48px;
      }
      
      .action-btn {
        flex: 1;
        background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 12px;
        padding: 12px;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s ease;
        box-shadow: 
          0 4px 12px rgba(0,0,0,0.3),
          inset 0 1px 0 rgba(255,255,255,0.1);
      }
      
      .action-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06));
        border-color: rgba(255,255,255,0.25);
        transform: translateY(-1px);
        box-shadow: 
          0 6px 16px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.15);
      }
      
      .action-btn:active {
        transform: translateY(0);
      }
      
      .action-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      
      .start-btn {
        background: linear-gradient(135deg, #6EFF9D, #4dc971);
        border-color: rgba(110,255,157,0.3);
        color: #000;
      }
      
      .start-btn:hover {
        background: linear-gradient(135deg, #7fffa8, #5dd47c);
        box-shadow: 
          0 6px 20px rgba(110,255,157,0.4),
          0 0 32px rgba(110,255,157,0.2),
          inset 0 1px 0 rgba(255,255,255,0.3);
      }
      
      .action-hint {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        color: #666;
        font-style: italic;
      }
      
      .remote-footer {
        display: flex;
        justify-content: center;
      }
      
      .footer-btn {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 10px 20px;
        color: #bdbdbd;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      
      .footer-btn:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.15);
        color: #fff;
      }
      
      .premium-join {
        text-align: center;
        padding: 40px 20px;
      }
      
      .join-logo {
        font-size: 64px;
        margin-bottom: 16px;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
      }
      
      .join-title {
        font-size: 28px;
        font-weight: 800;
        margin: 0 0 32px 0;
        background: linear-gradient(135deg, #fff, #bdbdbd);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .premium-input {
        width: 100%;
        padding: 14px 20px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 12px;
        color: #fff;
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 16px;
        transition: all 0.2s ease;
      }
      
      .premium-input:focus {
        outline: none;
        background: rgba(255,255,255,0.12);
        border-color: rgba(255,255,255,0.25);
        box-shadow: 0 0 24px rgba(255,255,255,0.1);
      }
      
      .premium-btn {
        width: 100%;
        padding: 14px 20px;
        background: linear-gradient(135deg, #ff2b2b, #ff4444);
        border: none;
        border-radius: 12px;
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s ease;
        box-shadow: 
          0 4px 16px rgba(255,43,43,0.3),
          inset 0 1px 0 rgba(255,255,255,0.2);
      }
      
      .premium-btn:hover {
        background: linear-gradient(135deg, #ff4444, #ff6666);
        transform: translateY(-1px);
        box-shadow: 
          0 6px 24px rgba(255,43,43,0.4),
          0 0 32px rgba(255,43,43,0.2),
          inset 0 1px 0 rgba(255,255,255,0.3);
      }
    </style>`;
  
  // Navigation logic
  const navigate = (direction) => {
    const currentCategory = gameCategories[currentMenuSection];
    const maxIndex = currentCategory.length - 1;
    
    if (direction === 'up') {
      if (currentMenuSection === 'main') {
        selectedCategoryIndex = Math.max(0, selectedCategoryIndex - 1);
      } else {
        selectedModeIndex = Math.max(0, selectedModeIndex - 1);
      }
    } else if (direction === 'down') {
      if (currentMenuSection === 'main') {
        selectedCategoryIndex = Math.min(maxIndex, selectedCategoryIndex + 1);
      } else {
        selectedModeIndex = Math.min(maxIndex, selectedModeIndex + 1);
      }
    }
    
    uiHostController();
  };
  
  const selectCurrent = () => {
    const currentCategory = gameCategories[currentMenuSection];
    const selectedItem = currentCategory[currentMenuSection === 'main' ? selectedCategoryIndex : selectedModeIndex];
    
    if (selectedItem.action === 'enter-braincell') {
      currentMenuSection = 'braincell';
      selectedCategoryIndex = 0;
      uiHostController();
    } else if (selectedItem.action === 'enter-party') {
      currentMenuSection = 'party';
      selectedModeIndex = 0;
      uiHostController();
    } else if (selectedItem.action === 'enter-couples') {
      currentMenuSection = 'couples';
      selectedModeIndex = 0;
      uiHostController();
    } else if (selectedItem.id && selectedItem.id.includes('.')) {
      // It's a game mode, select it
      socket.emit('chooseGame', { id: selectedItem.id });
    }
  };
  
  const goBack = () => {
    if (currentMenuSection === 'party' || currentMenuSection === 'couples') {
      currentMenuSection = 'braincell';
      selectedCategoryIndex = currentMenuSection === 'party' ? 0 : 1;
    } else if (currentMenuSection === 'braincell') {
      currentMenuSection = 'main';
      selectedCategoryIndex = 0;
    }
    uiHostController();
  };
  
  // Wire up controls to send TV navigation commands (only for host)
  if (isHost) {
    document.getElementById('dpadUp')?.addEventListener('click', () => sendTVCommand('navigate', { direction: 'up' }));
    document.getElementById('dpadDown')?.addEventListener('click', () => sendTVCommand('navigate', { direction: 'down' }));
    document.getElementById('dpadLeft')?.addEventListener('click', () => sendTVCommand('navigate', { direction: 'left' }));
    document.getElementById('dpadRight')?.addEventListener('click', () => sendTVCommand('navigate', { direction: 'right' }));
    document.getElementById('dpadOk')?.addEventListener('click', () => sendTVCommand('navigate', { direction: 'select' }));
    document.getElementById('backBtn')?.addEventListener('click', () => sendTVCommand('navigate', { direction: 'back' }));
  }
  
  document.getElementById('startBtn')?.addEventListener('click', () => {
    sendTVCommand('start');
  });
  
  document.getElementById('leaveBtn')?.addEventListener('click', () => doLeave());
}

// Function to send commands to TV
function sendTVCommand(action, data = {}) {
  socket.emit('tvControl', { action, data, pid });
}

function uiWaitingForHost(){
  const hostPlayer = hubState?.players?.find(p => p.pid === hubState?.host);
  const hostName = hostPlayer?.name || 'Host';
  
  // If no host is assigned but there are players, show different message
  if (!hubState?.host && hubState?.players?.length >= 1) {
    screen.innerHTML = `
      <div class="center">
        <h2>🎮 Game Night HQ</h2>
        <div class="waiting-state">
          <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
          <h3 style="margin-bottom: 8px;">Setting Up Host...</h3>
          <div style="color: #bdbdbd; margin-bottom: 16px; text-align: center; line-height: 1.4;">
            The first player will become the host automatically.<br>
            Please wait a moment...
          </div>
          
          <div class="party-info" style="background: var(--glass-strong); padding: 12px; border-radius: 12px; margin-bottom: 16px;">
            <div style="font-size: 14px; color: #bdbdbd; margin-bottom: 4px;">Party Status:</div>
            <div style="font-weight: 600;">Players: ${hubState?.players?.length || 0}</div>
          </div>
        </div>
      </div>
      
      <button id="leaveBtn" class="btn secondary">Leave Party</button>`;
  } else {
    screen.innerHTML = `
      <div class="center">
        <h2>🎮 Game Night HQ</h2>
        <div class="waiting-state">
          <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
          <h3 style="margin-bottom: 8px;">Waiting for ${hostName}</h3>
          <div style="color: #bdbdbd; margin-bottom: 16px; text-align: center; line-height: 1.4;">
            The host is selecting a game mode.<br>
            Sit tight and get ready to play!
          </div>
          
          <div class="party-info" style="background: var(--glass-strong); padding: 12px; border-radius: 12px; margin-bottom: 16px;">
            <div style="font-size: 14px; color: #bdbdbd; margin-bottom: 4px;">Party Status:</div>
            <div style="font-weight: 600;">Players: ${hubState?.players?.length || 0}</div>
            ${hubState?.currentGame ? `<div style="font-size: 12px; color: #6EFF9D; margin-top: 4px;">Game selected!</div>` : ''}
          </div>
          
          <div style="font-size: 12px; color: #bdbdbd; text-align: center;">
            💡 Tip: Make sure your volume is up for the best experience!
          </div>
        </div>
      </div>
      
      <button id="leaveBtn" class="btn secondary">Leave Party</button>`;
  }
  
  document.getElementById('leaveBtn').onclick = () => doLeave();
}

function uiReady(){
  // Check if this player is the host (pid matches hubState.host)
  isHost = hubState && hubState.host === pid;
  
  // Also check if this is the first player (should auto-become host)
  if (!isHost && hubState && hubState.players.length >= 1 && hubState.players[0].pid === pid) {
    isHost = true;
    console.log('First player auto-promoted to host:', pid);
  }
  
  // Debug logging
  console.log('Host check:', {
    pid,
    hubStateHost: hubState?.host,
    isHost,
    playerCount: hubState?.players?.length,
    firstPlayerPid: hubState?.players?.[0]?.pid
  });
  
  if (isHost) {
    uiHostController();
  } else {
    uiWaitingForHost();
  }
}

// Game event handlers (unchanged)
socket.on('preQuestion', ({ title, idx, total })=>{
  screen.innerHTML = `
    <div class="center">
      <h2>${title}</h2>
      <div class="row"><div>Q ${idx}/${total}</div><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill paused" style="width:100%"></div></div>
      <div class="note">Get ready…</div>
    </div>
    <button id="leaveBtn" class="btn secondary">Leave</button>`;
  const leave = document.getElementById('leaveBtn'); if (leave) leave.onclick = ()=> doLeave();
});

socket.on('lbQuestion', ({ q, idx, total, title, isLightning })=> {
  uiPartyQuestion(title || 'Quick Round', q, idx, total, isLightning);
});

// Handle jinxed player notification for Answer Roulette
socket.on('youAreJinxed', ({ jinxed })=> {
  if (jinxed) {
    const jinxNote = document.createElement('div');
    jinxNote.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #ff2b2b, #ff6b9d);
      color: white;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 600;
      z-index: 10000;
      animation: pulse 0.5s ease-in-out 3;
    `;
    jinxNote.innerHTML = '🎲 You are JINXED this round! Your answer will be forced wrong!';
    document.body.appendChild(jinxNote);
    setTimeout(() => jinxNote.remove(), 4000);
  }
});

socket.on('timer', ({ left, total })=>{
  const t = document.querySelector('.timer'); if (t) t.textContent = `${Math.ceil(left/1000)}s`;
  const bar = document.querySelector('.timerbar .fill');
  if (bar && total){ bar.style.width = Math.max(0, Math.min(100, (left/total)*100)) + '%'; bar.classList.remove('paused'); }
});

socket.on('lbReveal', ({ correct })=>{
  const note = document.createElement('div'); note.className='note'; note.textContent=`Correct: ${correct}`; screen.appendChild(note);
});

socket.on('lbGameOver', ()=>{
  screen.innerHTML = `<div class="center"><h2>🏆 Game Over!</h2><div class="note">Great job! Ready for another round?</div></div>
  <button id="backBtn" class="btn">Back to Lobby</button>
  <button id="leaveBtn" class="btn secondary">Leave Party</button>`;
  document.getElementById('backBtn').onclick = () => uiReady();
  document.getElementById('leaveBtn').onclick = ()=> doLeave();
});

socket.on('csSelf',  ({ q, idx, total })=> { uiCouplesSelf(q, idx, total); });
socket.on('csGuess', ({ q, idx, total })=> { uiCouplesGuess(q, idx, total); });
socket.on('csReveal', ({ correct, picks, scores })=> {
  const note = document.createElement('div'); 
  note.className='note'; 
  note.innerHTML = `<div>Correct: ${correct}</div><div style="margin-top: 8px; font-size: 12px;">Check TV for detailed results!</div>`; 
  screen.appendChild(note);
});
socket.on('csGameOver', ()=>{
  screen.innerHTML = `<div class="center"><h2>💕 Couples Challenge Complete!</h2><div class="note">How did you do? Check the TV for final scores!</div></div>
  <button id="backBtn" class="btn">Back to Lobby</button>
  <button id="leaveBtn" class="btn secondary">Leave Party</button>`;
  document.getElementById('backBtn').onclick = () => uiReady();
  document.getElementById('leaveBtn').onclick = ()=> doLeave();
});

function uiPartyQuestion(title, q, idx, total, isLightning){
  screen.innerHTML = `
    <div class="center">
      <h2>${title} ${isLightning ? '⚡' : ''}</h2>
      ${isLightning ? '<div style="color: #ffd166; font-weight: 600; margin: 8px 0; animation: pulse 1s infinite;">⚡ LIGHTNING ROUND - DOUBLE POINTS! ⚡</div>' : ''}
      <div class="row"><div>Q ${idx}/${total}</div><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill" style="width:100%"></div></div>
      <div class="question-text" style="font-size: 14px; margin: 12px 0; padding: 8px; background: var(--glass-strong); border-radius: 8px; color: #fff;">
        ${q.q}
      </div>
      <div class="row" style="margin-top:8px"><button class="btn opt" data-k="A">A) ${q.A}</button></div>
      <div class="row"><button class="btn opt" data-k="B">B) ${q.B}</button></div>
      <div class="row"><button class="btn opt" data-k="C">C) ${q.C}</button></div>
      <div class="row"><button class="btn opt" data-k="D">D) ${q.D}</button></div>
    </div>
    <button id="leaveBtn" class="btn secondary">Leave</button>`;
  document.querySelectorAll('.opt').forEach(b=>{
    b.onclick = ()=>{ disableOpts(); socket.emit('answer', { pid, choice: b.dataset.k }); };
  });
  const leave = document.getElementById('leaveBtn'); if (leave) leave.onclick = ()=> doLeave();
}

// Store couples selections
let couplesSelfAnswer = null;
let couplesGuessAnswer = null;

function uiCouplesSelf(q, idx, total){
  // Reset for new question
  couplesSelfAnswer = null;
  couplesGuessAnswer = null;
  
  screen.innerHTML = `
    <div class="center">
      <h2>💝 Couples Mode</h2>
      <div class="row"><div>Q ${idx}/${total}</div><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill" style="width:100%"></div></div>
      
      <div class="question-text" style="font-size: 14px; margin: 12px 0; padding: 8px; background: var(--glass-strong); border-radius: 8px; color: #fff;">
        ${q.q}
      </div>
      
      <div class="couples-section" style="margin: 16px 0;">
        <div class="couples-hint" style="font-size: 13px; color: #ff6b9d; margin: 8px 0;">
          Step 1: Your answer
        </div>
        <div class="couples-options" id="selfOptions">
          ${couplesOptsHtml(q, 'self')}
        </div>
      </div>
      
      <div class="couples-section" id="guessSection" style="opacity: 0.4; pointer-events: none;">
        <div class="couples-hint" style="font-size: 13px; color: #ff6b9d; margin: 8px 0;">
          Step 2: What did your partner choose?
        </div>
        <div class="couples-options" id="guessOptions">
          ${couplesOptsHtml(q, 'guess')}
        </div>
      </div>
      
      <button id="submitBoth" class="btn primary" style="display: none; margin-top: 16px;">
        Submit Both Answers
      </button>
    </div>
    <button id="leaveBtn" class="btn secondary">Leave</button>`;
  
  wireCouplesOpts(q);
  const leave = document.getElementById('leaveBtn'); if (leave) leave.onclick = ()=> doLeave();
}

function uiCouplesGuess(q, idx, total){
  // For backwards compatibility, redirect to the combined UI
  uiCouplesSelf(q, idx, total);
}

function couplesOptsHtml(q, type){
  return `
    <div class="row" style="margin-top:4px"><button class="btn opt-${type}" data-k="A" data-type="${type}">A) ${q.A}</button></div>
    <div class="row" style="margin-top:4px"><button class="btn opt-${type}" data-k="B" data-type="${type}">B) ${q.B}</button></div>
    <div class="row" style="margin-top:4px"><button class="btn opt-${type}" data-k="C" data-type="${type}">C) ${q.C}</button></div>
    <div class="row" style="margin-top:4px"><button class="btn opt-${type}" data-k="D" data-type="${type}">D) ${q.D}</button></div>`;
}

function wireCouplesOpts(q){
  // Wire self options
  document.querySelectorAll('.opt-self').forEach(b => {
    b.onclick = () => {
      // Clear previous selection
      document.querySelectorAll('.opt-self').forEach(btn => btn.classList.remove('selected'));
      b.classList.add('selected');
      couplesSelfAnswer = b.dataset.k;
      
      // Enable guess section
      const guessSection = document.getElementById('guessSection');
      if (guessSection) {
        guessSection.style.opacity = '1';
        guessSection.style.pointerEvents = 'auto';
      }
      
      checkCouplesReady();
    };
  });
  
  // Wire guess options
  document.querySelectorAll('.opt-guess').forEach(b => {
    b.onclick = () => {
      // Clear previous selection
      document.querySelectorAll('.opt-guess').forEach(btn => btn.classList.remove('selected'));
      b.classList.add('selected');
      couplesGuessAnswer = b.dataset.k;
      
      checkCouplesReady();
    };
  });
  
  // Wire submit button
  const submitBtn = document.getElementById('submitBoth');
  if (submitBtn) {
    submitBtn.onclick = () => {
      if (couplesSelfAnswer && couplesGuessAnswer) {
        // Disable all buttons
        document.querySelectorAll('.opt-self, .opt-guess').forEach(b => {
          b.disabled = true;
          b.style.opacity = '0.6';
        });
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
        
        // Send both answers in one submission
        socket.emit('answerCouples', { 
          pid, 
          self: couplesSelfAnswer, 
          guessPartner: couplesGuessAnswer 
        });
      }
    };
  }
}

function checkCouplesReady(){
  const submitBtn = document.getElementById('submitBoth');
  if (submitBtn && couplesSelfAnswer && couplesGuessAnswer) {
    submitBtn.style.display = 'block';
  }
}

function optsHtml(q){
  return `
    <div class="row" style="margin-top:8px"><button class="btn opt" data-k="A">A) ${q.A}</button></div>
    <div class="row"><button class="btn opt" data-k="B">B) ${q.B}</button></div>
    <div class="row"><button class="btn opt" data-k="C">C) ${q.C}</button></div>
    <div class="row"><button class="btn opt" data-k="D">D) ${q.D}</button></div>`;
}

function wireOpts(fn){ document.querySelectorAll('.opt').forEach(b=>{ b.onclick = ()=>{ disableOpts(); fn(b.dataset.k); }; }); }
function disableOpts(){ document.querySelectorAll('.opt').forEach(b=>{ b.disabled=true; b.style.opacity=.6; }); }

function doLeave(){
  localStorage.removeItem('pid');
  socket.emit('leave', { pid });
  pid=null; name=localStorage.getItem('name')||'';
  isHost = false;
  currentMenuSection = 'main';
  selectedCategoryIndex = 0;
  selectedModeIndex = 0;
  uiName();
}

/* join/resume */
if (pid && name) socket.emit('joinHub', { name, pid }); else uiName();

socket.on('joined', ({ pid: newPid, name: nm })=>{
  pid = newPid; localStorage.setItem('pid', pid);
  if (nm) localStorage.setItem('name', nm);
  // Wait for hubState to determine if host
});

socket.on('hubState', (st)=>{
  hubState = st;
  if (!pid || !st.players.find(p=>p.pid===pid)) {
    uiName();
  } else {
    // Always show the ready UI when we have a valid player ID
    uiReady();
  }
});

socket.on('gameSelected', ({ id, meta }) => {
  // Find which section and index the selected game is in
  for (const [section, games] of Object.entries(gameCategories)) {
    const index = games.findIndex(g => g.id === id);
    if (index !== -1) {
      if (section === 'party' || section === 'couples') {
        currentMenuSection = section;
        selectedModeIndex = index;
      }
      break;
    }
  }
  
  // Refresh the controller if we're in the lobby
  const currentScreen = screen.innerHTML;
  if (currentScreen.includes('premium-remote') || currentScreen.includes('Waiting for')) {
    uiReady();
  }
});

// Handle snapshot restoration for reconnection
socket.on('restoreSnapshot', (snapshot) => {
  if (snapshot?.kind === 'trivia') {
    // We're in the middle of a game, the appropriate game event will fire
  }
});

// Handle game being ended by host
socket.on('gameEnded', ({ reason }) => {
  screen.innerHTML = `
    <div class="center">
      <h2>🎮 Game Ended</h2>
      <div style="font-size: 48px; margin: 24px 0;">⏹️</div>
      <div style="color: #bdbdbd; margin-bottom: 16px; text-align: center; line-height: 1.4;">
        ${reason || 'The game has ended'}
      </div>
      <button id="backBtn" class="btn">Back to Lobby</button>
    </div>`;
  
  document.getElementById('backBtn').onclick = () => uiReady();
});