const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" }, pingInterval: 10000, pingTimeout: 5000 });
const PORT = process.env.PORT || 3001; // Keep 3001 to avoid conflict with main server

app.use(express.static(path.join(__dirname, 'public')));

// Serve controller.html at both /controller.html and /controller
app.get('/controller', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'controller.html'));
});

/* ============== HUB (single global lobby) ============== */
const AVAIL = {
  // party (2–10)
  'party.quick-quiz':         { min: 2, max: 10, label: '2–10 players' },
  'party.finish-phrase':      { min: 2, max: 10, label: '2–10 players' },
  'party.fact-fiction':       { min: 2, max: 10, label: '2–10 players' },
  'party.phone-confessions':  { min: 2, max: 10, label: '2–10 players' },
  'party.answer-roulette':    { min: 3, max: 10, label: '3–10 players' },
  'party.lie-detector':       { min: 2, max: 10, label: '2–10 players' },
  'party.buzzkill':           { min: 2, max: 10, label: '2–10 players' },
  // couples (exactly 2)
  'couples.how-good':         { min: 2, max: 2,  label: 'Exactly 2 players' },
  'couples.survival':         { min: 2, max: 2,  label: 'Exactly 2 players' },
  'couples.finish-phrase':    { min: 2, max: 2,  label: 'Exactly 2 players' },
  'couples.relationship':     { min: 2, max: 2,  label: 'Exactly 2 players' },
  'couples.secret-sync':      { min: 2, max: 2,  label: 'Exactly 2 players' }
};

function makeCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

const hub = {
  code: makeCode(),
  tvSocketId: null,
  hostSocketId: null,
  players: new Map(),   // socketId -> { pid,name,ready }
  byPid: new Map(),     // pid -> socketId
  currentGame: null,    // e.g. 'party.quick-quiz' or 'couples.how-good'
  lastSnapshot: null    // snapshot for TV/Controllers refresh recovery
};

function broadcastHub(){
  io.emit('hubState', {
    code: hub.code,
    players: Array.from(hub.players.values()).map(p=>({pid:p.pid,name:p.name,ready:p.ready})),
    currentGame: hub.currentGame,
    availability: AVAIL,
    host: hub.hostSocketId
  });
}

function resetReady(){ for (const p of hub.players.values()) p.ready = false; }

function loadPack(id){
  const map = {
    'party.quick-quiz':        'party-quick-quiz.json',
    'party.finish-phrase':     'party-finish-the-phrase.json',
    'party.fact-fiction':      'party-fact-or-fiction.json',
    'party.phone-confessions': 'party-phone-confessions.json',
    'party.answer-roulette':   'party-answer-roulette.json',
    'party.lie-detector':      'party-lie-detector.json',
    'party.buzzkill':          'party-buzzkill.json',
    'couples.how-good':        'couples-how-good.json',
    'couples.survival':        'couples-survival.json',
    'couples.finish-phrase':   'couples-finish-phrase.json',
    'couples.relationship':    'couples-relationship-roulette.json',
    'couples.secret-sync':     'couples-secret-sync.json'
  };
  const f = map[id];
  if (!f) return [];
  const p = path.join(__dirname, 'public', 'data', f);
  try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return []; }
}

/* ============== SOCKETS ============== */
io.on('connection', (socket)=>{
  socket.on('registerTV', ()=>{
    hub.tvSocketId = socket.id;
    hub.hostSocketId = socket.id;
    socket.join('tv');
    socket.emit('hubState', {
      code: hub.code,
      players: Array.from(hub.players.values()).map(p=>({pid:p.pid,name:p.name,ready:p.ready})),
      currentGame: hub.currentGame,
      availability: AVAIL,
      host: hub.hostSocketId
    });
    if (hub.lastSnapshot) socket.emit('restoreSnapshot', hub.lastSnapshot);
  });

  socket.on('joinHub', ({ name, pid })=>{
    const usePid = pid || `p_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    hub.players.set(socket.id, { pid: usePid, name: (name||'Player').slice(0,16), ready:false });
    hub.byPid.set(usePid, socket.id);
    socket.emit('joined', { pid: usePid, name: (name||'Player').slice(0,16), code: hub.code });
    broadcastHub();
    if (hub.lastSnapshot) socket.emit('restoreSnapshot', hub.lastSnapshot.forController || null);
  });

  socket.on('setName', ({ pid, name })=>{
    const sid = hub.byPid.get(pid); if(!sid) return;
    const p = hub.players.get(sid); if(!p) return;
    p.name = (name||'Player').slice(0,16);
    broadcastHub();
  });

  socket.on('setReady', ({ pid, ready })=>{
    const sid = hub.byPid.get(pid); if(!sid) return;
    const p = hub.players.get(sid); if(!p) return;
    p.ready = !!ready;
    broadcastHub();
  });

  socket.on('leave', ({ pid })=>{
    const sid = hub.byPid.get(pid); if(!sid) return;
    const p = hub.players.get(sid);
    if (p) {
      hub.players.delete(sid);
      hub.byPid.delete(pid);
    }
    io.to(sid).socketsLeave(sid);
    broadcastHub();
  });

  socket.on('chooseGame', ({ id })=>{
    if (socket.id !== hub.hostSocketId) return;
    hub.currentGame = id;
    resetReady();
    io.emit('gameSelected', { id, meta: AVAIL[id]||null });
    broadcastHub();
  });

  socket.on('startGame', ({ rounds=10 })=>{
    if (socket.id !== hub.hostSocketId) return;
    startTrivia(rounds);
  });

  socket.on('disconnect', ()=>{
    if (socket.id === hub.hostSocketId) {
      hub.hostSocketId = null;
      for (const sid of hub.players.keys()) { hub.hostSocketId = sid; break; }
    }
    const p = hub.players.get(socket.id);
    if (p) { hub.byPid.delete(p.pid); hub.players.delete(socket.id); }
    broadcastHub();
  });
});

/* ============== TRIVIA ENGINE (12s/20s, pre-pause, early reveal, suspense, rich reveal) ============== */
function startTrivia(rounds){
  const n = hub.players.size;
  const avail = AVAIL[hub.currentGame];
  if (!avail) { io.emit('toast',{msg:'Pick a game first'}); return; }
  if (n < avail.min || n > avail.max) { io.emit('toast',{msg:`Party is ${n}. ${avail.label} required.`}); return; }

  const pack = loadPack(hub.currentGame);
  const shuffled = pack.sort(()=>Math.random()-0.5).slice(0, rounds);

  const isCouples = hub.currentGame.startsWith('couples.');
  const TIMER_SEC = isCouples ? 20 : 12;
  const activePIDs = Array.from(hub.players.values()).map(p=>p.pid);

  const STATE = {
    kind: 'trivia',
    gameId: hub.currentGame,
    idx: 0,
    total: shuffled.length,
    timerSec: TIMER_SEC,
    scores: Object.fromEntries(activePIDs.map(pid=>[pid,0])),
    phase: 'idle',
    phaseFlag: isCouples ? 'self' : null,
    endsAt: 0,
    q: null,
    answers: {}
  };

  function snapshotForController(){
    return {
      kind:'trivia',
      state:{ phase:STATE.phase, phaseFlag:STATE.phaseFlag, idx:STATE.idx, total:STATE.total, endsAt:STATE.endsAt, gameId:STATE.gameId, timerSec:STATE.timerSec },
      q: STATE.q
    };
  }
  function setSnapshot(){ hub.lastSnapshot = { kind:'trivia', state: JSON.parse(JSON.stringify(STATE)), q: STATE.q, forController: snapshotForController() }; }

  nextQuestion();

  function nextQuestion(){
    STATE.answers = {};
    STATE.q = shuffled[STATE.idx];
    if (!STATE.q){ return endGame(); }

    STATE.phase = 'idle';
    setSnapshot();
    const title = isCouples ? (STATE.phaseFlag==='self' ? 'Couples — Your Answer' : 'Couples — Guess Partner') : titleOf(STATE.gameId);
    io.emit('preQuestion', { title, idx: STATE.idx+1, total: STATE.total, timerSec: STATE.timerSec });

    setTimeout(()=> startPhase(), 1000); // 1s pre-question pause
  }

  let tickInterval = null;

  function startPhase(){
    STATE.phase = 'question';
    STATE.endsAt = Date.now() + STATE.timerSec*1000;
    setSnapshot();

    if (isCouples){
      if (STATE.phaseFlag==='self') {
        io.emit('csSelf',  { q:STATE.q, idx:STATE.idx+1, total:STATE.total, endsAt:STATE.endsAt, timerSec:STATE.timerSec });
      } else {
        io.emit('csGuess', { q:STATE.q, idx:STATE.idx+1, total:STATE.total, endsAt:STATE.endsAt, timerSec:STATE.timerSec });
      }
    } else {
      io.emit('lbQuestion', { q:STATE.q, idx:STATE.idx+1, total:STATE.total, endsAt:STATE.endsAt, title:titleOf(STATE.gameId), timerSec:STATE.timerSec });
    }

    clearInterval(tickInterval);
    tickInterval = setInterval(()=>{
      const left = Math.max(0, STATE.endsAt - Date.now());
      io.emit('timer', { left, total: STATE.timerSec*1000 });

      if (!isCouples) {
        if (Object.keys(STATE.answers).length >= activePIDs.length) { clearInterval(tickInterval); return reveal(); }
      } else {
        const bothDone = activePIDs.every(pid => {
          const a = STATE.answers[pid];
          return STATE.phaseFlag==='self' ? (a && a.self) : (a && a.guess);
        });
        if (bothDone) { clearInterval(tickInterval); return reveal(); }
      }

      if (left<=0){ clearInterval(tickInterval); reveal(); }
    }, 120);
  }

  // Reset any old listeners for a fresh round
  io.removeAllListeners('answer');
  io.removeAllListeners('answerCouplesPhase');

  io.on('connection', (skt)=>{
    skt.on('answer', ({ pid, choice })=>{
      if (STATE.kind!=='trivia' || STATE.phase!=='question' || isCouples) return;
      if (STATE.answers[pid]) return;
      STATE.answers[pid] = { choice, at: Date.now() };
    });
    skt.on('answerCouplesPhase', ({ pid, choice })=>{
      if (STATE.kind!=='trivia' || STATE.phase!=='question' || !isCouples) return;
      if (!STATE.answers[pid]) STATE.answers[pid] = {};
      const tag = (STATE.phaseFlag==='self') ? 'self' : 'guess';
      if (STATE.answers[pid][tag]) return;
      STATE.answers[pid][tag] = { choice, at: Date.now() };
    });
  });

  function reveal(){
    STATE.phase = 'reveal';
    setSnapshot();

    // suspense before highlighting
    setTimeout(()=>{
      if (isCouples){
        const active = activePIDs.slice(0,2);
        const [A,B] = active;
        const a = STATE.answers[A]||{}, b = STATE.answers[B]||{};
        if (STATE.phaseFlag==='guess'){
          if (a.guess && b.self && a.guess.choice===b.self.choice) STATE.scores[A]+=5;
          if (b.guess && a.self && b.guess.choice===a.self.choice) STATE.scores[B]+=5;

          const picks = {};
          active.forEach(pid=>{
            picks[pid] = {
              self:  (STATE.answers[pid] && STATE.answers[pid].self)  ? STATE.answers[pid].self.choice  : null,
              guess: (STATE.answers[pid] && STATE.answers[pid].guess) ? STATE.answers[pid].guess.choice : null
            };
          });

          io.emit('csReveal', { correct: STATE.q.correct, picks, scores: STATE.scores });

          // longer viewing window so players clearly see the correct answer
          setTimeout(()=>{
            STATE.idx++;
            STATE.phaseFlag = 'self';
            (STATE.idx >= STATE.total) ? endGame() : nextQuestion();
          }, 2400);
        } else {
          // finished self -> switch to guess with a tiny pause
          setTimeout(()=>{ STATE.phaseFlag = 'guess'; startPhase(); }, 500);
        }
      } else {
        Object.entries(STATE.answers).forEach(([pid, ans])=>{
          if (ans.choice === STATE.q.correct){
            const pts = Math.max(0, Math.ceil((STATE.endsAt - ans.at)/1000));
            STATE.scores[pid] += pts;
          }
        });

        const picks = {};
        activePIDs.forEach(pid => { picks[pid] = (STATE.answers[pid] && STATE.answers[pid].choice) || null; });

        io.emit('lbReveal', { correct: STATE.q.correct, scores: STATE.scores, picks });

        // longer viewing pause (2.4s) so highlight + avatars are visible before next
        setTimeout(()=>{
          STATE.idx++;
          (STATE.idx >= STATE.total) ? endGame() : nextQuestion();
        }, 2400);
      }
    }, 800); // suspense pause before reveal
  }

  function endGame(){
    io.emit(isCouples ? 'csGameOver' : 'lbGameOver', { scores: STATE.scores });
    hub.lastSnapshot = null;
    resetReady();
    broadcastHub();
  }

  function titleOf(id){
    const map = {
      'party.quick-quiz':'Quick Quiz Royale',
      'party.finish-phrase':'Finish the Phrase',
      'party.fact-fiction':'Fact or Fiction?',
      'party.phone-confessions':'Phone Confessions',
      'party.answer-roulette':'Answer Roulette',
      'party.lie-detector':'Lie Detector',
      'party.buzzkill':'Buzzkill Bonus Round'
    };
    return map[id] || 'Trivia';
  }
}
server.listen(PORT, ()=>console.log('Party Hub running on', PORT));