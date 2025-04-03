const express = require('express');
const app = express();
const port = 3001;
const fs = require('fs');
const path = require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint do aktualizacji pliku ze scoreboardem
app.post('/update-scoreboard', (req, res) => {
  const { gospodarze, goscie } = req.body;
  const scoreboard = { gospodarze, goscie };
  fs.writeFileSync(path.join(__dirname, 'scoreboard.json'), JSON.stringify(scoreboard, null, 2));
  res.json({ status: 'ok', scoreboard });
});

// Endpoint do obsługi uploadu logotypu (prosta implementacja)
app.post('/upload-logo', (req, res) => {
  // W pełnej wersji warto użyć biblioteki 'multer'
  res.json({ status: 'not implemented' });
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
