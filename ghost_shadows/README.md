# Performativer Raum / Interaktive Schattenprojektion

## 1. Architektur

Die Anwendung nutzt eine geteilte Architektur, die in Echtzeit über WebSockets (Port 8765) kommuniziert.

* **Python-Backend (Sensorik):** Erfasst Tiefendaten via Azure Kinect (`pykinect_azure`), blendet den Hintergrund aus (`MIN/MAX_DEPTH`) und korrigiert die Linsenverzerrung der Kamera (`remove_fisheye`). Die isolierte Silhouette wird als Base64-String (JPEG) mit 30 FPS gesendet.
* **p5.js-Frontend:** Empfängt den Stream, verwaltet die Personenerkennung und speichert Bewegungssequenzen in einer `memoryBank`. Übernimmt das ressourcenschonende Rendering der eingefärbten Geister und berechnet den auf Perlin-Noise basierenden Auflösungseffekt.

## 2. Installation

**Voraussetzungen:** 
* Hardware: Azure Kinect DK, Windows-PC, Beamer.
* Software: Python 3.x, moderner Webbrowser, lokaler Webserver.

**Python-Abhängigkeiten installieren:**
*(Das offizielle Azure Kinect Sensor SDK muss auf dem System installiert sein)*
```bash
pip install opencv-python numpy websockets asyncio pykinect_azure
```

## 3. Ausführung

**Schritt 1: Kinect-Server starten**
1. Azure Kinect anschließen.
2. Im Projektordner das Terminal öffnen und den Server starten:
   ```bash
   python server.py
   ```
3. Auf die Bestätigung warten: `WebSocket laeuft auf ws://localhost:8765`.

**Schritt 2: Frontend starten**
1. Einen lokalen Webserver im Projektverzeichnis starten (z. B. via Terminal):
   ```bash
   python -m http.server 8000
   ```
2. Im Browser `http://localhost:8000` öffnen. 
3. Die Verbindung wird automatisch hergestellt und die Projektion startet, sobald eine Person erkannt wird.
