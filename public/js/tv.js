const socket = io();

// UI elements
const createRoomBtn = document.getElementById('createRoom');
const startGameBtn = document.getElementById('startGame');
const roomCodeEl = document.getElementById('roomCode');
const qrImg = document.getElementById('qrImg');
const modeSelect = document.getElementById('modeSelect');
const playersStatus = document.getElementById('playersStatus');

let currentRoom = null;
let slots = [false, false, false, false];
let mode = 2;

// create room
createRoomBtn.onclick = () => {
  socket.emit('createRoom', (res) => {
    currentRoom = res.room;
    roomCodeEl.textContent = currentRoom;
    updateQr();
    navigator.vibrate && navigator.vibrate(50);
  });
};

function updateQr(){
  if (!currentRoom) { qrImg.src=''; return; }
  const url = `${location.origin}/controller.html`;
  // Use a public QR api to generate QR with room encoded as query param
  const joinUrl = `${url}?r=${currentRoom}`;
  // qrserver API
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}`;
  qrImg.alt = joinUrl;
}

// track room updates
socket.on('roomUpdate', data => {
  if (!data) return;
  // data.slots is [bool,bool,bool,bool]
  slots = data.slots;
  for (let i=0;i<4;i++){
    const el = playersStatus.querySelector(`.pstatus[data-i="${i+1}"] .stat`);
    if (el) el.textContent = slots[i] ? '🟢' : '❌';
  }
  startGameBtn.disabled = !(slots[0] && slots[1]); // require P1 and P2
});

// start game
startGameBtn.onclick = () => {
  if (!currentRoom) return alert('Create a room first');
  mode = parseInt(modeSelect.value || '2', 10);
  socket.emit('startGame', { room: currentRoom, mode });
};

socket.on('startGame', ({ mode: serverMode }) => {
  mode = serverMode || 2;
  initGame(mode);
});


// --- Simple QuadPong game implementation ---

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// paddles: up to 4
// p1: left vertical, p2: right vertical, p3: top horizontal, p4: bottom horizontal
const paddles = [
  { x: 34, y: H/2 - 80, w: 16, h: 160, vy: 0, color: getComputedStyle(document.documentElement).getPropertyValue('--player1').trim() || '#ff2b2b' },
  { x: W - 50, y: H/2 - 80, w: 16, h: 160, vy: 0, color: getComputedStyle(document.documentElement).getPropertyValue('--player2').trim() || '#fff' },
  { x: W/2 - 100, y: 24, w: 200, h: 14, vx: 0, color: getComputedStyle(document.documentElement).getPropertyValue('--player3').trim() || '#ffd166' },
  { x: W/2 - 100, y: H - 38, w: 200, h: 14, vx: 0, color: getComputedStyle(document.documentElement).getPropertyValue('--player4').trim() || '#6ec1ff' }
];

let ball = { x: W/2, y: H/2, r: 10, vx: 6*(Math.random()>0.5?1:-1), vy: 4*(Math.random()>0.5?1:-1) };
let scores = [0,0,0,0];
let running = false;
let targetPaddlePositions = [paddles[0].y, paddles[1].y, paddles[2].x, paddles[3].x];

// receive inputs from controllers
socket.on('playerInput', ({ player, input }) => {
  // input: { left,right,up,down,action }
  const pIdx = player - 1;
  if (pIdx < 0 || pIdx > 3) return;
  // map based on player type
  if (pIdx === 0 || pIdx === 1) {
    // vertical paddles: left = up, right = down on controller UI
    const speed = 8;
    if (input.left) paddles[pIdx].vy = -speed;
    else if (input.right) paddles[pIdx].vy = speed;
    else paddles[pIdx].vy = 0;
    if (input.action) {
      // brief height boost
      paddles[pIdx].h = 220;
      setTimeout(()=> paddles[pIdx].h = 160, 260);
    }
  } else {
    // top/bottom horizontal paddles: up = left, down = right on controller UI
    const speed = 10;
    if (input.up) paddles[pIdx].vx = -speed;
    else if (input.down) paddles[pIdx].vx = speed;
    else paddles[pIdx].vx = 0;
    if (input.action) {
      // speed nudge
      paddles[pIdx].w = 260;
      setTimeout(()=> paddles[pIdx].w = 200, 260);
    }
  }
});

// init game
function initGame(m) {
  // reset positions and scores for selected players only
  scores = [0,0,0,0];
  // ensure paddles positions stable
  paddles[0].y = H/2 - paddles[0].h/2;
  paddles[1].y = H/2 - paddles[1].h/2;
  paddles[2].x = W/2 - paddles[2].w/2;
  paddles[3].x = W/2 - paddles[3].w/2;
  running = true;
  resetBall();
}

// reset
function resetBall(){
  ball.x = W/2; ball.y = H/2;
  ball.vx = 6 * (Math.random() > 0.5 ? 1 : -1);
  ball.vy = 4 * (Math.random() > 0.5 ? 1 : -1);
}

// physics step + draw
function step(){
  if (running) {
    // update paddles with smoothing (lerp)
    for (let i=0;i<4;i++){
      if (i <= 1) {
        // vertical
        paddles[i].y += paddles[i].vy;
        // clamp
        paddles[i].y = Math.max(8, Math.min(H - 8 - paddles[i].h, paddles[i].y));
      } else {
        // horizontal
        paddles[i].x += paddles[i].vx;
        paddles[i].x = Math.max(8, Math.min(W - 8 - paddles[i].w, paddles[i].x));
      }
    }

    // move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // wall collisions
    if (ball.y < 8 || ball.y > H - 8) ball.vy *= -1;
    if (ball.x < 8 || ball.x > W - 8) ball.vx *= -1;

    // paddle collisions
    // check each paddle rectangle
    paddles.forEach((p, idx) => {
      if (idx <= 1) {
        // vertical paddle collision
        if (ball.x - ball.r < p.x + p.w && ball.x + ball.r > p.x && ball.y > p.y && ball.y < p.y + p.h) {
          const dir = idx === 0 ? 1 : -1;
          ball.vx = Math.abs(ball.vx) * dir * 1.06;
          const rel = (ball.y - (p.y + p.h/2)) / (p.h/2);
          ball.vy = rel * 6;
          // small nudge so ball doesn't stick
          ball.x += dir * 6;
        }
      } else {
        // horizontal collision
        if (ball.y - ball.r < p.y + p.h && ball.y + ball.r > p.y && ball.x > p.x && ball.x < p.x + p.w) {
          const dir = idx === 2 ? 1 : -1; // top->down positive vy, bottom->up negative
          ball.vy = Math.abs(ball.vy) * dir * 1.06;
          const rel = (ball.x - (p.x + p.w/2)) / (p.w/2);
          ball.vx = rel * 6;
          ball.y += dir * 6;
        }
      }
    });

    // scoring when ball passes fully off a side (optional - just bounce to keep action)
    // We'll keep bouncing with slight speedups rather than scoring to keep it fun for multiple players.
  }

  draw();
  requestAnimationFrame(step);
}

function draw(){
  // clear
  ctx.clearRect(0,0,W,H);
  // bg gradient
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#050508'); g.addColorStop(1,'#000');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // center subtle grid / sheen
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let y=30;y<H-30;y+=38) ctx.fillRect(W/2 - 1, y, 2, 14);

  // paddles glow + core
  paddles.forEach((p, idx) => {
    ctx.save();
    // glow
    ctx.fillStyle = hexToRgba(p.color, idx<=1 ? 0.08 : 0.06);
    if (idx <= 1) ctx.fillRect(p.x-8, p.y-8, p.w+16, p.h+16);
    else ctx.fillRect(p.x-8, p.y-8, p.w+16, p.h+16);
    // core
    ctx.fillStyle = p.color;
    if (idx <= 1) ctx.fillRect(p.x, p.y, p.w, p.h);
    else ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  });

  // ball with trail
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
  ctx.fill();

  // small neon trail
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(ball.x - 2, ball.y - 24, 4, 18);

  // optional scores (small)
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui';
  ctx.fillText(`Mode: ${mode}P`, 18, 28);
}

function hexToRgba(hex, a){
  try {
    const h = hex.replace('#','');
    const bigint = parseInt(h,16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${a})`;
  } catch(e) {
    return `rgba(255,255,255,${a})`;
  }
}

// start loop
requestAnimationFrame(step);