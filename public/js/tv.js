const socket = io();

// UI
const createRoomBtn = document.getElementById('createRoom');
const startGameBtn = document.getElementById('startGame');
const roomCodeEl = document.getElementById('roomCode');
const p1El = document.getElementById('p1');
const p2El = document.getElementById('p2');

let currentRoom = null;
let slots = [false, false];
createRoomBtn.onclick = () => {
  socket.emit('createRoom', (res) => {
    currentRoom = res.room;
    roomCodeEl.textContent = currentRoom;
    navigator.vibrate && navigator.vibrate(50);
  });
};

startGameBtn.onclick = () => {
  if (!currentRoom) return alert('Create room first');
  socket.emit('startGame', { room: currentRoom });
};

socket.on('roomUpdate', (data) => {
  slots = data.slots;
  p1El.textContent = slots[0] ? '🟢' : '❌';
  p2El.textContent = slots[1] ? '🟢' : '❌';
  startGameBtn.disabled = !(slots[0] && slots[1]);
});

// Game (simple pong)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

let paddles = [
  { x: 30, y: H/2 - 60, w: 14, h: 120, vy: 0 },
  { x: W - 44, y: H/2 - 60, w: 14, h: 120, vy: 0 }
];

let ball = { x: W/2, y: H/2, r:10, vx: 6*(Math.random()>0.5?1:-1), vy: 4*(Math.random()>0.5?1:-1) };
let scores = [0,0];
let running = false;

socket.on('startGame', () => {
  reset();
  running = true;
});

socket.on('playerInput', ({ id, input }) => {
  // identify player index
  // server didn't send mapping of socketId->playerNumber to TV, so clients will use player slot mapping via rooms.
  // But simpler: controllers send 'player' property (we'll rely on controller to send it), if not present ignore
  if (!input || !input.player) return;
  const p = input.player - 1;
  if (!paddles[p]) return;
  // input: { left:bool, right:bool, boost:bool } for horizontal controls; we'll map to vertical
  if (input.left) paddles[p].vy = -8;
  else if (input.right) paddles[p].vy = 8;
  else paddles[p].vy = 0;

  if (input.boost) {
    // small boost effect: increase paddle size temporarily
    paddles[p].h = 160;
    setTimeout(()=> paddles[p].h = 120, 220);
  }
});

function reset(){
  ball.x = W/2; ball.y = H/2;
  ball.vx = 6*(Math.random()>0.5?1:-1);
  ball.vy = 4*(Math.random()>0.5?1:-1);
}

function step(){
  if (running){
    // move paddles
    paddles.forEach(p=>{
      p.y += p.vy;
      // clamp
      if (p.y < 10) p.y = 10;
      if (p.y + p.h > H - 10) p.y = H - 10 - p.h;
    });

    // move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // wall
    if (ball.y < 10 || ball.y > H - 10) ball.vy *= -1;

    // paddle collisions
    paddles.forEach((p, idx) => {
      if (ball.x - ball.r < p.x + p.w && ball.x + ball.r > p.x && ball.y > p.y && ball.y < p.y + p.h) {
        // reflect
        const dir = idx === 0 ? 1 : -1;
        ball.vx = Math.abs(ball.vx) * dir * 1.08; // speed up
        // tweak vertical velocity based on hit position
        const rel = (ball.y - (p.y + p.h/2)) / (p.h/2);
        ball.vy = rel * 6;
      }
    });

    // score
    if (ball.x < -40) { scores[1]++; running = false; setTimeout(()=> running = true, 900); reset(); }
    if (ball.x > W + 40) { scores[0]++; running = false; setTimeout(()=> running = true, 900); reset(); }
  }
  draw();
  requestAnimationFrame(step);
}

function draw(){
  // background
  ctx.clearRect(0,0,W,H);
  // fancy background
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#030305'); g.addColorStop(1,'#05050a');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // neon center line
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y=10;y<H-10;y+=28) ctx.fillRect(W/2-1,y,2,18);

  // paddles
  paddles.forEach((p, i)=>{
    // glow
    ctx.fillStyle = i===0 ? 'rgba(255,40,40,0.08)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(p.x-8, p.y-8, p.w+16, p.h+16);
    // core
    ctx.fillStyle = i===0 ? '#ff4a4a' : '#dfe9ff';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  });

  // ball
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
  ctx.fill();

  // scores
  ctx.fillStyle = '#fff';
  ctx.font = '40px system-ui';
  ctx.fillText(scores[0], W/2 - 80, 80);
  ctx.fillText(scores[1], W/2 + 60, 80);
}

requestAnimationFrame(step);