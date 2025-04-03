import SceneButtons from './components/SceneButtons.js';
import Scoreboard from './components/Scoreboard.js';
import SponsorSlider from './components/SponsorSlider.js';
import CameraControl from './components/CameraControl.js';

export default function App() {
  return `
    <div class="panel">
      <h1>Panel Sterowania Transmisją</h1>
      <div id="scene-buttons">${SceneButtons()}</div>
      <div id="scoreboard">${Scoreboard()}</div>
      <div id="camera-control">${CameraControl()}</div>
      <div id="sponsor-slider">${SponsorSlider()}</div>
    </div>
  `;
}
