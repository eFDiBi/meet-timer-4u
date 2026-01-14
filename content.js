/**
 * Meet Timer Extension - Content Script (Final Version)
 * Fixes: "Tiempo Cumplido" text and Clean Event Listeners removal.
 */

const CLASSES = {
  ROOT_ID: 'mt-ext-root',
  TIMER: 'mt-ext-timer',
  URGENT: 'mt-ext-timer--urgent',
  FINISHED: 'mt-ext-timer--finished',
  IFRAME: 'mt-ext-audio-frame',
  CLOSE_BTN: 'mt-ext-close-btn',
  VISIBLE: 'is-visible'
};

const CSS_VARS = {
  BG_IMAGE: '--mt-bg-image'
};

// Estado global extendido para manejar limpieza de eventos
let timerState = {
  intervalId: null,
  overlay: null,
  timerTextElement: null,
  closeBtn: null,
  iframe: null,
  // Guardamos las referencias a las funciones para poder hacer removeEventListener
  dragHandlers: {
    move: null,
    up: null
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'START_TIMER') {
      startTimer(request);
    } else if (request.action === 'STOP_TIMER') {
      cleanup();
    }
    sendResponse({ status: 'success' });
  } catch (error) {
    console.error('[Meet Timer] Error:', error);
  }
  return true; 
});

function startTimer({ minutes, bgUrl, musicUrl }) {
  cleanup(); // Limpia cualquier residuo anterior
  createDOMStructure();
  applyPreferences(bgUrl, musicUrl);
  makeDraggable(timerState.overlay);
  runCountdown(minutes);
}

function createDOMStructure() {
  const overlay = document.createElement('div');
  overlay.id = CLASSES.ROOT_ID;
  overlay.title = "Arrastra para mover";

  // Botón de cerrar
  const closeBtn = document.createElement('button');
  closeBtn.className = CLASSES.CLOSE_BTN;
  closeBtn.innerHTML = '&times;';
  
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cleanup(); // Al cerrar, limpiamos todo
  });
  
  closeBtn.addEventListener('mousedown', (e) => e.stopPropagation());

  // Texto del timer
  const timerText = document.createElement('h1');
  timerText.className = CLASSES.TIMER;
  
  overlay.appendChild(closeBtn);
  overlay.appendChild(timerText);
  document.body.appendChild(overlay);

  timerState.overlay = overlay;
  timerState.timerTextElement = timerText;
  timerState.closeBtn = closeBtn;
}

function applyPreferences(bgUrl, musicUrl) {
  if (bgUrl) {
    const cleanUrl = bgUrl.trim();
    timerState.overlay.style.setProperty(CSS_VARS.BG_IMAGE, `url("${cleanUrl}")`);
  } else {
    timerState.overlay.style.removeProperty(CSS_VARS.BG_IMAGE);
  }

  if (musicUrl) {
    const videoId = extractVideoID(musicUrl);
    if (videoId) {
      const iframe = document.createElement('iframe');
      iframe.className = CLASSES.IFRAME;
      iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0`;
      iframe.allow = "autoplay";
      timerState.overlay.appendChild(iframe);
      timerState.iframe = iframe;
    }
  }
}

function runCountdown(minutes) {
  let totalSeconds = minutes * 60;
  updateDisplay(totalSeconds);

  timerState.intervalId = setInterval(() => {
    totalSeconds--;
    if (totalSeconds < 0) {
      handleFinish();
      return;
    }
    updateDisplay(totalSeconds);
  }, 1000);
}

function updateDisplay(secondsLeft) {
  const { timerTextElement } = timerState;
  if (!timerTextElement) return;

  if (secondsLeft > 59) {
    const mins = Math.ceil(secondsLeft / 60);
    timerTextElement.innerText = `${mins} min`;
    timerTextElement.classList.remove(CLASSES.URGENT);
  } else {
    timerTextElement.innerText = secondsLeft.toString();
    if (secondsLeft <= 10) {
      timerTextElement.classList.add(CLASSES.URGENT);
    } else {
      timerTextElement.classList.remove(CLASSES.URGENT);
    }
  }
}

function handleFinish() {
  clearInterval(timerState.intervalId);
  const { timerTextElement, iframe, closeBtn } = timerState;
  
  if (timerTextElement) {
    // CAMBIO 1: Texto actualizado
    timerTextElement.innerText = "TIEMPO CUMPLIDO";
    timerTextElement.classList.remove(CLASSES.URGENT);
    timerTextElement.classList.add(CLASSES.FINISHED);
  }

  if (closeBtn) {
    closeBtn.classList.add(CLASSES.VISIBLE);
  }
  
  if (iframe) iframe.remove();
}

/**
 * Función crítica para evitar bugs de reinicio.
 * Limpia el DOM, los intervalos Y los event listeners globales.
 */
function cleanup() {
  // 1. Detener intervalo
  if (timerState.intervalId) clearInterval(timerState.intervalId);
  
  // 2. Limpiar listeners globales de window (BUGFIX)
  if (timerState.dragHandlers.move) {
    window.removeEventListener('mousemove', timerState.dragHandlers.move);
  }
  if (timerState.dragHandlers.up) {
    window.removeEventListener('mouseup', timerState.dragHandlers.up);
  }

  // 3. Eliminar elemento del DOM
  const existingOverlay = document.getElementById(CLASSES.ROOT_ID);
  if (existingOverlay) existingOverlay.remove();

  // 4. Resetear estado
  timerState = {
    intervalId: null,
    overlay: null,
    timerTextElement: null,
    closeBtn: null,
    iframe: null,
    dragHandlers: { move: null, up: null }
  };
}

function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  // Funciones handler definidas para poder ser removidas luego
  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    element.style.left = `${initialLeft + dx}px`;
    element.style.top = `${initialTop + dy}px`;
    element.style.right = 'auto'; 
    element.style.bottom = 'auto';
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'move';
      element.style.transition = 'transform 0.1s, opacity 0.3s ease';
    }
  };

  // Guardamos referencias en el estado global para cleanup()
  timerState.dragHandlers.move = onMouseMove;
  timerState.dragHandlers.up = onMouseUp;

  // Listeners
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  element.addEventListener('mousedown', (e) => {
    if (e.target.closest('.' + CLASSES.CLOSE_BTN)) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = element.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    element.style.cursor = 'grabbing';
    element.style.transition = 'none';
    e.preventDefault();
  });
}

function extractVideoID(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}