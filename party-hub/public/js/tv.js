const socket = io();
socket.emit('registerTV');

const codeEl = document.getElementById('code');
const qrEl   = document.getElementById('qr');
const plist  = document.getElementById('plist');
const gameArea = document.getElementById('gameArea');
const startBtn = document.getElementById('startBtn');
const capNote  = document.getElementById('capNote');

const menuParty   = document.getElementById('menuParty');
const menuCouples = document.getElementById('menuCouples');

document.querySelectorAll('.collection').forEach(b=>{
  b.onclick = ()=>{
    menuParty.classList.toggle('hidden', b.dataset.col!=='party');
    menuCouples.classList.toggle('hidden', b.dataset.col!=='couples');
  };
});
document.querySelectorAll('.mode').forEach(b=>{
  b.onclick = ()=> socket.emit('chooseGame', { id: b.dataset.id });
});

startBtn.onclick = ()=> socket.emit('startGame', { rounds: 10 });

let hub = null;

function playerColor(idx){
  const hues = [0, 20, 40, 200, 260, 300, 120, 160, 30, 340];
  const h = hues[idx % hues.length];
  return `hsl(${h} 90% 60%)`;
}
function avatarHTML(name, idx){
  const l = (name||'?').trim()[0]?.toUpperCase() || '?';
  return `<span class="avatar" style="background:${playerColor(idx)}">${l}</span>`;
}

socket.on('hubState', st=>{
  hub = st;
  codeEl.textContent = st.code;
  qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(location.origin+'/controller.html')}`;
  plist.innerHTML = '';
  st.players.forEach((p,i)=>{
    const d = document.createElement('div');
    d.className = 'chip'+(p.ready?' ready':''); d.innerHTML = avatarHTML(p.name,i)+' '+p.name;
    plist.appendChild(d);
  });
  if (st.currentGame){
    const cap = st.availability[st.currentGame], n = st.players.length;
    if (n < cap.min || n > cap.max){ capNote.textContent = `Party is ${n}. ${cap.label} required.`; startBtn.disabled = true; }
    else { capNote.textContent=''; startBtn.disabled=false; }
  }
});

socket.on('gameSelected', ({id,meta})=>{
  const title = titleOf(id);
  gameArea.innerHTML = `
    <div class="card">
      <div class="banner"><h2>${title}</h2><div class="timer">—</div></div>
      <div class="note">${meta?meta.label:''}</div>
      <div class="note">Waiting for players to be ready…</div>
    </div>`;
});
socket.on('restoreSnapshot', snap=>{
  if (!snap) return;
  gameArea.innerHTML = `<div class="card"><h2>Restored</h2><div class="note">Rejoined current game.</div></div>`;
});

socket.on('preQuestion', ({ title, idx, total })=>{
  gameArea.innerHTML = `
    <div class="card">
      <div class="banner"><h2>${title}</h2><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill paused" style="width:100%"></div></div>
      <div class="note">Get ready…</div>
      <div class="note">Q ${idx}/${total}</div>
    </div>`;
});

/* Party */
socket.on('lbQuestion', ({ q, idx, total })=>{
  gameArea.innerHTML = renderQuestionTV(titleOf(hub.currentGame), q, idx, total);
});
socket.on('lbReveal', ({ correct, scores, picks })=>{
  renderReveal(scores, correct, false, picks);
});
socket.on('lbGameOver', ({ scores })=>{
  renderGameOver(scores);
});

/* Couples */
socket.on('csSelf', ({ q, idx, total })=>{
  gameArea.innerHTML = renderQuestionTV('Couples — Your Answer', q, idx, total, true);
});
socket.on('csGuess', ({ q, idx, total })=>{
  gameArea.innerHTML = renderQuestionTV('Couples — Guess Partner', q, idx, total, true);
});
socket.on('csReveal', ({ correct, scores, picks })=>{
  renderReveal(scores, correct, true, picks);
});
socket.on('csGameOver', ({ scores })=>{
  renderGameOver(scores, 'Couples');
});

socket.on('timer', ({ left, total })=>{
  const t = document.querySelector('.timer'); if (t) t.textContent = `${Math.ceil(left/1000)}s`;
  const bar = document.querySelector('.timerbar .fill');
  if (bar && total){ const pct = Math.max(0, Math.min(100, (left/total)*100)); bar.style.width = pct+'%'; bar.classList.remove('paused'); }
});

socket.on('toast', ({ msg })=> alert(msg));

function renderQuestionTV(title, q, idx, total, couples=false){
  return `
    <div class="card">
      <div class="banner"><h2>${title}</h2><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill" style="width:100%"></div></div>
      <div class="note">Q ${idx}/${total}</div>
      <h3>${q.q}</h3>
      <div class="opts">
        ${['A','B','C','D'].map(k=>`
          <div class="optcard" data-k="${k}">
            <div><b>${k})</b> ${q[k]}</div>
            <div class="pickrow" data-for="${k}"></div>
          </div>`).join('')}
      </div>
      ${couples?'<div class="note">Step 1: pick YOUR answer → Step 2: guess partner.</div>':''}
    </div>`;
}

function renderReveal(scores, correct, couples=false, picks=null){
  const opt = document.querySelector(`.optcard[data-k="${correct}"]`);
  if (opt) opt.classList.add('correct');
  if (picks && hub?.players){
    const list = hub.players;
    ['A','B','C','D'].forEach(letter=>{
      const row = document.querySelector(`.pickrow[data-for="${letter}"]`);
      if (!row) return; row.innerHTML='';
      list.forEach((p, idx)=>{
        const chosen = couples ? (picks[p.pid] && (picks[p.pid].guess || picks[p.pid].self)) : picks[p.pid];
        if (chosen===letter){ row.innerHTML += avatarHTML(p.name, idx); }
      });
    });
  }
  const hubPlayers = (hub?.players)||[];
  const rows = Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(([pid,pts],i)=>{
    const idx = hubPlayers.findIndex(x=>x.pid===pid);
    const p = hubPlayers[idx];
    return `<div class="row"><div>${avatarHTML(p?.name||pid, idx)} ${i===0?'🏆 ':''}${p?p.name:pid}</div><b>${pts}</b></div>`;
  }).join('');
  gameArea.insertAdjacentHTML('beforeend', `
    <div class="card">
      <h3>Scores</h3>
      ${rows}
      <div class="note">${couples?'5 pts when your guess matches partner's self answer':'Points = seconds left when you locked in.'}</div>
    </div>`);
}

function renderGameOver(scores, title='Game Over'){
  const hubPlayers = (hub?.players)||[];
  const rows = Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(([pid,pts],i)=>{
    const idx = hubPlayers.findIndex(x=>x.pid===pid);
    const p = hubPlayers[idx];
    return `<div class="row"><div>${avatarHTML(p?.name||pid, idx)} ${i===0?'🏆 ':''}${p?p.name:pid}</div><b>${pts}</b></div>`;
  }).join('');
  gameArea.innerHTML = `
    <div class="card"><h2>${title}</h2>${rows}
      <div class="note">Players remain connected. Pick another mode and hit Start.</div>
    </div>`;
}

function titleOf(id){
  const map={
    'party.quick-quiz':'Quick Quiz Royale',
    'party.finish-phrase':'Finish the Phrase',
    'party.fact-fiction':'Fact or Fiction?',
    'party.phone-confessions':'Phone Confessions',
    'party.answer-roulette':'Answer Roulette',
    'party.lie-detector':'Lie Detector',
    'party.buzzkill':'Buzzkill Bonus',
    'couples.how-good':'How Good Do You Know Me?',
    'couples.survival':'Couple's Survival',
    'couples.finish-phrase':'Finish the Phrase (Love)',
    'couples.relationship':'Relationship Roulette',
    'couples.secret-sync':'Secret Sync'
  }; return map[id]||'Trivia';
}