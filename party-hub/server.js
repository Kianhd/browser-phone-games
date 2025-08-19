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

// Load all trivia questions at startup
let TRIVIA_BY_CATEGORY = {};
const megaPath = path.join(__dirname, 'public', 'data', 'all-trivia-mega.json');
try {
  const megaData = JSON.parse(fs.readFileSync(megaPath, 'utf8'));
  TRIVIA_BY_CATEGORY = megaData.reduce((acc, q) => {
    (acc[q.category] ||= []).push(q);
    return acc;
  }, {});
  console.log('Loaded trivia mega file with categories:', Object.keys(TRIVIA_BY_CATEGORY));
} catch (err) {
  console.error('Failed to load all-trivia-mega.json:', err);
}

function loadPack(id){
  // Map game IDs to category names in mega file
  const categoryMap = {
    'party.quick-quiz':        'party-quick-quiz',
    'party.finish-phrase':     'party-finish-the-phrase',
    'party.fact-fiction':      'party-fact-or-fiction',
    'party.phone-confessions': 'party-phone-confessions',
    'party.answer-roulette':   'party-answer-roulette',
    'party.lie-detector':      'party-lie-detector',
    'party.buzzkill':          'party-buzzkill',
    'couples.how-good':        'couples-know-me',        // mapped from couples-how-good
    'couples.survival':        'couples-survival',
    'couples.finish-phrase':   'couples-love-phrase',    // mapped from couples-finish-phrase
    'couples.relationship':    'couples-roulette',       // mapped from couples-relationship-roulette
    'couples.secret-sync':     'couples-secret-sync'
  };
  
  const category = categoryMap[id];
  if (!category) return [];
  
  // Return questions from mega file if available
  const questions = TRIVIA_BY_CATEGORY[category] || [];
  if (questions.length > 0) {
    // Remove category field from questions before returning
    return questions.map(q => {
      const { category, ...rest } = q;
      return rest;
    });
  }
  
  // Fallback to individual files if mega file doesn't have this category
  const fileMap = {
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
  const f = fileMap[id];
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

  socket.on('refreshHub', ()=>{
    if (socket.id !== hub.hostSocketId) return;
    // Clear all players and reset hub state
    hub.players.clear();
    hub.byPid.clear();
    hub.currentGame = null;
    hub.lastSnapshot = null;
    // Generate new room code
    hub.code = makeCode();
    // Broadcast the refreshed state
    broadcastHub();
  });

  socket.on('leaveGame', ()=>{
    if (socket.id !== hub.hostSocketId) return;
    // End current game and return to lobby
    hub.lastSnapshot = null;
    resetReady();
    // Notify all players that game ended
    io.emit('gameEnded', { reason: 'Host left the game' });
    broadcastHub();
  });

  // Handle TV navigation commands from controller
  socket.on('tvControl', ({ action, data, pid })=>{
    // Verify player exists
    const sid = hub.byPid.get(pid); 
    if(!sid || sid !== socket.id) return;
    
    // Only host can control TV
    if (socket.id !== hub.hostSocketId) return;
    
    // Forward command to TV
    io.to('tv').emit('tvNavigate', { action, data });
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
    streaks: Object.fromEntries(activePIDs.map(pid=>[pid,0])), // For streak bonus
    phase: 'idle',
    phaseFlag: isCouples ? 'self' : null,
    questionStartAt: 0,
    endsAt: 0,
    q: null,
    answers: {},
    jinxedPlayer: null, // For Answer Roulette
    isLightningRound: false, // For Buzzkill Bonus
    afkCount: Object.fromEntries(activePIDs.map(pid=>[pid,0])) // Track AFK
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

    // Special game modes setup
    if (STATE.gameId === 'party.answer-roulette') {
      // Randomly jinx one player for Answer Roulette
      const randomIdx = Math.floor(Math.random() * activePIDs.length);
      STATE.jinxedPlayer = activePIDs[randomIdx];
    } else {
      STATE.jinxedPlayer = null;
    }

    // Buzzkill Bonus: Every 5th question or 20% chance for lightning round
    if (STATE.gameId === 'party.buzzkill' && (STATE.idx % 5 === 4 || Math.random() < 0.2)) {
      STATE.isLightningRound = true;
    } else {
      STATE.isLightningRound = false;
    }

    STATE.phase = 'idle';
    setSnapshot();
    const title = isCouples ? (STATE.phaseFlag==='self' ? 'Couples — Your Answer' : 'Couples — Guess Partner') : titleOf(STATE.gameId);
    io.emit('preQuestion', { 
      title, 
      idx: STATE.idx+1, 
      total: STATE.total, 
      timerSec: STATE.timerSec,
      isLightning: STATE.isLightningRound 
    });

    setTimeout(()=> startPhase(), 1000); // 1s pre-question pause
  }

  let tickInterval = null;

  function startPhase(){
    STATE.phase = 'question';
    STATE.questionStartAt = Date.now();
    STATE.endsAt = Date.now() + STATE.timerSec*1000;
    setSnapshot();

    if (isCouples){
      if (STATE.phaseFlag==='self') {
        io.emit('csSelf',  { q:STATE.q, idx:STATE.idx+1, total:STATE.total, endsAt:STATE.endsAt, timerSec:STATE.timerSec });
      } else {
        io.emit('csGuess', { q:STATE.q, idx:STATE.idx+1, total:STATE.total, endsAt:STATE.endsAt, timerSec:STATE.timerSec });
      }
    } else {
      // Send jinxed player info only to that player
      if (STATE.jinxedPlayer) {
        const jinxedSocket = hub.byPid.get(STATE.jinxedPlayer);
        if (jinxedSocket) {
          io.to(jinxedSocket).emit('youAreJinxed', { jinxed: true });
        }
      }
      io.emit('lbQuestion', { 
        q:STATE.q, 
        idx:STATE.idx+1, 
        total:STATE.total, 
        endsAt:STATE.endsAt, 
        title:titleOf(STATE.gameId), 
        timerSec:STATE.timerSec,
        isLightning: STATE.isLightningRound 
      });
    }

    clearInterval(tickInterval);
    tickInterval = setInterval(()=>{
      const left = Math.max(0, STATE.endsAt - Date.now());
      io.emit('timer', { left, total: STATE.timerSec*1000 });

      if (!isCouples) {
        if (Object.keys(STATE.answers).length >= activePIDs.length) { clearInterval(tickInterval); return reveal(); }
      } else {
        // Check if both players have submitted both self and guess
        const activeCouplePIDs = activePIDs.slice(0, 2);
        const allDone = activeCouplePIDs.every(pid => {
          const a = STATE.answers[pid];
          return a && a.self && a.guess;
        });
        if (allDone) { clearInterval(tickInterval); return reveal(); }
      }

      if (left<=0){ clearInterval(tickInterval); reveal(); }
    }, 120);
  }

  // Reset any old listeners for a fresh round
  io.removeAllListeners('answer');
  io.removeAllListeners('answerCouples');

  // Set up answer listeners for this game
  const answerHandler = ({ pid, choice }) => {
    if (STATE.kind !== 'trivia' || STATE.phase !== 'question' || isCouples) return;
    if (STATE.answers[pid]) return;
    
    // Handle jinxed player in Answer Roulette - force wrong answer
    if (STATE.jinxedPlayer === pid && STATE.gameId === 'party.answer-roulette') {
      // Find a wrong answer
      const wrongAnswers = ['A', 'B', 'C', 'D'].filter(opt => opt !== STATE.q.correct);
      choice = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
    }
    
    STATE.answers[pid] = { choice, at: Date.now() };
    console.log(`Player ${pid} answered, total answers: ${Object.keys(STATE.answers).length}/${activePIDs.length}`);
  };

  const couplesAnswerHandler = ({ pid, self, guessPartner }) => {
    if (STATE.kind !== 'trivia' || STATE.phase !== 'question' || !isCouples) return;
    if (STATE.answers[pid]) return;
    STATE.answers[pid] = { 
      self: { choice: self, at: Date.now() },
      guess: { choice: guessPartner, at: Date.now() }
    };
    console.log(`Couple ${pid} answered, total answers: ${Object.keys(STATE.answers).length}/2`);
  };

  io.on('answer', answerHandler);
  io.on('answerCouples', couplesAnswerHandler);

  function reveal(){
    STATE.phase = 'reveal';
    setSnapshot();

    // Suspense pause before highlighting (250-400ms as per spec)
    setTimeout(()=>{
      if (isCouples){
        // Couples scoring: +5 points for correctly guessing partner's choice
        const active = activePIDs.slice(0,2);
        const [A,B] = active;
        const a = STATE.answers[A]||{}, b = STATE.answers[B]||{};
        
        let scoreChanges = {};
        if (a.guess && b.self && a.guess.choice === b.self.choice) {
          STATE.scores[A] += 5;
          scoreChanges[A] = 5;
        }
        if (b.guess && a.self && b.guess.choice === a.self.choice) {
          STATE.scores[B] += 5;
          scoreChanges[B] = 5;
        }

        const picks = {};
        active.forEach(pid => {
          picks[pid] = {
            self:  (STATE.answers[pid] && STATE.answers[pid].self) ? STATE.answers[pid].self.choice : null,
            guess: (STATE.answers[pid] && STATE.answers[pid].guess) ? STATE.answers[pid].guess.choice : null
          };
        });

        io.emit('csReveal', { 
          correct: STATE.q.correct, 
          picks, 
          scores: STATE.scores,
          scoreChanges 
        });

        // Hold reveal for 1.2s then advance after 0.9s
        setTimeout(()=>{
          STATE.idx++;
          (STATE.idx >= STATE.total) ? endGame() : setTimeout(() => nextQuestion(), 900);
        }, 1200);
        
      } else {
        // Party/Friends scoring based on seconds remaining
        let scoreChanges = {};
        let perfectRound = true;
        
        Object.entries(STATE.answers).forEach(([pid, ans])=>{
          if (ans.choice === STATE.q.correct){
            // Calculate points based on seconds left when they answered
            const elapsed = Math.ceil((ans.at - STATE.questionStartAt) / 1000);
            const left = Math.max(0, STATE.timerSec - elapsed);
            let pts = left;
            
            // Apply lightning bonus for Buzzkill
            if (STATE.isLightningRound) {
              pts *= 2;
            }
            
            // Apply streak bonus (cap at +3)
            STATE.streaks[pid] = (STATE.streaks[pid] || 0) + 1;
            const streakBonus = Math.min(3, STATE.streaks[pid] - 1);
            pts += streakBonus;
            
            STATE.scores[pid] += pts;
            scoreChanges[pid] = pts;
            
            // Reset AFK counter on answer
            STATE.afkCount[pid] = 0;
          } else {
            // Wrong answer
            STATE.streaks[pid] = 0;
            perfectRound = false;
            STATE.afkCount[pid] = (STATE.afkCount[pid] || 0) + 1;
          }
        });
        
        // Check for no answers (AFK)
        activePIDs.forEach(pid => {
          if (!STATE.answers[pid]) {
            STATE.afkCount[pid] = (STATE.afkCount[pid] || 0) + 1;
            STATE.streaks[pid] = 0;
            perfectRound = false;
          }
        });
        
        // Perfect round bonus (+1 to everyone who got it right)
        if (perfectRound && Object.keys(scoreChanges).length === activePIDs.length) {
          Object.keys(scoreChanges).forEach(pid => {
            STATE.scores[pid] += 1;
            scoreChanges[pid] += 1;
          });
        }

        const picks = {};
        activePIDs.forEach(pid => { 
          picks[pid] = (STATE.answers[pid] && STATE.answers[pid].choice) || null; 
        });

        io.emit('lbReveal', { 
          correct: STATE.q.correct, 
          scores: STATE.scores, 
          picks,
          scoreChanges,
          jinxed: STATE.jinxedPlayer,
          perfectRound: perfectRound && Object.keys(scoreChanges).length === activePIDs.length,
          streaks: STATE.streaks,
          afk: Object.fromEntries(
            Object.entries(STATE.afkCount).filter(([_, count]) => count >= 3)
          )
        });

        // Hold reveal for 1.2s then advance after 0.9s
        setTimeout(()=>{
          STATE.idx++;
          (STATE.idx >= STATE.total) ? endGame() : setTimeout(() => nextQuestion(), 900);
        }, 1200);
      }
    }, 350); // 350ms suspense pause before reveal
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