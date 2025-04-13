# Sports Broadcast Manager

## Opis projektu

Sports Broadcast Manager to zaawansowana aplikacja webowa zaprojektowana do zarządzania transmisjami sportowymi w czasie rzeczywistym. Projekt umożliwia wyświetlanie wyniku meczu (scoreboard), powiadomień w formie belek informacyjnych (lower third), zarządzanie czasem meczu oraz integrację z OBS Studio za pomocą OBS WebSocket do automatycznego sterowania scenami i widocznością źródeł. Aplikacja została stworzona z myślą o prostocie użycia i pełnej kontroli nad elementami wizualnymi podczas transmisji, szczególnie w środowisku streamingowym.

### Główne funkcjonalności:
- **Scoreboard**: Wyświetlanie wyniku meczu, nazw drużyn i czasu gry na stronie `scoreboard.html`, z możliwością personalizacji kolorów i stylów.
- **Lower Third (Powiadomienia)**: Generowanie belek informacyjnych na stronie `lowerthird.html` z powiadomieniami o zmianach zawodników, żółtych i czerwonych kartkach, kontuzjach oraz golach. Belki pojawiają się dynamicznie po kliknięciu "Wyślij na ekran" i znikają po 10 sekundach.
- **Zarządzanie czasem meczu**: Panel sterowania pozwala na start, pauzę, reset czasu meczu oraz ustawianie konkretnych wartości (np. 45:00).
- **Integracja z OBS WebSocket**: Automatyczne sterowanie widocznością źródeł w OBS (np. pokazywanie/ukrywanie wyniku lub belek) oraz przełączanie scen podczas transmisji.
- **Dynamiczne odświeżanie**: Strona `lowerthird.html` odświeża się co sekundę, aby powiadomienia były widoczne w OBS bez konieczności ręcznego odświeżania, z kontrolą, aby każde powiadomienie wyświetlało się tylko raz.
- **Personalizacja**: Możliwość zmiany nazw drużyn, kolorów, stylów belek i wyniku, a także dostosowania listy zawodników.
- **Panel sterowania**: Intuicyjny interfejs w `index.html` do zarządzania wszystkimi aspektami transmisji.

Projekt został zaprojektowany tak, aby działać płynnie w środowisku OBS Studio, zapewniając pełną kontrolę nad transmisją sportową w czasie rzeczywistym.

## Struktura projektu
sports-broadcast-manager/
│
├── public/
│   ├── index.html        # Główna strona panelu sterowania
│   ├── lowerthird.html   # Strona wyświetlająca belkę powiadomień (do użycia w OBS)
│   ├── scoreboard.html   # Strona wyświetlająca wynik meczu (scorebug, do użycia w OBS)
│   ├── scoreboard.css    # Style CSS dla wyniku, belek i panelu
│   ├── styles.css        # Dodatkowe style dla panelu sterowania
│   ├── script.js         # Logika JavaScript dla panelu sterowania
│   ├── home_players.json # Przykładowa lista zawodników gospodarzy
│   ├── away_players.json # Przykładowa lista zawodników gości
│
├── server.js             # Serwer Node.js obsługujący API i komunikację z OBS WebSocket
├── config.json           # Konfiguracja (port, ścieżki do plików z zawodnikami)
├── package.json          # Zależności projektu
└── README.md             # Dokumentacja projektu

 

Collapse

Wrap

Copy

## Wymagania

- **Node.js** (v14 lub nowszy)
- Przeglądarka internetowa (np. Chrome, Firefox)
- OBS Studio (z włączonym OBS WebSocket – domyślnie od wersji 28, lub jako wtyczka w starszych wersjach)
- Zainstalowany moduł `obs-websocket-js` (dodany w `package.json`)

## Instalacja

1. Sklonuj repozytorium na swój komputer:
git clone https://github.com/<twoj-username>/sports-broadcast-manager.git
cd sports-broadcast-manager

 

Collapse

Wrap

Copy

2. Zainstaluj zależności:
npm install

 

Collapse

Wrap

Copy

3. Uruchom serwer:
node server.js

 

Collapse

Wrap

Copy

4. Otwórz przeglądarkę i przejdź do:
- Panel sterowania: `http://localhost:3000/index.html`
- Strona z belką (dla OBS): `http://localhost:3000/lowerthird.html`
- Strona z wynikiem (scorebug): `http://localhost:3000/scoreboard.html`

## Konfiguracja OBS WebSocket

1. W OBS Studio upewnij się, że WebSocket jest włączony:
- Przejdź do `Narzędzia` -> `Ustawienia WebSocket`.
- Włącz serwer WebSocket (domyślny port to 4455).
- Skopiuj hasło (jeśli jest ustawione) i zapisz je – będzie potrzebne w konfiguracji serwera.

2. Zaktualizuj konfigurację w `server.js` (jeśli potrzebne):
- Domyślnie serwer łączy się z OBS WebSocket na `localhost:4455`. Jeśli Twój OBS działa na innym porcie lub wymaga hasła, zmodyfikuj kod w `server.js`:
const obs = new OBSWebSocket();
obs.connect('ws://localhost:4455', 'twoje_haslo');

 

Collapse

Wrap

Copy

## Użycie

1. **Konfiguracja w OBS**:
- Otwórz OBS Studio.
- Dodaj źródło typu "Przeglądarka" (Browser Source) dla wyniku meczu:
- W ustawieniach źródła wpisz URL: `http://localhost:3000/scoreboard.html`.
- Ustaw szerokość i wysokość źródła (np. 1280x720).
- Dodaj kolejne źródło typu "Przeglądarka" dla belki powiadomień:
- W ustawieniach źródła wpisz URL: `http://localhost:3000/lowerthird.html`.
- Ustaw szerokość i wysokość źródła (np. 1280x720).
- Upewnij się, że opcja "Odśwież przeglądarkę, gdy scena staje się aktywna" jest włączona dla obu źródeł.

2. **Używanie panelu sterowania**:
- Otwórz `http://localhost:3000/index.html` w przeglądarce.
- **Zakładka "Scorebug"**:
- Ustaw nazwy drużyn, kolory i wynik meczu.
- Zarządzaj czasem meczu (start, pauza, reset, ustawienie 45:00 lub 00:00).
- Wynik i czas są automatycznie aktualizowane na stronie `scoreboard.html` w OBS.
- **Zakładka "Powiadomienia"**:
- Wybierz typ powiadomienia (np. "Zmiana", "Żółta Kartka", "Czerwona Kartka", "Kontuzja", "Gol").
- Wybierz zawodnika (lub dwóch w przypadku zmiany) z listy gospodarzy lub gości.
- Kliknij "Wyślij na ekran", aby wyświetlić powiadomienie w OBS.
- Belka pojawi się w OBS, wyświetli się przez 10 sekund, a następnie zniknie.
- Kolejne powiadomienie pojawi się po ponownym kliknięciu "Wyślij na ekran".
- **Integracja z OBS WebSocket**:
- Aplikacja automatycznie steruje widocznością źródeł w OBS (np. pokazuje/ukrywa wynik lub belkę).
- Możesz przełączać sceny w OBS bezpośrednio z panelu sterowania (funkcjonalność zależna od konfiguracji OBS WebSocket).

## Konfiguracja

### Plik `config.json`
Plik `config.json` zawiera podstawowe ustawienia serwera:
{
"port": 3000,
"teams": {
"home": "home_players.json",
"away": "away_players.json"
}
}

 

Collapse

Wrap

Copy
- `port`: Port, na którym działa serwer (domyślnie 3000).
- `teams.home` i `teams.away`: Ścieżki do plików JSON z listą zawodników.

### Pliki z zawodnikami
Pliki `home_players.json` i `away_players.json` w folderze `public` zawierają listy zawodników w formacie:
[
{ "number": 1, "name": "Kowalski" },
{ "number": 2, "name": "Nowak" }
]

 

Collapse

Wrap

Copy
Możesz edytować te pliki, aby dostosować listę zawodników do swoich potrzeb.

## Personalizacja

- **Kolory i style**:
  - Edytuj `public/scoreboard.css`, aby zmienić kolory wyniku i belek.
  - Edytuj `public/styles.css`, aby dostosować wygląd panelu sterowania.
- **Nazwy drużyn i kolory**:
  - W panelu sterowania (zakładka "Scorebug") możesz zmienić nazwy drużyn i ich kolory.
- **Czas wyświetlania belki**:
  - W pliku `public/lowerthird.html` zmień wartość w `setTimeout` (obecnie 10000ms, czyli 10 sekund), aby dostosować czas wyświetlania powiadomienia.
- **Integracja z OBS**:
  - Możesz rozszerzyć funkcjonalność OBS WebSocket w `server.js`, np. dodając nowe akcje (przełączanie scen, sterowanie mediami).

## Rozwiązane problemy

- Dynamiczne odświeżanie w OBS: Strona `lowerthird.html` odświeża się co sekundę, aby powiadomienia były widoczne bez ręcznego odświeżania.
- Jednorazowe wyświetlanie powiadomień: Użyto mechanizmu `timestamp` i `localStorage`, aby każde powiadomienie wyświetlało się dokładnie raz.
- Efekt wizualny wybrania zawodnika: Dodano stylizację (pogrubienie, zmiana tła, fioletowa ramka) dla wybranych zawodników w panelu.
- Wyrównanie elementów w belce: Nazwiska zawodników są wyświetlane jedno pod drugim z wyrównanymi strzałkami, a kwadracik (np. żółty dla kartki) jest odpowiednio pozycjonowany.

## Autorzy

Projekt został stworzony we współpracy z użytkownikiem GitHub <twoj-username>. Jeśli chcesz przyczynić się do rozwoju projektu, zapraszamy do zgłaszania issues i pull requestów!

## Licencja

MIT License – szczegóły w pliku `LICENSE`.