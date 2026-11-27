// WebSocket Server for Remote Control
// Run separately: bun run server.ts
// OR deploy as standalone service

import { Server } from 'socket.io';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

console.log(`WebSocket server running on port ${PORT}`);

io.on('connection', (socket) => {
  console.log('Device connected:', socket.id);
  
  // Broadcast all remote inputs to other devices
  socket.on('remote-input', (data) => {
    // Send to all other connected devices (the game)
    socket.broadcast.emit('remote-input', data);
    console.log('Input:', data);
  });
  
  // Broadcast analog values
  socket.on('remote-analog', (data) => {
    socket.broadcast.emit('remote-analog', data);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Device disconnected:', socket.id);
  });
});
