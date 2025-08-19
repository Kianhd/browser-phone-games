const socket = io();
const screen = document.getElementById('screen');

let pid = localStorage.getItem('pid') || null;
let name = localStorage.getItem('name') || '';
let hubState = null;
let isHost = false;
let selectedGameIndex = 0;

// Game modes data
const gameModes = [
  { id: 'party.quick-quiz', name: '👑 Quick Quiz Royale', category: 'Party' },
  { id: 'party.finish-phrase', name: '✍️ Finish the Phrase', category: 'Party' },
  { id: 'party.fact-fiction', name: '🤔 Fact or Fiction?', category: 'Party' },
  { id: 'party.phone-confessions', name: '📱 Phone Confessions', category: 'Party' },
  { id: 'party.answer-roulette', name: '🎲 Answer Roulette', category: 'Party' },
  { id: 'party.lie-detector', name: '🚨 Lie Detector', category: 'Party' },
  { id: 'party.buzzkill', name: '⚡ Buzzkill Bonus', category: 'Party' },
  { id: 'couples.how-good', name: '💑 How Good Do You Know Me?', category: 'Couples' },
  { id: 'couples.survival', name: '🕹️ Couple\'s Survival', category: 'Couples' },
  { id: 'couples.finish-phrase', name: '💌 Finish the Phrase (Love)', category: 'Couples' },
  { id: 'couples.relationship', name: '🎰 Relationship Roulette', category: 'Couples' },
  { id: 'couples.secret-sync', name: '🔮 Secret Sync', category: 'Couples' }
];

function uiName(){
  screen.innerHTML = `
    <div class="center">
      <h2>🎮 Game Night HQ</h2>
      <input id="nameInput" class="input" placeholder="Your name" value="${name||''}" maxlength="16"/>
      <button id="joinBtn" class="btn">Join Party</button>
    </div>`;
  document.getElementById('joinBtn').onclick = ()=>{
    name = (document.getElementById('nameInput').value||'Player').trim();
    localStorage.setItem('name', name);
    socket.emit('joinHub', { name, pid });
  };
}

function uiHostController(){
  const currentGame = hubState?.currentGame;
  const selectedMode = gameModes[selectedGameIndex];
  
  screen.innerHTML = `
    <div class="center">
      <h2>🎮 Host Controls</h2>
      <div class="host-info">
        <div style="font-size: 14px; color: #bdbdbd; margin-bottom: 16px;">
          Players: ${hubState?.players?.length || 0}
        </div>
      </div>
      
      <div class="game-selector">
        <div style="font-size: 14px; color: #bdbdbd; margin-bottom: 8px;">Select Game Mode:</div>
        <div class="selected-game" style="background: var(--glass-strong); padding: 12px; border-radius: 12px; margin-bottom: 12px; border: 1px solid ${currentGame === selectedMode.id ? '#ff2b2b' : 'rgba(255,255,255,0.1)'};">
          <div style="font-weight: 600; margin-bottom: 4px;">${selectedMode.name}</div>
          <div style="font-size: 12px; color: #bdbdbd;">${selectedMode.category} Mode</div>
        </div>
        
        <div class="nav-controls" style="display: flex; gap: 8px; margin-bottom: 16px;">
          <button id="prevBtn" class="btn secondary" style="flex: 1;">↑ Previous</button>
          <button id="nextBtn" class="btn secondary" style="flex: 1;">↓ Next</button>
        </div>
        
        <button id="selectBtn" class="btn" style="width: 100%; margin-bottom: 8px;">
          ${currentGame === selectedMode.id ? '✓ Selected' : 'Select This Game'}
        </button>
      </div>
      
      <div class="start-controls" style="margin-top: 16px;">
        <div style="font-size: 14px; color: #bdbdbd; margin-bottom: 8px;">Start Game:</div>
        <button id="startBtn" class="btn" style="width: 100%; background: #6EFF9D; color: #000;" ${!currentGame ? 'disabled' : ''}>
          🚀 Start Game
        </button>
        ${!currentGame ? '<div style="font-size: 12px; color: #ff6b6b; margin-top: 4px;">Select a game first</div>' : ''}
      </div>
    </div>
    
    <button id="leaveBtn" class="btn secondary">Leave Party</button>`;
  
  // Navigation controls
  document.getElementById('prevBtn').onclick = () => {
    selectedGameIndex = (selectedGameIndex - 1 + gameModes.length) % gameModes.length;
    uiHostController();
  };
  
  document.getElementById('nextBtn').onclick = () => {
    selectedGameIndex = (selectedGameIndex + 1) % gameModes.length;
    uiHostController();
  };
  
  // Game selection
  document.getElementById('selectBtn').onclick = () => {
    if (currentGame !== selectedMode.id) {
      socket.emit('chooseGame', { id: selectedMode.id });
    }
  };
  
  // Start game
  if (currentGame) {
    document.getElementById('startBtn').onclick = () => {
      socket.emit('startGame', { rounds: 10 });
    };
  }
  
  document.getElementById('leaveBtn').onclick = () => doLeave();
}

function uiWaitingForHost(){
  const hostName = hubState?.players?.find(p => p.pid === hubState?.host)?.name || 'Host';
  
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
          ${hubState?.currentGame ? `<div style="font-size: 12px; color: #6EFF9D; margin-top: 4px;">Game selected: ${gameModes.find(g => g.id === hubState.currentGame)?.name || 'Unknown'}</div>` : ''}
        </div>
        
        <div style="font-size: 12px; color: #bdbdbd; text-align: center;">
          💡 Tip: Make sure your volume is up for the best experience!
        </div>
      </div>
    </div>
    
    <button id="leaveBtn" class="btn secondary">Leave Party</button>`;
  
  document.getElementById('leaveBtn').onclick = () => doLeave();
}

function uiReady(){
  // Check if this player is the host (first player)
  if (hubState && hubState.players && hubState.players.length > 0) {
    const firstPlayer = hubState.players[0];
    isHost = (firstPlayer.pid === pid);
  }
  
  if (isHost) {
    uiHostController();
  } else {
    uiWaitingForHost();
  }
}

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

socket.on('lbQuestion', ({ q, idx, total, title })=> {
  uiPartyQuestion(title || 'Quick Round', q, idx, total);
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

function uiPartyQuestion(title, q, idx, total){
  screen.innerHTML = `
    <div class="center">
      <h2>${title}</h2>
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

function uiCouplesSelf(q, idx, total){
  screen.innerHTML = `
    <div class="center">
      <h2>💝 Your Answer</h2>
      <div class="row"><div>Q ${idx}/${total}</div><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill" style="width:100%"></div></div>
      <div class="couples-hint" style="font-size: 12px; color: #ff6b9d; margin: 8px 0; text-align: center;">
        Answer for yourself first!
      </div>
      <div class="question-text" style="font-size: 14px; margin: 12px 0; padding: 8px; background: var(--glass-strong); border-radius: 8px; color: #fff;">
        ${q.q}
      </div>
      ${optsHtml(q)}
    </div>
    <button id="leaveBtn" class="btn secondary">Leave</button>`;
  wireOpts((k)=> socket.emit('answerCouplesPhase', { pid, choice:k }));
  const leave = document.getElementById('leaveBtn'); if (leave) leave.onclick = ()=> doLeave();
}
function uiCouplesGuess(q, idx, total){
  screen.innerHTML = `
    <div class="center">
      <h2>💭 Guess Partner</h2>
      <div class="row"><div>Q ${idx}/${total}</div><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill" style="width:100%"></div></div>
      <div class="couples-hint" style="font-size: 12px; color: #ff6b9d; margin: 8px 0; text-align: center;">
        What did your partner choose?
      </div>
      <div class="question-text" style="font-size: 14px; margin: 12px 0; padding: 8px; background: var(--glass-strong); border-radius: 8px; color: #fff;">
        ${q.q}
      </div>
      ${optsHtml(q)}
    </div>
    <button id="leaveBtn" class="btn secondary">Leave</button>`;
  wireOpts((k)=> socket.emit('answerCouplesPhase', { pid, choice:k }));
  const leave = document.getElementById('leaveBtn'); if (leave) leave.onclick = ()=> doLeave();
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
    // If we're already in the lobby, update the display
    const currentScreen = screen.innerHTML;
    if (currentScreen.includes('Host Controls') || currentScreen.includes('Waiting for')) {
      uiReady();
    } else if (currentScreen.includes('Join Party')) {
      uiReady();
    }
  }
});

socket.on('gameSelected', ({ id, meta }) => {
  // Update the selected game index to match the server selection
  const gameIndex = gameModes.findIndex(g => g.id === id);
  if (gameIndex !== -1) {
    selectedGameIndex = gameIndex;
  }
  
  // Refresh the controller if we're in the lobby
  const currentScreen = screen.innerHTML;
  if (currentScreen.includes('Host Controls') || currentScreen.includes('Waiting for')) {
    uiReady();
  }
});

// Handle snapshot restoration for reconnection
socket.on('restoreSnapshot', (snapshot) => {
  if (snapshot?.kind === 'trivia') {
    // We're in the middle of a game, the appropriate game event will fire
  }
});