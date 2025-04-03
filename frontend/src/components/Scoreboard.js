import obsClient from '../obsClient.js';

let score = { gospodarze: 0, goscie: 0 };

function updateScoreDisplay() {
  const scoreDisplay = document.getElementById('score-display');
  if(scoreDisplay) {
    scoreDisplay.textContent = `Aktualny wynik: ${score.gospodarze} : ${score.goscie}`;
  }
  // Wysyłamy aktualizację wyniku do OBS (przykładowo do Text Source o nazwie "ScoreText")
  obsClient.updateTextSource("ScoreText", `${score.gospodarze} : ${score.goscie}`);
}

export default function Scoreboard() {
  setTimeout(() => {
    document.getElementById('btn-gol-gospodarze').addEventListener('click', () => {
      score.gospodarze++;
      updateScoreDisplay();
    });
    document.getElementById('btn-gol-goscie').addEventListener('click', () => {
      score.goscie++;
      updateScoreDisplay();
    });
  }, 100);
  
  return `
    <div class="scoreboard">
      <div>Drużyna gospodarzy: <span id="team-home">Agricola</span></div>
      <div>Drużyna gości: <span id="team-away">FC X</span></div>
      <div id="score-display">Aktualny wynik: ${score.gospodarze} : ${score.goscie}</div>
      <button id="btn-gol-gospodarze">Gol gospodarze</button>
      <button id="btn-gol-goscie">Gol goście</button>
    </div>
  `;
}
