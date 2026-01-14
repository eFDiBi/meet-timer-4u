document.addEventListener('DOMContentLoaded', () => {
  const minutesInput = document.getElementById('minutes');
  const bgUrlInput = document.getElementById('bgUrl');
  const musicUrlInput = document.getElementById('musicUrl');
  const startBtn = document.getElementById('btn-start');
  const stopBtn = document.getElementById('btn-stop');

  // 1. Cargar preferencias guardadas al abrir
  chrome.storage.sync.get(['timerMinutes', 'bgUrl', 'musicUrl'], (data) => {
    if (data.timerMinutes) minutesInput.value = data.timerMinutes;
    if (data.bgUrl) bgUrlInput.value = data.bgUrl;
    if (data.musicUrl) musicUrlInput.value = data.musicUrl;
  });

  // 2. Botón Iniciar/Actualizar
  startBtn.addEventListener('click', () => {
    const minutes = parseInt(minutesInput.value) || 3;
    const bgUrl = bgUrlInput.value.trim();
    const musicUrl = musicUrlInput.value.trim();

    // Guardar preferencias
    chrome.storage.sync.set({
      timerMinutes: minutes,
      bgUrl: bgUrl,
      musicUrl: musicUrl
    });

    // Enviar mensaje a la pestaña activa (Google Meet)
    sendMessageToContentScript({
      action: 'START_TIMER',
      minutes: minutes,
      bgUrl: bgUrl,
      musicUrl: musicUrl
    });
  });

  // 3. Botón Detener
  stopBtn.addEventListener('click', () => {
    sendMessageToContentScript({ action: 'STOP_TIMER' });
  });

  function sendMessageToContentScript(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Error enviando mensaje: " + chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
});