const CONFIG = {
    SERVER_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : 'http://tu-dominio.com:3001',
    UPDATE_INTERVAL: 5000
};

const state = {
    currentCamera: null,
    hls: null,
    cameras: [],
    isMuted: true
};

const elements = {
    video: document.getElementById('live-feed'),
    videoContainer: document.getElementById('video-container'),
    loading: document.querySelector('.loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    cameraName: document.getElementById('camera-name'),
    statusText: document.getElementById('status-text'),
    statusIndicator: document.getElementById('connection-status'),
    lastUpdate: document.getElementById('last-update'),
    resolutionInfo: document.getElementById('resolution-info')
};

const buttons = {
    cam1: document.getElementById('cam1-btn'),
    cam2: document.getElementById('cam2-btn'),
    cam3: document.getElementById('cam3-btn'),
    cam4: document.getElementById('cam4-btn'),
    refresh: document.getElementById('refresh-btn'),
    fullscreen: document.getElementById('fullscreen-btn'),
    mute: document.getElementById('mute-btn'),
    snapshot: document.getElementById('snapshot-btn')
};

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    setupEventListeners();
    await loadCameras();
    updateUI();
    setInterval(updateTime, CONFIG.UPDATE_INTERVAL);
}

function setupEventListeners() {
    buttons.cam1.addEventListener('click', () => switchCameraById('cam1'));
    buttons.cam2.addEventListener('click', () => switchCameraById('cam2'));
    buttons.cam3.addEventListener('click', () => switchCameraById('cam3'));
    buttons.cam4.addEventListener('click', () => switchCameraById('cam4'));
    
    buttons.refresh.addEventListener('click', refreshStream);
    buttons.fullscreen.addEventListener('click', toggleFullscreen);
    buttons.mute.addEventListener('click', toggleMute);
    buttons.snapshot.addEventListener('click', takeSnapshot);
    
    elements.video.addEventListener('loadedmetadata', handleVideoLoaded);
    elements.video.addEventListener('error', handleStreamError);
}

async function loadCameras() {
    try {
        const response = await fetch(`${CONFIG.SERVER_URL}/api/cameras`);
        state.cameras = await response.json();
        
        // Activar la primera cámara disponible
        if (state.cameras.length > 0) {
            switchCamera(state.cameras[0]);
        }
    } catch (error) {
        console.error("Error al cargar cámaras:", error);
        showError('Error al conectar con el servidor');
    }
}

function switchCameraById(cameraId) {
    const camera = state.cameras.find(cam => cam.id === cameraId);
    if (camera) {
        switchCamera(camera);
    }
}

function switchCamera(camera) {
    if (state.currentCamera && state.currentCamera.id === camera.id) return;
    
    // Reset UI
    elements.loading.style.display = 'flex';
    elements.loadingText.textContent = `Cargando ${camera.name}...`;
    elements.video.style.display = 'none';
    
    // Detener transmisión anterior
    if (state.hls) {
        state.hls.destroy();
        state.hls = null;
    }
    
    // Actualizar estado
    state.currentCamera = camera;
    updateUI();
    
    // Cargar nueva transmisión
    loadCameraStream(camera);
}

function loadCameraStream(camera) {
    const streamUrl = `${camera.streamUrl}?t=${Date.now()}`;
    
    if (Hls.isSupported()) {
        state.hls = new Hls({
            maxBufferLength: 10,
            maxMaxBufferLength: 60,
            maxBufferSize: 30 * 1000 * 1000,
            debug: true
        });
        
        state.hls.loadSource(streamUrl);
        state.hls.attachMedia(elements.video);
        
        state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            elements.video.play()
                .then(() => {
                    updateUI();
                })
                .catch(err => {
                    console.error('Error al reproducir:', err);
                    handleStreamError();
                });
        });
        
        state.hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('Error HLS:', data);
            if (data.fatal) {
                handleStreamError();
            }
        });
    } else if (elements.video.canPlayType('application/vnd.apple.mpegurl')) {
        elements.video.src = streamUrl;
        elements.video.addEventListener('loadedmetadata', () => {
            elements.video.play();
        });
    } else {
        handleStreamError();
    }
}

function handleVideoLoaded() {
    elements.video.style.display = 'block';
    elements.loading.style.display = 'none';
    updateResolutionInfo();
}

function handleStreamError() {
    elements.loadingText.textContent = 'Error al cargar la transmisión';
    elements.statusText.textContent = 'Error de conexión';
    elements.statusIndicator.classList.remove('connected');
    elements.statusIndicator.classList.add('disconnected');
    
    if (state.currentCamera) {
        setTimeout(() => switchCamera(state.currentCamera), 5000);
    }
}

function refreshStream() {
    if (state.currentCamera) {
        switchCamera(state.currentCamera);
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        elements.videoContainer.requestFullscreen().catch(err => {
            console.error("Error en pantalla completa:", err);
        });
    } else {
        document.exitFullscreen();
    }
}

function toggleMute() {
    state.isMuted = !state.isMuted;
    elements.video.muted = state.isMuted;
    buttons.mute.textContent = state.isMuted ? '🔊' : '🔇';
}

function takeSnapshot() {
    // Implementación de captura de pantalla
    alert('Función de captura no implementada');
}

function updateUI() {
    // Actualizar botones
    state.cameras.forEach(cam => {
        const btn = document.getElementById(`${cam.id}-btn`);
        if (btn) {
            btn.classList.toggle('active', state.currentCamera?.id === cam.id);
        }
    });
    
    // Actualizar información
    if (state.currentCamera) {
        elements.cameraName.textContent = state.currentCamera.name;
        elements.statusText.textContent = 'Conectado';
        elements.statusIndicator.classList.remove('disconnected');
        elements.statusIndicator.classList.add('connected');
    }
    
    updateTime();
}

function updateTime() {
    elements.lastUpdate.textContent = new Date().toLocaleString();
}

function updateResolutionInfo() {
    if (elements.video.videoWidth) {
        elements.resolutionInfo.textContent = 
            `${elements.video.videoWidth}×${elements.video.videoHeight}`;
    }
}

function showError(message) {
    elements.statusText.textContent = message;
    elements.statusIndicator.classList.remove('connected');
    elements.statusIndicator.classList.add('disconnected');
    elements.loadingText.textContent = message;
}