/* ===== Socket / UI ===== */
const socket = io();

const createRoomBtn = document.getElementById('createRoom');
const startGameBtn  = document.getElementById('startGame');
const roomCodeEl    = document.getElementById('roomCode');
const qrImg         = document.getElementById('qrImg');
const modeSelect    = document.getElementById('modeSelect');
const playersStatus = document.getElementById('playersStatus');

let currentRoom = null;
let slots = [false, false, false, false];
let mode  = 2;

createRoomBtn.onclick = () => {
  socket.emit('createRoom', (res) => {
    currentRoom = res.room;
    roomCodeEl.textContent = currentRoom;
    updateQr();
    navigator.vibrate && navigator.vibrate(40);
  });
};

startGameBtn.onclick = () => {
  if (!currentRoom) return alert('Create a room first');
  mode = parseInt(modeSelect.value || '2', 10);
  socket.emit('startGame', { room: currentRoom, mode });
};

socket.on('roomUpdate', data => {
  if (!data) return;
  slots = data.slots;
  for (let i=0;i<4;i++){
    const el = playersStatus.querySelector(`.pstatus[data-i="${i+1}"] .stat`);
    if (el) el.textContent = slots[i] ? '🟢' : '❌';
  }
  startGameBtn.disabled = !(slots[0] && slots[1]);
});

socket.on('startGame', ({ mode: m }) => {
  mode = m || 2;
  initGame(mode);
});

function updateQr(){
  if (!currentRoom) { qrImg.src=''; return; }
  const joinUrl = `${location.origin}/controller.html?r=${currentRoom}`;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}`;
  qrImg.alt = joinUrl;
}

/* ===== Hi-DPI Canvas Setup ===== */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas(){
  const rectW = Math.min(window.innerWidth - 32, 1280);
  const aspect = 16/9;
  const rectH = Math.min(window.innerHeight - 120, Math.round(rectW / aspect));
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR for perf
  canvas.style.width = `${rectW}px`;
  canvas.style.height = `${rectH}px`;
  canvas.width  = Math.round(rectW  * dpr);
  canvas.height = Math.round(rectH * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0); // draw in CSS pixels
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

/* ===== Game State ===== */
const W = () => parseFloat(getComputedStyle(canvas).width);
const H = () => parseFloat(getComputedStyle(canvas).height);

const palette = {
  p1: getCss('--player1', '#ff2b2b'),
  p2: getCss('--player2', '#ffffff'),
  p3: getCss('--player3', '#ffd166'),
  p4: getCss('--player4', '#6ec1ff'),
};

const paddles = [
  { type:'v', x: 34, y: 0, w: 16, h: 160, vy: 0, color: palette.p1 },
  { type:'v', x: () => W() - 50, y: 0, w: 16, h: 160, vy: 0, color: palette.p2 },
  { type:'h', x: 0, y: 24, w: 200, h: 14, vx: 0, color: palette.p3 },
  { type:'h', x: 0, y: () => H() - 38, w: 200, h: 14, vx: 0, color: palette.p4 },
];

let ball = { x:0, y:0, r:10, vx:6, vy:4, trail:[] };
let running = false;
let shake = 0; // screenshake timer

/* ===== Inputs from Controllers ===== */
socket.on('playerInput', ({ player, input }) => {
  const i = player - 1;
  if (i < 0 || i > 3) return;
  if (paddles[i].type === 'v') {
    // vertical paddles -> left = up, right = down (continuous)
    const speed = 9;
    paddles[i].vy = input.left ? -speed : input.right ? speed : 0;
    if (input.action) pulsePaddle(i, 'h');
  } else {
    // horizontal paddles -> up = left, down = right
    const speed = 10;
    paddles[i].vx = input.up ? -speed : input.down ? speed : 0;
    if (input.action) pulsePaddle(i, 'w');
  }
});

/* ===== Visual Helpers ===== */
function getCss(varName, fallback){ return (getComputedStyle(document.documentElement).getPropertyValue(varName) || fallback).trim(); }
function roundRect(x,y,w,h,r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}
function glowFill(color, size, drawCb){
  ctx.save();
  ctx.shadowBlur = size;
  ctx.shadowColor = color;
  ctx.globalCompositeOperation = 'lighter';
  drawCb();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
function pulsePaddle(idx, prop){
  const p = paddles[idx];
  const base = p[prop];
  const target = p[prop] + (prop==='h' ? 80 : 80);
  let t = 0;
  const anim = () => {
    t += 0.12;
    p[prop] = base + (target - base) * Math.sin(Math.min(1,t))*0.5;
    if (t < 1) requestAnimationFrame(anim); else p[prop] = base;
  };
  anim();
}

/* ===== Particles / Trail ===== */
const sparks = [];
function spawnImpact(x,y,color){
  for(let i=0;i<12;i++){
    sparks.push({
      x, y,
      vx:(Math.random()*2-1)*4,
      vy:(Math.random()*2-1)*4,
      a:1,
      color
    });
  }
  shake = 12; // screen shake on impact
}
function updateSparks(){
  for(let i=sparks.length-1;i>=0;i--){
    const s = sparks[i];
    s.x += s.vx; s.y += s.vy;
    s.vx *= 0.96; s.vy *= 0.96;
    s.a -= 0.04;
    if (s.a <= 0) sparks.splice(i,1);
  }
}
function drawSparks(){
  sparks.forEach(s=>{
    ctx.save();
    ctx.globalAlpha = Math.max(0,s.a);
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x-1, s.y-1, 2, 2);
    ctx.restore();
  });
}

/* ===== Game Init / Reset ===== */
function initGame(m){
  running = true;
  // place paddles center
  paddles[0].y = H()/2 - paddles[0].h/2;
  paddles[1].y = H()/2 - paddles[1].h/2;
  paddles[2].x = W()/2 - paddles[2].w/2;
  paddles[3].x = W()/2 - paddles[3].w/2;
  resetBall();
}
function resetBall(){
  ball.x = W()/2; ball.y = H()/2;
  ball.vx = 6 * (Math.random()>0.5? 1:-1);
  ball.vy = 4 * (Math.random()>0.5? 1:-1);
  ball.trail.length = 0;
}

/* ===== Physics & Draw Loop ===== */
function step(){
  // background (vignette + subtle grid)
  drawBackground();

  if (running){
    // update paddles (clamp)
    paddles[0].y = clamp(paddles[0].y + paddles[0].vy, 8, H()-8-paddles[0].h);
    paddles[1].y = clamp(paddles[1].y + paddles[1].vy, 8, H()-8-paddles[1].h);
    paddles[2].x = clamp(paddles[2].x + paddles[2].vx, 8, W()-8-paddles[2].w);
    paddles[3].x = clamp(paddles[3].x + paddles[3].vx, 8, W()-8-paddles[3].w);

    // ball trail
    ball.trail.push({x:ball.x, y:ball.y, a:0.25});
    if (ball.trail.length > 14) ball.trail.shift();

    // move ball
    ball.x += ball.vx; ball.y += ball.vy;

    // walls (with soft bounce)
    if (ball.y < 8 || ball.y > H()-8){ ball.vy *= -1; }
    if (ball.x < 8 || ball.x > W()-8){ ball.vx *= -1; }

    // collisions with paddles
    collideWithVertical(ball, paddles[0], +1);
    collideWithVertical(ball, { ...paddles[1], x: typeof paddles[1].x==='function'? paddles[1].x(): paddles[1].x }, -1);
    collideWithHorizontal(ball, paddles[2], +1);
    collideWithHorizontal(ball, { ...paddles[3], y: typeof paddles[3].y==='function'? paddles[3].y(): paddles[3].y }, -1);

    // update particles
    updateSparks();
  }

  // screen shake
  if (shake > 0) shake--;

  // draw paddles, ball, fx
  ctx.save();
  if (shake>0) ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);

  drawPaddles();
  drawBall();

  ctx.restore();

  drawSparks();
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

/* ===== Collision Helpers ===== */
function collideWithVertical(b, p, dir){
  const px = typeof p.x==='function'? p.x(): p.x;
  if (b.x - b.r < px + p.w && b.x + b.r > px && b.y > p.y && b.y < p.y + p.h){
    b.vx = Math.abs(b.vx) * dir * 1.05;
    const rel = (b.y - (p.y + p.h/2)) / (p.h/2);
    b.vy = clamp(rel * 6, -8, 8);
    b.x += dir * 6;
    spawnImpact(px + p.w/2, b.y, p.color);
  }
}
function collideWithHorizontal(b, p, dir){
  const py = typeof p.y==='function'? p.y(): p.y;
  if (b.y - b.r < py + p.h && b.y + b.r > py && b.x > p.x && b.x < p.x + p.w){
    b.vy = Math.abs(b.vy) * dir * 1.05;
    const rel = (b.x - (p.x + p.w/2)) / (p.w/2);
    b.vx = clamp(rel * 6, -8, 8);
    b.y += dir * 6;
    spawnImpact(b.x, py + p.h/2, p.color);
  }
}

/* ===== Draw Pieces ===== */
function drawBackground(){
  const w = W(), h = H();
  // gradient base
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, '#0b0b10');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

  // mild center sheen
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y=24;y<h-24;y+=36) ctx.fillRect(w/2-1, y, 2, 18);

  // vignette
  const vg = ctx.createRadialGradient(w/2,h/2, Math.min(w,h)*0.2, w/2,h/2, Math.max(w,h)*0.7);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0,0,w,h);
}

function drawPaddles(){
  // soft glow + rounded paddles
  paddles.forEach((p, idx)=>{
    const x = typeof p.x==='function'? p.x(): p.x;
    const y = typeof p.y==='function'? p.y(): p.y;
    ctx.save();
    glowFill(p.color, 18, ()=>{
      roundRect(x-6, y-6, p.w+12, p.h+12, 10);
    });
    ctx.fillStyle = p.color;
    roundRect(x, y, p.w, p.h, 8);
    ctx.fill();
    ctx.restore();
  });
}

function drawBall(){
  // trail
  for (let i=0;i<ball.trail.length;i++){
    const t = ball.trail[i];
    ctx.save();
    ctx.globalAlpha = (i/ball.trail.length) * t.a;
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(t.x, t.y, ball.r*(0.7 + i/ball.trail.length*0.3), 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // core glow
  glowFill('#ffffff', 20, ()=>{
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r+2, 0, Math.PI*2);
  });
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();
}

/* ===== Utils ===== */
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }