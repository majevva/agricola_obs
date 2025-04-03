import obsClient from '../obsClient.js';

export default function SceneButtons() {
  // Po renderowaniu dodajemy event listenery do przycisków
  setTimeout(() => {
    document.getElementById('btn-intro').addEventListener('click', () => {
      obsClient.switchScene("Intro");
    });
    document.getElementById('btn-match').addEventListener('click', () => {
      obsClient.switchScene("Mecz");
    });
    document.getElementById('btn-break').addEventListener('click', () => {
      obsClient.switchScene("Przerwa");
    });
    document.getElementById('btn-end').addEventListener('click', () => {
      obsClient.switchScene("Koniec");
    });
  }, 100);
  
  return `
    <div class="scene-buttons">
      <button id="btn-intro">Scena Intro</button>
      <button id="btn-match">Scena Mecz</button>
      <button id="btn-break">Przerwa</button>
      <button id="btn-end">Koniec</button>
    </div>
  `;
}
