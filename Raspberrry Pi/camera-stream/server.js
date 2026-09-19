const WebSocket = require('ws');
const { spawn } = require('child_process');

const wss = new WebSocket.Server({ port: 8080 });
console.log("WebSocket server on :8080");

let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log("Viewer connected");

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

// Spawn ffmpeg to read webcam and output MJPEG frames
const ffmpeg = spawn('ffmpeg', [
  '-f', 'v4l2',
  '-input_format', 'yuyv422',
  '-video_size', '640x480',
  '-framerate', '30',
  '-i', '/dev/video0',

  '-f', 'image2pipe',
  '-vcodec', 'mjpeg',
  '-q:v', '5',
  '-'
]);

ffmpeg.stdout.on('data', (chunk) => {
  // Send MJPEG chunks to all clients
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(chunk);
    }
  });
});

ffmpeg.stderr.on('data', data => {
  // Comment this after testing
  console.log(data.toString());
});