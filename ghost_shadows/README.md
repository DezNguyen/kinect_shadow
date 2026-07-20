# Performativer Raum
# Interaktion mit dem virtuellen Selbst

## Architektur der Anwendung

Das System nutzt eine Client-Server-Architektur, um die Hardware-Datenverarbeitung von der visuellen Ausgabe zu trennen. 

**Backend** Das Python-Skript (`server.py`) dient als Server. Es kommuniziert mit einer Kinect-Kamera und extrahiert Tiefendaten aus dem Raum.
**Netzwerk-Kommunikation:** Die Übermittlung der hochfrequenten Tracking-Daten vom Server an den Client erfolgt bidirektional und in Echtzeit über eine WebSocket-Verbindung.
**Frontend (Visuelle Aufbereitung):** Die visuelle Darstellung der "Ghost Shadows" wird im Webbrowser gerendert. Hierbei kommt HTML5-Canvas in Kombination mit der JavaScript-Bibliothek p5.js zum Einsatz (`sketch.js`, `kinectron-client.js`). 

## Installation

Um das Projekt lokal einzurichten, müssen folgende Systemvoraussetzungen und Abhängigkeiten erfüllt sein:

1.  **Hardware-Setup:** 
    *   Eine funktionstüchtige Kinect-Kamera muss angeschlossen sein. 
    *   *Hinweis zu Hardware-Limitierungen:* Für eine fehlerfreie Erfassung muss auf ausreichende räumliche Distanz zur Kamera sowie angemessene Lichtverhältnisse geachtet werden.
2.  **Software-Abhängigkeiten:**
    *   **Python:** Version 3.x muss installiert sein.
    *   **Bibliotheken:** Die für das Skript `server.py` notwendigen Python-Module (insbesondere für WebSockets) müssen installiert werden (z. B. via `pip install ...`).
    *   **Client:** Ein moderner Webbrowser (empfohlen: Google Chrome) für die Darstellung der `index.html`.

## Ausführung

Die Komponenten müssen zwingend in der folgenden Reihenfolge gestartet werden, um Fehler bei der Verbindungsherstellung zu vermeiden:

1.  **Server initialisieren:**
    Starten Sie das Python-Backend über das Terminal, um den WebSocket-Server zu öffnen und die Kinect-Kamera zu aktivieren:
    ```bash
    python server.py
    ```

2.  **Client starten:**
    Sobald das Backend läuft und auf eingehende Verbindungen wartet, öffnen Sie die Datei `index.html` (aus dem Ordner `ghost_shadows`) in einem Webbrowser.

3.  **Verbindungsaufbau:**
    Die p5.js-Applikation baut beim Start automatisch die WebSocket-Verbindung zum lokalen Server auf. Die Projektion der Schatten startet unmittelbar, sobald die Kamera Bewegungen im Raum registriert.

---

## Projektteam
*   [Dein Vor- und Nachname]
*   [Name Teammitglied 2]
*   [Name Teammitglied 3]
*   [Name Teammitglied 4]
*   [Name Teammitglied 5]
