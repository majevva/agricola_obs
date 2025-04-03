export default function SponsorSlider() {
    setTimeout(() => {
      startSponsorSlider();
    }, 500);
    
    return `
      <div class="sponsor-slider-container" style="position: relative; overflow: hidden; width: 300px; height: 100px;">
        <div id="team-emblem" style="position: absolute; bottom: 0; left: 0;">
          <img src="/assets/team-emblem.png" alt="Herb drużyny" style="height: 80px;">
        </div>
        <div id="sponsor-bar" style="position: absolute; bottom: 0; left: -300px; width: 300px; height: 80px; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
          <!-- Tutaj pojawią się loga sponsorów -->
        </div>
      </div>
    `;
  }
  
  function startSponsorSlider() {
    const sponsorBar = document.getElementById('sponsor-bar');
    const sponsors = [
      '/assets/sponsors/sponsor1.png',
      '/assets/sponsors/sponsor2.png',
      '/assets/sponsors/sponsor3.png',
      '/assets/sponsors/sponsor4.png',
      '/assets/sponsors/sponsor5.png'
    ];
    
    // Wstawiamy obrazy sponsorów do belki
    sponsorBar.innerHTML = sponsors.map(src => `<img src="${src}" alt="Sponsor" style="margin: 0 5px; height: 60px;">`).join('');
    
    // Animacja belki sponsorów – przesunięcie z lewej strony
    sponsorBar.style.transition = 'left 1s ease-out';
    sponsorBar.style.left = '0px';
    
    // Po 5 sekundach animujemy herb – zsuwa się w dół ekranu
    setTimeout(() => {
      const teamEmblem = document.getElementById('team-emblem');
      teamEmblem.style.transition = 'bottom 1s ease-in';
      teamEmblem.style.bottom = '-100px';
    }, 5000);
  }
  