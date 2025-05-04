import json

# 1. Wczytanie danych
with open('away_players.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 2. Przetworzenie każdego gracza
for player in data:
    num = player.get('number')
    
    # jeśli number jest stringiem złożonym z 3 cyfr
    if isinstance(num, str) and num.isdigit() and len(num) == 3:
        player['number'] = ""
    
    # jeśli number jest liczbą int (np. 123), też sprawdzamy zakres 100–999
    elif isinstance(num, int) and 100 <= num <= 999:
        player['number'] = ""

# 3. Zapisanie zmodyfikowanych danych (nadpisanie oryginału)
with open('away_players.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Gotowe! Wszystkie trzycyfrowe 'number' zostały zamienione na pusty string.")
