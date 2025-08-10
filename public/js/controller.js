const socket = io();
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomInput');
const joinStatus = document.getElementById('joinStatus');
const controllerArea = document.getElementById('controllerArea');
const meLabel = document.getElementById('meLabel');

const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');
const actionBtn = document.getElementById('actionBtn');

let joinedRoom = null;
let playerNumber = null;
let holdInterval = null;
let currentState = { left:false, right:false, up:false, down:false, action:false };

// allow prefill via query param ?r=CODE
(function prefill(){
  const params = new URLSearchParams(location.search);
  const r = params.get('r');
  if (r) roomInput.value = r;
})();

joinBtn.onclick = async () => {
  const room = (roomInput.value || '').trim().toUpperCase();
  if (!room) return joinStatus.textContent = 'Enter room code';
  socket.emit('joinRoom', { room }, (res) => {
    if (!res.ok) {
      joinStatus.textContent = res.error || 'Failed to join';
      return;
    }
    joinedRoom = room;
    playerNumber = res.player;
    meLabel.textContent = `Joined as P${playerNumber}`;
    joinStatus.textContent = '';
    controllerArea.classList.remove('hidden');
    navigator.vibrate && navigator.vibrate(40);
  });
};

function sendState(){
  if (!joinedRoom) return;
  socket.emit('input', { room: joinedRoom, input: currentState });
}

// helper to begin repeating sends while holding
function startHold() {
  sendState(); // immediate
  if (holdInterval) clearInterval(holdInterval);
  holdInterval = setInterval(sendState, 80); // 80ms for smooth continuous updates
}
function stopHold() {
  if (holdInterval) clearInterval(holdInterval);
  holdInterval = null;
  // reset movement flags
  currentState.left = currentState.right = currentState.up = currentState.down = false;
  sendState();
}

// unify touch+mouse for buttons
function addHold(button, onSetTrue, onSetFalse){
  let isDown = false;
  const start = (e) => { e.preventDefault(); if (isDown) return; isDown = true; onSetTrue(); startHold(); };
  const end = (e) => { e.preventDefault(); if (!isDown) return; isDown = false; onSetFalse(); stopHold(); };
  button.addEventListener('touchstart', start, {passive:false});
  button.addEventListener('touchend', end, {passive:false});
  button.addEventListener('mousedown', start);
  window.addEventListener('mouseup', end);
}

// wire controls
addHold(leftBtn, ()=> { currentState.left = true; }, ()=> { currentState.left = false; });
addHold(rightBtn, ()=> { currentState.right = true; }, ()=> { currentState.right = false; });
addHold(upBtn, ()=> { currentState.up = true; }, ()=> { currentState.up = false; });
addHold(downBtn, ()=> { currentState.down = true; }, ()=> { currentState.down = false; });

// action is a quick tap (not continuous)
function actionTap(){
  currentState.action = true;
  sendState();
  setTimeout(()=> { currentState.action = false; }, 120);
}
actionBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); actionTap(); navigator.vibrate && navigator.vibrate(50); }, {passive:false});
actionBtn.addEventListener('mousedown', (e)=>{ e.preventDefault(); actionTap(); });