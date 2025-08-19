const socket = io();
const screen = document.getElementById('screen');

let pid = localStorage.getItem('pid') || null;
let name = localStorage.getItem('name') || '';

function uiName(){
  screen.innerHTML = `
    <div class="center">
      <h2>Join Party</h2>
      <input id="nameInput" class="input" placeholder="Your name" value="${name||''}" maxlength="16"/>
      <button id="joinBtn" class="btn">Join</button>
    </div>
    <button id="leaveBtn" class="btn secondary">Leave</button>`;
  document.getElementById('joinBtn').onclick = ()=>{
    name = (document.getElementById('nameInput').value||'Player').trim();
    localStorage.setItem('name', name);
    socket.emit('joinHub', { name, pid });
  };
  document.getElementById('leaveBtn').onclick = ()=> doLeave();
}

function uiReady(){
  screen.innerHTML = `
    <div class="center">
      <h2>Hello, <b>${name||'Player'}</b></h2>
      <div class="note">Pick a mode on the TV. Tap Ready when asked.</div>
      <button id="readyBtn" class="btn">Ready</button>
    </div>
    <button id="leaveBtn" class="btn secondary">Leave</button>`;
  document.getElementById('readyBtn').onclick = ()=> socket.emit('setReady', { pid, ready:true });
  document.getElementById('leaveBtn').onclick = ()=> doLeave();
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

socket.on('lbQuestion', ({ q, idx, total })=> {
  uiPartyQuestion('Quick Round', q, idx, total);
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
  screen.innerHTML = `<div class="center"><h2>Game Over</h2><div class="note">Waiting for next mode…</div><button id="readyR" class="btn">Ready</button></div>
  <button id="leaveBtn" class="btn secondary">Leave</button>`;
  document.getElementById('readyR').onclick = ()=> socket.emit('setReady', { pid, ready:true });
  document.getElementById('leaveBtn').onclick = ()=> doLeave();
});

socket.on('csSelf',  ({ q, idx, total })=> { uiCouplesSelf(q, idx, total); });
socket.on('csGuess', ({ q, idx, total })=> { uiCouplesGuess(q, idx, total); });
socket.on('csGameOver', ()=>{
  screen.innerHTML = `<div class="center"><h2>Couples Done</h2><div class="note">Pick another mode on the TV</div><button id="readyC" class="btn">Ready</button></div>
  <button id="leaveBtn" class="btn secondary">Leave</button>`;
  document.getElementById('readyC').onclick = ()=> socket.emit('setReady', { pid, ready:true });
  document.getElementById('leaveBtn').onclick = ()=> doLeave();
});

function uiPartyQuestion(title, q, idx, total){
  screen.innerHTML = `
    <div class="center">
      <h2>${title}</h2>
      <div class="row"><div>Q ${idx}/${total}</div><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill" style="width:100%"></div></div>
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
      <h2>Couples — Your Answer</h2>
      <div class="row"><div>Q ${idx}/${total}</div><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill" style="width:100%"></div></div>
      ${optsHtml(q)}
    </div>
    <button id="leaveBtn" class="btn secondary">Leave</button>`;
  wireOpts((k)=> socket.emit('answerCouplesPhase', { pid, choice:k }));
  const leave = document.getElementById('leaveBtn'); if (leave) leave.onclick = ()=> doLeave();
}
function uiCouplesGuess(q, idx, total){
  screen.innerHTML = `
    <div class="center">
      <h2>Couples — Guess Partner</h2>
      <div class="row"><div>Q ${idx}/${total}</div><div class="timer">—</div></div>
      <div class="timerbar"><div class="fill" style="width:100%"></div></div>
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
  uiName();
}

/* join/resume */
if (pid && name) socket.emit('joinHub', { name, pid }); else uiName();

socket.on('joined', ({ pid: newPid, name: nm })=>{
  pid = newPid; localStorage.setItem('pid', pid);
  if (nm) localStorage.setItem('name', nm);
  uiReady();
});

socket.on('hubState', (st)=>{
  if (!pid || !st.players.find(p=>p.pid===pid)) uiName();
});