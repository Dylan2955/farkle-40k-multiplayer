// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

let gameState = {};


// Tell Express to serve the static files (HTML, CSS, client-side JS) from the 'public' directory
app.use(express.static('public'));

// This runs when a new player connects
io.on('connection', (socket) => {
  console.log('A user connected with socket ID:', socket.id);

  // --- ADD THIS NEW LISTENER ---
  socket.on('startGame', () => {
    console.log('Received startGame request. Initializing game...');

    // Create the initial game state (this is the "source of truth")
    gameState = {
      players: [
          { id: 0, name: 'Player Commander', score: 0, isOnBoard: false },
          { id: 1, name: 'AI Heretek', score: 0, isOnBoard: false },
      ],
      currentPlayerIndex: 0,
      turnScore: 0,
      dice: Array.from({ length: 6 }, (_, i) => ({ id: i, value: 1, isSelected: false, isLocked: false, isScoring: false })),
      log: ["The battle for glory begins!"],
      status: 'PlayerTurn',
    };

    // Broadcast the brand new game state to EVERYONE connected
    io.emit('gameStateUpdate', gameState);
  });
  // --- END OF NEW LISTENER ---


  socket.on('disconnect', () => {
    console.log('User disconnected with socket ID:', socket.id);
  });
});
  
  // We will add all our game logic here later!
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});