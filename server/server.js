const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;

// Configuración simplificada de cámaras
const cameras = [
  {
    id: 'cam1',
    name: 'Cámara 1',
    rtsp: 'rtsp://radio:Conectar123456@192.168.10.69:554',
    hlsPath: '/streams/cam1/stream.m3u8'
  }
  // Puedes agregar las demás cámaras después
];

// Middlewares esenciales
app.use(cors());
app.use(express.static(path.join(__dirname, '../client')));

// Crear directorios para streams
cameras.forEach(cam => {
  const dir = path.join(__dirname, 'streams', cam.id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Función FFmpeg optimizada
function startFFmpegStream(camera) {
  const outputPath = path.join(__dirname, camera.hlsPath);
  const segmentPath = path.join(__dirname, 'streams', camera.id, 'segment_%03d.ts');
  
  const ffmpegCmd = `ffmpeg -loglevel error -rtsp_transport tcp -i "${camera.rtsp}" ` +
    `-c:v libx264 -preset ultrafast -tune zerolatency -vf "scale=1280:720" ` +
    `-f hls -hls_time 2 -hls_list_size 3 -hls_flags delete_segments ` +
    `-hls_segment_filename "${segmentPath}" "${outputPath}"`;

  console.log(`[Stream] Iniciando ${camera.name}`);
  return exec(ffmpegCmd);
}

// Endpoints básicos
app.get('/test', (req, res) => {
  res.status(200).send('Servidor funcionando');
});

app.get('/api/cameras', (req, res) => {
  res.json(cameras);
});

// Servir HLS sin autenticación
app.use('/streams', express.static(path.join(__dirname, 'streams')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  Servidor activo en:
  - Local:   http://localhost:${PORT}
  - Red:     http://${require('ip').address()}:${PORT}
  `);
  
  // Iniciar streams
  cameras.forEach(cam => startFFmpegStream(cam));
});

// Manejo de errores
server.on('error', (err) => {
  console.error('Error en servidor:', err);
});