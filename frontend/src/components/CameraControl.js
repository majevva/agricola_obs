import obsClient from '../obsClient.js';

export default function CameraControl() {
  setTimeout(() => {
    document.getElementById('btn-camera-1').addEventListener('click', () => {
      obsClient.switchScene("Kamera 1");
    });
    document.getElementById('btn-camera-2').addEventListener('click', () => {
      obsClient.switchScene("Kamera 2");
    });
    document.getElementById('btn-camera-3').addEventListener('click', () => {
      obsClient.switchScene("Kamera 3");
    });
  }, 100);
  
  return `
    <div class="camera-control">
      <button id="btn-camera-1">Kamera 1</button>
      <button id="btn-camera-2">Kamera 2</button>
      <button id="btn-camera-3">Kamera 3</button>
    </div>
  `;
}
