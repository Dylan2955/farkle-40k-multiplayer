// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Tell Express to serve the static files (HTML, CSS, client-side JS) from the 'public' directory
app.use(express.static('public'));

// This runs when a new player connects to the server
io.on('connection', (socket) => {
  console.log('A user connected with socket ID:', socket.id);

  // This runs when that player disconnects
  socket.on('disconnect', () => {
    console.log('User disconnected with socket ID:', socket.id);
  });
  
  // We will add all our game logic here later!
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});