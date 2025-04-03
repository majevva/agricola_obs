# Instrukcje konfiguracji OBS

## 1. Instalacja i konfiguracja obs-websocket
- Zainstaluj OBS WebSocket (wersja 5.x) lub użyj OBS 28+, który ma wbudowaną obs-websocket.
- Ustaw port (np. 4455) i skonfiguruj metodę autoryzacji (challenge/response) w ustawieniach obs-websocket.

## 2. Konfiguracja scen
Przygotuj następujące sceny:

- **Scena Intro:**
  - Dodaj Browser Source wyświetlający stronę z odliczaniem (np. `http://localhost:3000/countdown.html`).
  - Dodaj ścieżkę audio – np. muzykę w tle.

- **Scena Mecz:**
  - Dodaj główne źródło wideo (kamera).
  - Dodaj Text Source (np. o nazwie "ScoreText") lub Browser Source, który wyświetla wynik meczu.

- **Scena Przerwa:**
  - Dodaj Browser Source do wyświetlania scoreboardu.
  - Skonfiguruj dodatkowo slider sponsorów (może to być osobny Browser Source lub wykorzystanie tej samej sceny).
  - Ustaw wyciszenie mikrofonu, jeśli wymagane.

- **Scena Koniec:**
  - Dodaj planszę z podziękowaniami oraz zapowiedzią kolejnego meczu.
  - Możesz dodać dodatkowy Text Source (np. "ThanksText") z odpowiednim tekstem.

## 3. Konfiguracja źródeł OBS
- **Text Source (ScoreText):**
  - Używany do wyświetlania aktualnego wyniku. Aktualizowany przez panel sterowania.
  
- **Image Source:**
  - Używany do wyświetlania logotypu przeciwnika. Plik jest nadpisywany po wgraniu nowego loga.

- **Browser Source:**
  - Źródło odpowiedzialne za dynamiczne elementy (np. odliczanie, scoreboard, slider sponsorów).

## 4. Łączenie z panelem
- Upewnij się, że panel sterowania działa (np. na `http://localhost:3000/`).
- W ustawieniach obs-websocket w OBS skonfiguruj adres `ws://localhost:4455`.
- Przetestuj połączenie – w konsoli panelu powinny pojawiać się logi informujące o nawiązaniu połączenia.

## 5. Testowanie
- Uruchom OBS i przetestuj wszystkie sceny, korzystając z przycisków w panelu.
- Sprawdź, czy wynik aktualizuje się na Text Source, a slider sponsorów działa zgodnie z opisem.
