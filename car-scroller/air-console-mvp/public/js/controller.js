const socket = io();
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomInput');
const status = document.getElementById('status');
const controls = document.getElementById('controls');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const boostBtn = document.getElementById('boostBtn');

let playerNumber = null;
let joinedRoom = null;

joinBtn.onclick = () => {
  const room = (roomInput.value || '').trim().toUpperCase();
  if (!room) return status.textContent = 'Enter room code';
  socket.emit('joinRoom', { room }, (res) => {
    if (!res.ok) return status.textContent = res.error || 'Failed';
    playerNumber = res.player;
    joinedRoom = room;
    status.textContent = 'Joined as P' + playerNumber;
    controls.classList.remove('hidden');
    navigator.vibrate && navigator.vibrate(50);
  });
};

function sendInput(obj){
  if (!joinedRoom) return;
  // attach player id
  obj.player = playerNumber;
  socket.emit('input', { room: joinedRoom, input: obj });
}

// hold buttons behaviour
let leftDown=false, rightDown=false;
leftBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); leftDown=true; sendInput({ left:true });});
leftBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); leftDown=false; sendInput({});});
rightBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); rightDown=true; sendInput({ right:true });});
rightBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); rightDown=false; sendInput({});});

boostBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); sendInput({ boost:true }); navigator.vibrate && navigator.vibrate([40,20,40]);});