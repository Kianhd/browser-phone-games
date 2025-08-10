const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms storage
const rooms = new Map();

// Generate room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // TV creates a room
    socket.on('create-room', () => {
        const roomCode = generateRoomCode();
        rooms.set(roomCode, {
            tv: socket.id,
            players: [],
            gameState: {
                player1: { y: 250, score: 0 },
                player2: { y: 250, score: 0 },
                ball: { x: 400, y: 300, vx: 5, vy: 3 },
                gameStarted: false
            }
        });
        socket.join(roomCode);
        socket.emit('room-created', roomCode);
        console.log('Room created:', roomCode);
    });

    // Controller joins a room
    socket.on('join-room', (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }
        
        if (room.players.length >= 2) {
            socket.emit('error', 'Room is full');
            return;
        }

        const playerNumber = room.players.length + 1;
        room.players.push({
            id: socket.id,
            number: playerNumber
        });
        
        socket.join(roomCode);
        socket.emit('joined-room', { roomCode, playerNumber });
        
        // Notify TV about new player
        io.to(room.tv).emit('player-joined', { 
            playerNumber, 
            totalPlayers: room.players.length 
        });
        
        console.log(`Player ${playerNumber} joined room ${roomCode}`);
    });

    // Start game
    socket.on('start-game', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && room.players.length === 2) {
            room.gameState.gameStarted = true;
            io.to(roomCode).emit('game-started');
            startGameLoop(roomCode);
        }
    });

    // Controller input
    socket.on('controller-input', ({ roomCode, direction }) => {
        const room = rooms.get(roomCode);
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        const paddle = player.number === 1 ? room.gameState.player1 : room.gameState.player2;
        
        // Move paddle
        if (direction === 'up' && paddle.y > 50) {
            paddle.y -= 20;
        } else if (direction === 'down' && paddle.y < 450) {
            paddle.y += 20;
        }
        
        // Send update to TV
        io.to(room.tv).emit('game-update', room.gameState);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        // Clean up rooms
        for (const [code, room] of rooms.entries()) {
            if (room.tv === socket.id) {
                io.to(code).emit('room-closed');
                rooms.delete(code);
                console.log('Room closed:', code);
            } else {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    io.to(room.tv).emit('player-left', { 
                        playerNumber: playerIndex + 1,
                        totalPlayers: room.players.length 
                    });
                }
            }
        }
    });
});

// Game physics loop
function startGameLoop(roomCode) {
    const interval = setInterval(() => {
        const room = rooms.get(roomCode);
        if (!room || !room.gameState.gameStarted) {
            clearInterval(interval);
            return;
        }
        
        const state = room.gameState;
        const ball = state.ball;
        
        // Move ball
        ball.x += ball.vx;
        ball.y += ball.vy;
        
        // Ball collision with top/bottom walls
        if (ball.y <= 20 || ball.y >= 580) {
            ball.vy = -ball.vy;
        }
        
        // Ball collision with paddles
        // Left paddle (player 1)
        if (ball.x <= 70 && ball.x >= 50 && 
            ball.y >= state.player1.y - 50 && 
            ball.y <= state.player1.y + 50) {
            ball.vx = Math.abs(ball.vx);
        }
        
        // Right paddle (player 2)
        if (ball.x >= 730 && ball.x <= 750 && 
            ball.y >= state.player2.y - 50 && 
            ball.y <= state.player2.y + 50) {
            ball.vx = -Math.abs(ball.vx);
        }
        
        // Score
        if (ball.x < 0) {
            state.player2.score++;
            resetBall(ball);
        } else if (ball.x > 800) {
            state.player1.score++;
            resetBall(ball);
        }
        
        // Check win condition
        if (state.player1.score >= 5 || state.player2.score >= 5) {
            const winner = state.player1.score >= 5 ? 1 : 2;
            io.to(roomCode).emit('game-over', { winner });
            room.gameState.gameStarted = false;
            clearInterval(interval);
            return;
        }
        
        // Send update to all clients in room
        io.to(roomCode).emit('game-update', state);
    }, 1000 / 60); // 60 FPS
}

function resetBall(ball) {
    ball.x = 400;
    ball.y = 300;
    ball.vx = (Math.random() > 0.5 ? 1 : -1) * 5;
    ball.vy = (Math.random() - 0.5) * 6;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});