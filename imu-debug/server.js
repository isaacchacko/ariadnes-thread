
// server.js on laptop
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public')); // Serves files in /public

app.post('/accel', (req, res) => {
  io.emit('accel-data', req.body); // push to browser clients
  res.sendStatus(200);
  console.log('detected');
});

app.post('/gyro', (req, res) => {
  io.emit('gyro-data', req.body); // push to browser clients
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.json("good");
  console.log('good ping');
});

server.listen(5000);
