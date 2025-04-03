const OBS_WS_URL = 'ws://localhost:4455';

class OBSClient {
  constructor() {
    this.socket = null;
    this.connect();
  }
  
  connect() {
    this.socket = new WebSocket(OBS_WS_URL);
    this.socket.onopen = () => console.log('Connected to OBS WebSocket');
    this.socket.onerror = error => console.error('OBS WebSocket error', error);
    this.socket.onclose = () => {
      console.log('OBS WebSocket closed, retrying in 5 seconds...');
      setTimeout(() => this.connect(), 5000);
    };
    this.socket.onmessage = (msg) => {
      console.log('OBS Message:', msg.data);
    };
  }
  
  sendMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }
  
  // Przykładowe polecenie zmiany sceny
  switchScene(sceneName) {
    const message = {
      "op": 6,
      "d": {
        "requestType": "SetCurrentProgramScene",
        "requestData": {
          "sceneName": sceneName
        }
      }
    };
    this.sendMessage(message);
  }
  
  // Przykładowe polecenie aktualizacji Text Source (np. wyniku)
  updateTextSource(sourceName, text) {
    const message = {
      "op": 6,
      "d": {
        "requestType": "SetInputSettings",
        "requestData": {
          "inputName": sourceName,
          "inputSettings": { "text": text }
        }
      }
    };
    this.sendMessage(message);
  }
}

export default new OBSClient();
