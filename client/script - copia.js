// Configuración
const CONFIG = {
    SERVER_URL: 'https://200.123.35.18',
    AUTH_USER: 'operador',
    AUTH_PASS: 'Operador456#',
    UPDATE_INTERVAL: 5000
};

// Estado de la aplicación
const state = {
    currentCamera: null,
    hls: null,
    cameras: [],
    isMuted: true,
    streamLoaded: false
};

// Elementos del DOM
const elements = {
    video: document.getElementById('live-feed'),
    videoContainer: document.getElementById('video-container'),
    loading: document.querySelector('.loading'),
    cameraName: document.getElementById('camera-name'),
    statusText: document.getElementById('status-text'),
    statusIndicator: document.getElementById('status-indicator'),
    lastUpdate: document.getElementById('last-update'),
    resolutionInfo: document.getElementById('resolution-info'),
    snapshotCanvas: document.getElementById('snapshot-canvas'),
    snapshotModal: document.getElementById('snapshot-modal'),
    modalClose: document.querySelector('.close')
};

// Botones
const buttons = {
    cam1: document.getElementById('cam1-btn'),
    cam2: document.getElementById('cam2-btn'),
    cam3: document.getElementById('cam3-btn'),
    cam4: document.getElementById('cam4-btn'),
    refresh: document.getElementById('refresh-btn'),
    fullscreen: document.getElementById('fullscreen-btn'),
    mute: document.getElementById('mute-btn'),
    snapshot: document.getElementById('snapshot-btn'),
    download: document.getElementById('download-btn')
};

// Inicialización
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    setupEventListeners();
    await loadCameras();
    if (state.cameras.length > 0) {
        switchCamera(state.cameras[0]);
    }
    startUpdateTimer();
}

function setupEventListeners() {
    // Botones de cámara
    buttons.cam1.addEventListener('click', () => switchCameraById('cam1'));
    buttons.cam2.addEventListener('click', () => switchCameraById('cam2'));
    buttons.cam3.addEventListener('click', () => switchCameraById('cam3'));
    buttons.cam4.addEventListener('click', () => switchCameraById('cam4'));
    
    // Botones de control
    buttons.refresh.addEventListener('click', refreshStream);
    buttons.fullscreen.addEventListener('click', toggleFullscreen);
    buttons.mute.addEventListener('click', toggleMute);
    buttons.snapshot.addEventListener('click', takeSnapshot);
    buttons.download.addEventListener('click', downloadSnapshot);
    elements.modalClose.addEventListener('click', () => {
        elements.snapshotModal.style.display = 'none';
    });
    
    // Eventos del video
    elements.video.addEventListener('loadedmetadata', handleVideoLoaded);
    elements.video.addEventListener('error', handleStreamError);
}

async function loadCameras() {
    try {
        const response = await fetchWithAuth(`${CONFIG.SERVER_URL}/api/cameras`);
        state.cameras = await response.json();
        updateUI();
    } catch (error) {
        console.error('Error al cargar cámaras:', error);
        showError('Error al conectar con el servidor');
    }
}

function switchCameraById(cameraId) {
    const camera = state.cameras.find(cam => cam.id === cameraId);
    if (camera) switchCamera(camera);
}

function switchCamera(camera) {
    if (state.currentCamera && state.currentCamera.id === camera.id) return;
    
    // Reset UI
    elements.loading.style.display = 'flex';
    elements.video.style.display = 'none';
    state.streamLoaded = false;
    
    // Detener stream anterior
    if (state.hls) {
        state.hls.destroy();
        state.hls = null;
    }
    
    // Actualizar estado
    state.currentCamera = camera;
    updateUI();
    
    // Iniciar nuevo stream
    startStream(camera);
}

function startStream(camera) {
    if (Hls.isSupported()) {
        state.hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 5.0
        });
        
        state.hls.loadSource(camera.streamUrl);
        state.hls.attachMedia(elements.video);
        
        state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            elements.video.play()
                .then(() => {
                    state.streamLoaded = true;
                    updateUI();
                })
                .catch(handleStreamError);
        });
        
        state.hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                handleStreamError();
            }
        });
    } else if (elements.video.canPlayType('application/vnd.apple.mpegurl')) {
        // Soporte para Safari
        elements.video.src = camera.streamUrl;
        elements.video.addEventListener('loadedmetadata', () => {
            elements.video.play()
                .then(() => {
                    state.streamLoaded = true;
                    updateUI();
                })
                .catch(handleStreamError);
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
    elements.loading.querySelector('p').textContent = 'Error al cargar la transmisión';
    elements.statusText.textContent = 'Error de conexión';
    elements.statusIndicator.className = 'status-indicator disconnected';
    
    // Reintentar después de 5 segundos
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
            console.error('Error al entrar en pantalla completa:', err);
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
    if (!state.streamLoaded) return;
    
    const canvas = elements.snapshotCanvas;
    const video = elements.video;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    
    elements.snapshotModal.style.display = 'flex';
}

function downloadSnapshot() {
    const link = document.createElement('a');
    link.download = `captura-${state.currentCamera.name}-${new Date().toISOString()}.png`;
    link.href = elements.snapshotCanvas.toDataURL('image/png');
    link.click();
}

function updateUI() {
    // Actualizar botones
    Object.keys(buttons).forEach(key => {
        if (key.startsWith('cam')) {
            buttons[key].classList.toggle('active', state.currentCamera?.id === key);
        }
    });
    
    // Actualizar información de cámara
    if (state.currentCamera) {
        elements.cameraName.textContent = state.currentCamera.name;
        elements.statusText.textContent = state.streamLoaded ? 'Conectado' : 'Conectando...';
        elements.statusIndicator.className = `status-indicator ${state.streamLoaded ? 'connected' : 'disconnected'}`;
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

function startUpdateTimer() {
    setInterval(updateTime, CONFIG.UPDATE_INTERVAL);
}

async function fetchWithAuth(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Basic ' + btoa(`${CONFIG.AUTH_USER}:${CONFIG.AUTH_PASS}`));
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
}

function showError(message) {
    elements.statusText.textContent = message;
    elements.statusIndicator.className = 'status-indicator disconnected';
    alert(message);
}

// Cierre adecuado de la aplicación
window.addEventListener('beforeunload', () => {
    if (state.hls) {
        state.hls.destroy();
    }
});