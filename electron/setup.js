const { ipcRenderer } = require('electron');

const form = document.getElementById('setupForm');
const errorEl = document.getElementById('error');
const progressEl = document.getElementById('progress');
const startBtn = document.getElementById('startBtn');

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.add('visible');
}

function hideError() {
  errorEl.classList.remove('visible');
}

function showProgress() {
  form.style.display = 'none';
  progressEl.classList.add('visible');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  
  const groqApiKey = document.getElementById('groqApiKey').value.trim();
  const zenApiKey = document.getElementById('zenApiKey').value.trim();
  const piperVoicePath = document.getElementById('piperVoicePath').value.trim();
  const locationLat = document.getElementById('locationLat').value.trim();
  const locationLon = document.getElementById('locationLon').value.trim();
  
  if (!groqApiKey) {
    showError('Groq API Key is required');
    return;
  }
  
  if (!zenApiKey) {
    showError('Zen API Key is required');
    return;
  }
  
  const lat = parseFloat(locationLat);
  const lon = parseFloat(locationLon);
  
  if (isNaN(lat) || lat < -90 || lat > 90) {
    showError('Invalid latitude (must be between -90 and 90)');
    return;
  }
  
  if (isNaN(lon) || lon < -180 || lon > 180) {
    showError('Invalid longitude (must be between -180 and 180)');
    return;
  }
  
  startBtn.disabled = true;
  showProgress();
  
  const config = {
    groqApiKey,
    zenApiKey,
    piperVoicePath: piperVoicePath || '',
    locationLat,
    locationLon,
  };
  
  try {
    ipcRenderer.send('setup-complete', config);
  } catch (err) {
    showError('Failed to save configuration: ' + err.message);
    form.style.display = 'block';
    progressEl.classList.remove('visible');
    startBtn.disabled = false;
  }
});