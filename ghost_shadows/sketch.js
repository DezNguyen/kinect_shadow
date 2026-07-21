let socket;
let kinectImage;

// Gespeicherte Bewegungssequenzen
let memoryBank = [];
let maxSequences = 8;
let recordInterval = 2;

// Aktuelle Aufnahme
let currentSequence = [];
let wasPersonPresent = false;

let recordingStarted = false;
let recordingFinished = false;

let recordStartFrame = 0;
let recordLength = 120;

// Laden gespeicherter Geister
let loadingDiskGhost = null;
let diskGhostRequestPending = false;

// Zufällige Wartezeit zwischen zwei Geistern
let minGhostSpawnDelay = 10000;
let maxGhostSpawnDelay = 30000;

// Aktive Geister
let activeGhosts = [];
let maxGhosts = 3;

// Personenerkennung
let humanMassThreshold = 75;
let currentPixelMass = 0;
let shadowIndex = 0;

// Auflösungseffekt des Live-Schattens
let personVisibleFrames = 0;

// Nach wie vielen Frames beginnt die Auflösung?
// Bei ungefähr 30 FPS entsprechen 150 Frames etwa 5 Sekunden.
let dissolveStartFrames = 300;

// Fortschritt von 0 bis 1
let dissolveProgress = 0;

// Geschwindigkeit der Auflösung
let dissolveSpeed = 0.0010;

//Ghost farbpalette
let ghostColors = [
  {r: 255, g: 80, b: 80},
  {r: 80, g: 220, b: 120},
  {r: 110, g: 100, b: 155},
  {r: 255, g: 100, b: 190},
]

//Farbpalette fuer Geister

const ghostColors = [
  { r: 255, g: 80,  b: 80  },  // Rot
  { r: 255, g: 170, b: 40  },  // Orange
  //{ r: 255, g: 230, b: 60  },  // Gelb
  { r: 80,  g: 220, b: 120 },  // Grün
  { r: 60,  g: 190, b: 255 },  // Hellblau
  { r: 110, g: 100, b: 255 },  // Blau-Violett
  { r: 210, g: 80,  b: 255 }   // Magenta
  //{ r: 255, g: 100, b: 190 }   // Pink
];


function setup() {
  createCanvas(windowWidth, windowHeight);

  socket = new WebSocket("ws://localhost:8765");

  socket.onopen = function () {
    console.log("Erfolgreich mit Kinect-Server verbunden!");
    scheduleNextDiskGhost();
  };

  socket.onerror = function (error) {
    console.error("WebSocket-Fehler:", error);
  };

  socket.onclose = function () {
    console.log("Verbindung zum Kinect-Server geschlossen.");
  };

  socket.onmessage = function (event) {
  const message = event.data;

  // JSON-Nachricht vom Python-Server
  if (message.startsWith("{")) {
    try {
      const data = JSON.parse(message);
      handleServerMessage(data);
    } catch (error) {
      console.error(
        "Server-Nachricht konnte nicht gelesen werden:",
        error
      );
    }

    return;
  }

  // Normales Kinect-Live-Bild
  const imgSrc =
    "data:image/jpeg;base64," + message;

  loadImage(
    imgSrc,

    function (img) {
      kinectImage = img;
    },

    function (error) {
      console.error(
        "Kinect-Bild konnte nicht geladen werden:",
        error
      );
    }
  );
};
}

function handleServerMessage(data) {
  if (data.type === "ghost_load_start") {
    loadingDiskGhost = {
      ghostId: data.ghostId,
      expectedFrames: data.frameCount,
      frames: new Array(data.frameCount),
      loadedFrames: 0,
      transferFinished: false
    };

    console.log(
      "Lade Geist von Festplatte:",
      data.ghostId
    );
  }

  else if (data.type === "ghost_load_frame") {
    loadDiskGhostFrame(data);
  }

  else if (data.type === "ghost_load_end") {
    if (
      loadingDiskGhost &&
      loadingDiskGhost.ghostId === data.ghostId
    ) {
      loadingDiskGhost.transferFinished = true;
      tryFinishDiskGhost();
    }
  }

  else if (data.type === "ghost_load_none") {
    console.log(
      "Auf der Festplatte befinden sich noch keine Geister."
    );

    diskGhostRequestPending = false;
    scheduleNextDiskGhost();
  }
}

function loadDiskGhostFrame(data) {
  if (!loadingDiskGhost) {
    return;
  }

  if (loadingDiskGhost.ghostId !== data.ghostId) {
    return;
  }

  const imgSrc =
    "data:image/png;base64," + data.data;

  loadImage(
    imgSrc,

    function (img) {
      // Wichtig: nach frameIndex einsetzen,
      // da loadImage asynchron arbeitet.
      loadingDiskGhost.frames[data.frameIndex] = img;
      loadingDiskGhost.loadedFrames++;

      tryFinishDiskGhost();
    },

    function (error) {
      console.error(
        "Ghost-Frame konnte nicht geladen werden:",
        error
      );
    }
  );
}

function tryFinishDiskGhost() {
  if (!loadingDiskGhost) {
    return;
  }

  const allFramesLoaded =
    loadingDiskGhost.loadedFrames >=
    loadingDiskGhost.expectedFrames;

  if (
    !loadingDiskGhost.transferFinished ||
    !allFramesLoaded
  ) {
    return;
  }

  const finishedSequence =
    loadingDiskGhost.frames.filter(
      frame => frame !== undefined
    );

  if (
    finishedSequence.length >= 5 &&
    activeGhosts.length < maxGhosts
  ) {
    activeGhosts.push(
      new Ghost(finishedSequence)
    );

    console.log(
      "Geist von Festplatte gespawnt:",
      loadingDiskGhost.ghostId
    );
  }

  loadingDiskGhost = null;
  diskGhostRequestPending = false;

  scheduleNextDiskGhost();
}

function scheduleNextDiskGhost() {
  const delay = random(
    minGhostSpawnDelay,
    maxGhostSpawnDelay
  );

  console.log(
    "Nächster Festplatten-Geist in ca.",
    round(delay / 1000),
    "Sekunden"
  );

  setTimeout(
    requestRandomDiskGhost,
    delay
  );
}

function requestRandomDiskGhost() {
  if (
    !socket ||
    socket.readyState !== WebSocket.OPEN
  ) {
    scheduleNextDiskGhost();
    return;
  }

  // Es wird bereits ein Geist geladen
  if (diskGhostRequestPending) {
    scheduleNextDiskGhost();
    return;
  }

  // Maximalzahl an sichtbaren Geistern erreicht
  if (activeGhosts.length >= maxGhosts) {
    scheduleNextDiskGhost();
    return;
  }

  diskGhostRequestPending = true;

  socket.send(
    JSON.stringify({
      type: "request_random_ghost"
    })
  );
}


function draw() {
  background(255);

  if (!kinectImage) {
    fill(0);
    noStroke();
    textSize(30);
    text("Warte auf Kinect-Bild ...", 30, 30);
    return;
  }

  const personPresentNow = hasPerson(kinectImage);

  updateDissolveEffect(personPresentNow);

  //saveFrames('ghost','png', 3, 22);
  updateRecording(personPresentNow);

  wasPersonPresent = personPresentNow;

  // Live-Schatten zeichnen
  if (dissolveProgress <= 0) {
    drawKinectImage(kinectImage);
  } else {
    drawTopDownDissolve(kinectImage, dissolveProgress);
  }

  // Geister zeichnen
  blendMode(MULTIPLY);

  for (let i = activeGhosts.length - 1; i >= 0; i--) {
    const ghost = activeGhosts[i];

    ghost.update();
    ghost.display();

    if (ghost.isDead) {
      activeGhosts.splice(i, 1);
    }
  }

  blendMode(BLEND);
  noTint();

  drawDebugInformation(personPresentNow);
}


function updateRecording(personPresentNow) {
  // Person betritt neu den Aufnahmebereich
  if (!wasPersonPresent && personPresentNow) {
    currentSequence = [];

    recordingStarted = false;
    recordingFinished = false;

    // Zufälliger Aufnahmestart zwischen ungefähr 3 und 10 Sekunden
    recordStartFrame =
      frameCount + floor(random(90, 300));

    console.log(
      "Aufnahme startet bei Frame:",
      recordStartFrame
    );
  }

  // Person ist sichtbar
  if (personPresentNow) {
    // Zufälligen Aufnahmezeitpunkt erreicht
    if (
      !recordingStarted &&
      !recordingFinished &&
      frameCount >= recordStartFrame
    ) {
      recordingStarted = true;
      currentSequence = [];

      console.log("Aufnahme gestartet");
    }

    // Nur aufnehmen, solange die Aufnahme läuft
    if (
      recordingStarted &&
      !recordingFinished &&
      frameCount % recordInterval === 0
    ) {
      currentSequence.push(kinectImage.get());

      // Aufnahme nach gewünschter Länge beenden
      if (currentSequence.length >= recordLength) {
        recordingStarted = false;
        recordingFinished = true;

        console.log(
          "Aufnahme beendet:",
          currentSequence.length,
          "Frames"
        );
      }
    }
  }

  // Person verlässt den Aufnahmebereich
  if (wasPersonPresent && !personPresentNow) {
    // Nur einen Geist erzeugen, wenn wirklich genug aufgenommen wurde
    if (currentSequence.length >= 5) {
      const finishedSequence = [...currentSequence];

      // Auf Festplatte speichern
      saveGhostToDisk(finishedSequence).catch(error => {
        console.error(
          "Geist konnte nicht gespeichert werden:",
          error
        );
      });

      // Zusätzlich weiterhin im RAM speichern
      memoryBank.push(finishedSequence);

      if (memoryBank.length > maxSequences) {
        memoryBank.shift();
      }

      if (activeGhosts.length < maxGhosts) {
        activeGhosts.push(
          new Ghost(finishedSequence)
        );
      }
    } else {
      console.log(
        "Person ging zu früh – keine vollständige Aufnahme"
      );
    }

    // Alles für die nächste Person zurücksetzen
    currentSequence = [];
    recordingStarted = false;
    recordingFinished = false;
    recordStartFrame = 0;
  }
}


function updateDissolveEffect(personPresentNow) {
  if (personPresentNow) {
    personVisibleFrames++;

    if (personVisibleFrames > dissolveStartFrames) {
      dissolveProgress = min(
        dissolveProgress + dissolveSpeed,
        1
      );
    }
  } else {
    // Sobald keine Person mehr sichtbar ist, zurücksetzen
    personVisibleFrames = 0;
    dissolveProgress = 0;
  }
}


function drawTopDownDissolve(img, progress) {
  // Zuerst das unveränderte, glatte Bild zeichnen
  drawKinectImage(img);

  img.loadPixels();

  const step = 2;

  const s = Math.min(
    width / img.width,
    height / img.height
  );

  const drawW = img.width * s;
  const drawH = img.height * s;

  const imageOffsetX = (width - drawW) / 2;
  const imageOffsetY = (height - drawH) / 2;

  // Grenze in den Koordinaten des Kinect-Bildes
  const dissolveLine = progress * img.height;

  // Grenze in Bildschirmkoordinaten
  const dissolveScreenY =
    imageOffsetY + dissolveLine * s;

  // Alles oberhalb der Grenze aus dem normalen Schatten entfernen
  fill(255);
  noStroke();

  rect(
    imageOffsetX,
    imageOffsetY,
    drawW,
    dissolveScreenY - imageOffsetY
  );

  // Partikel nur im bereits aufgelösten Bereich zeichnen
  for (let y = 0; y < dissolveLine; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const index = (x + y * img.width) * 4;

      const brightness =
        (
          img.pixels[index] +
          img.pixels[index + 1] +
          img.pixels[index + 2]
        ) / 3;

      // Nur schwarze Schattenpixel verwenden
      if (brightness >= 50) {
        continue;
      }

      const screenX = imageOffsetX + x * s;
      const screenY = imageOffsetY + y * s;

      const distanceFromLine = dissolveLine - y;

      const localProgress = constrain(
        distanceFromLine / 100,
        0,
        1
      );

      const noiseValue = noise(
        x * 0.04,
        y * 0.04,
        frameCount * 0.015
      );

      const particleOffsetX =
        (noiseValue - 0.5) *
        110 *
        localProgress;

      const particleOffsetY =
        -100 *
        localProgress *
        noiseValue;

      const circleSize = lerp(
        step * s + 2,
        1,
        localProgress
      );

      const alpha = lerp(
        255,
        0,
        localProgress
      );

      fill(0, alpha);

      circle(
        screenX + particleOffsetX,
        screenY + particleOffsetY,
        circleSize
      );
    }
  }
}


class Ghost {
  constructor(sequence) {
    this.frameIndex = 0;

    this.color = random(ghostColors);

    // Frames werden nur einmal eingefärbt.
    // Dadurch bleibt die Wiedergabe flüssiger.
    this.sequence = sequence.map(
      img => this.createColoredFrame(img)
    );

    this.alpha = 0;
    this.targetAlpha = 110;
    this.fadeSpeed = 0.3;

    this.lifeTime = random(300, 1800);
    this.state = "FADE_IN";
    this.isDead = false;

    // Ein gespeicherter Frame bleibt sechs draw()-Frames sichtbar.
    // Für flüssigere Wiedergabe auf 2 oder 3 setzen.
    this.animationSpeed = 3;

    this.age = 0;
  }


  createColoredFrame(img) {
    const colored = img.get();
    colored.loadPixels();

    for (let i = 0; i < colored.pixels.length; i += 4) {
      const brightness =
        (
          colored.pixels[i] +
          colored.pixels[i + 1] +
          colored.pixels[i + 2]
        ) / 3;

      if (brightness < 50) {
        // Schwarzer Schatten wird farbig
        colored.pixels[i] = this.color.r;
        colored.pixels[i + 1] = this.color.g;
        colored.pixels[i + 2] = this.color.b;
        colored.pixels[i + 3] = 255;
      } else {
        // Weißer Hintergrund wird transparent
        colored.pixels[i + 3] = 0;
      }
    }

    colored.updatePixels();

    return colored;
  }


  update() {
    this.age++;

    if (this.state === "FADE_IN") {
      this.alpha += this.fadeSpeed;

      if (this.alpha >= this.targetAlpha) {
        this.alpha = this.targetAlpha;
        this.state = "LIVING";
      }
    } else if (this.state === "LIVING") {
      this.lifeTime--;

      if (this.lifeTime <= 0) {
        this.state = "FADE_OUT";
      }
    } else if (this.state === "FADE_OUT") {
      this.alpha -= this.fadeSpeed;

      if (this.alpha <= 0) {
        this.alpha = 0;
        this.isDead = true;
      }
    }

    if (this.age % this.animationSpeed === 0) {
      this.frameIndex++;

      if (this.frameIndex >= this.sequence.length) {
        this.frameIndex = 0;
      }
    }
  }


  display() {
    const currentImg = this.sequence[this.frameIndex];

    if (!currentImg) {
      return;
    }

    tint(255, this.alpha);
    drawKinectImage(currentImg);
    noTint();
  }
}


function hasPerson(img) {
  img.loadPixels();

  let darkPixelCount = 0;

  // i += 400 bedeutet:
  // Es wird nur ein Teil der Pixel geprüft, damit es schneller läuft.
  for (let i = 0; i < img.pixels.length; i += 400) {
    if (img.pixels[i] < 50) {
      darkPixelCount++;
    }
  }

  currentPixelMass = darkPixelCount;

  return darkPixelCount > humanMassThreshold;
}


function drawDebugInformation(personPresentNow) {
  fill(255, 0, 0);
  noStroke();
  textSize(28);
  textAlign(LEFT, TOP);

  text(
    "Live-Pixel-Masse: " + currentPixelMass,
    30,
    30
  );

  text(
    "Threshold: " + humanMassThreshold,
    30,
    65
  );

  text(
    "Auflösung: " +
    nf(dissolveProgress * 100, 1, 1) +
    "%",
    30,
    100
  );

  if (personPresentNow) {
  fill(0, 170, 0);

  let recordingStatus;

  if (recordingFinished) {
    recordingStatus = "ERINNERUNG GESPEICHERT";
  } else if (recordingStarted) {
    recordingStatus =
      "AUFNAHME: " +
      currentSequence.length +
      " / " +
      recordLength;
  } else {
    const remainingFrames = max(
      recordStartFrame - frameCount,
      0
    );

    recordingStatus =
      "AUFNAHME STARTET IN CA. " +
      ceil(remainingFrames / 30) +
      " S";
  }

  text(
    "STATUS: " + recordingStatus,
    30,
    135
  );

  if (personVisibleFrames > dissolveStartFrames) {
    text(
      "SCHATTEN LÖST SICH AUF",
      30,
      170
    );
  }
} else {
    fill(0, 0, 255);

    text(
      "STATUS: RAUM LEER / GEISTER AKTIV",
      30,
      135
    );
  }
}

function drawKinectImage(img) {
  const s = Math.min(
    width / img.width,
    height / img.height
  );

  const drawW = img.width * s;
  const drawH = img.height * s;

  const x = (width - drawW) / 2;
  const y = (height - drawH) / 2;

  image(img, x, y, drawW, drawH);
}

async function saveGhostToDisk(sequence) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("WebSocket ist nicht verbunden.");
    return;
  }

  const ghostId = "ghost_" + Date.now();

  socket.send(JSON.stringify({
    type: "ghost_start",
    ghostId: ghostId,
    frameCount: sequence.length,
    recordInterval: recordInterval,
    createdAt: new Date().toISOString()
  }));

  for (let i = 0; i < sequence.length; i++) {
    const img = sequence[i];

    // p5.Image in eine PNG-Datei als Base64 umwandeln
    const dataUrl = img.canvas.toDataURL("image/png");

    // "data:image/png;base64," entfernen
    const base64Data = dataUrl.split(",")[1];

    socket.send(JSON.stringify({
      type: "ghost_frame",
      ghostId: ghostId,
      frameIndex: i,
      data: base64Data
    }));

    // Verhindert, dass der WebSocket-Puffer überfüllt wird
    await waitForSocketBuffer();
  }

  socket.send(JSON.stringify({
    type: "ghost_end",
    ghostId: ghostId
  }));

  console.log(
    "Geist an Python gesendet:",
    ghostId,
    sequence.length,
    "Frames"
  );
}

function waitForSocketBuffer() {
  return new Promise(resolve => {
    const checkBuffer = function () {
      // Erst weitersenden, wenn weniger als 1 MB wartet
      if (socket.bufferedAmount < 1_000_000) {
        resolve();
      } else {
        setTimeout(checkBuffer, 20);
      }
    };

    checkBuffer();
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
