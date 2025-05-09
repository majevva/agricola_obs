# OBS Panel Sterowania Transmisją

## Wymagania

* **OBS Studio 28+** z wbudowaną wtyczką **obs-websocket 5.x** (lub dowolna wersja OBS z ręcznie zainstalowaną wtyczką obs-websocket 5.x)
* **Node.js** v14+ (do backendu)
* **npm** lub **yarn**
* Przeglądarka wspierająca ES Modules (np. Chrome, Firefox, Edge)

## Quick Install

1. **Klonowanie repozytorium**

   ```bash
   git clone https://github.com/username/projekt-obs-panel.git
   cd projekt-obs-panel
   ```

2. **Instalacja front-endu**

   ```bash
   cd frontend
   npm install
   # lub yarn install
   ```

3. **Instalacja backendu (opcjonalnie)**

   ```bash
   cd ../backend
   npm install
   # lub yarn install
   ```

4. **Konfiguracja**

   * Skopiuj plik `obs-config/config.example.json` do `frontend/public/config.json` i dostosuj ustawienia (czasy, nazwy drużyn, ścieżki do logotypów i sponsorów).
   * Upewnij się, że **obs-websocket** działa na porcie **4455** (lub zmień w `config.json`).

5. **Uruchomienie**

   * **Backend** (jeśli używasz):

     ```bash
     cd backend
     npm start
     ```
   * **Frontend**:

     ```bash
     cd frontend
     npm run dev
     ```
   * Otwórz w przeglądarce: `http://localhost:3000`

6. **Połączenie z OBS**

   * W OBS Studio wejdź w **Tools → WebSocket Server Settings**, ustaw port `4455` i włącz uwierzytelnianie (challenge/response).
   * Uruchom OBS przed panelem lub upewnij się, że jest online, aby panel mógł się połączyć.

---

## Struktura projektu

```bash
/projekt-obs-panel
├── /frontend
│   ├── /public
│   │   ├── index.html
│   │   ├── config.json         # Ustawienia domyślne transmisji
│   │   └── assets/             # Zasoby statyczne (obrazy, style)
│   ├── /src
│   │   ├── /components         # Komponenty UI (przyciski, scoreboard, slider sponsorów, sterowanie kamerami)
│   │   ├── App.js              # Główny moduł aplikacji
│   │   ├── main.js             # Punkt wejścia i załadowanie config.json
│   │   └── obsClient.js        # Klient WebSocket do komunikacji z OBS
│   └── package.json            # Zależności i skrypty front-endowe
│
├── /backend                    # (opcjonalnie) Serwer Node.js
│   ├── server.js               # Endpointy do zapisu scoreboard, uploadu logotypu
│   └── package.json            # Zależności backendowe
│
├── /obs-config
│   ├── config.example.json     # Szablon pliku konfiguracyjnego
│   └── instrukcje.md           # Instrukcje konfiguracji scen i źródeł w OBS
│
└── README.md                   # Dokumentacja (ten plik)
```

---

## Funkcjonalności

* **Sterowanie scenami**: Intro, Mecz, Przerwa, Koniec
* **Aktualizacja wyniku**: przyciski „Gol gospodarze” / „Gol goście”
* **Upload logotypu**: wymiana obrazu drużyny przeciwnej
* **Sterowanie kamerami**: przełączanie lub włączanie/wyłączanie źródeł wideo
* **Slider sponsorów**:

  * Herb drużyny pojawia się w dolnym lewym rogu
  * Obok herbu wysuwa się belka z pięcioma sponsorami
  * Po zakończeniu sekwencji herb animacyjnie znika w dół
* **Dostosowywalne czasy**: start meczu, druga połowa, przerwa – konfigurowalne w `config.json`

---

## Konfiguracja (`config.json`)

```json
{
  "matchSettings": {
    "startTime": "00:00",
    "secondHalfStart": "45:00",
    "breakDuration": "10:00"
  },
  "teams": {
    "homeTeam": "Agricola",
    "awayTeam": "FC X",
    "opponentName": "Przeciwnik"
  },
  "sponsorSlider": {
    "duration": 5000,
    "sponsors": [
      "/assets/sponsors/sponsor1.png",
      "/assets/sponsors/sponsor2.png",
      "/assets/sponsors/sponsor3.png",
      "/assets/sponsors/sponsor4.png",
      "/assets/sponsors/sponsor5.png"
    ]
  },
  "emblem": {
    "path": "/assets/team-emblem.png"
  },
  "obs": {
    "websocketUrl": "ws://localhost:4455"
  }
}
```

Zmienne w `config.json` odczytywane są przez `frontend/src/main.js` i przekazywane do wszystkich komponentów.

---

## OBS: Konfiguracja scen i źródeł

1. **Sceny**:

   * **Intro**: Browser Source (odliczanie), audio (muzyka)
   * **Mecz**: główne źródło wideo, Text Source `ScoreText` lub Browser Source
   * **Przerwa**: Browser Source z scoreboardem, slider sponsorów, wyciszenie mikrofonu
   * **Koniec**: Image Source (plansza końcowa), Text Source `ThanksText`

2. **Źródła**:

   * **Text Source** `ScoreText` – wyświetla wynik, aktualizowany przez panel
   * **Image Source** `TeamEmblem` – herb drużyny, podmienia się po uploadzie
   * **Browser Source** – dynamiczne elementy (scoreboard, slider sponsorów)

3. **Połączenie**:

   * `ws://localhost:4455` (port i metoda uwierzytelniania zgodne z ustawieniami obs-websocket)

---

## Rozszerzenia

* Dodanie powtórek, statystyk meczowych, alertów kartkowych
* Integracja z mediami społecznościowymi (Twitter, Facebook)
* Moduł statystyk z wykresami (wykorzystanie Browser Source i Chart.js)

---

## Licencja

Projekt dostępny na licencji MIT. Szczegóły w pliku LICENSE.
