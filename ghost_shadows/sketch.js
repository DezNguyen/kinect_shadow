let socket;
let kinectImage;

// Gespeicherte Bewegungssequenzen
let memoryBank = [];
let maxSequences = 8;
let recordInterval = 2;

// Aktuelle Aufnahme
let currentSequence = [];
let wasPersonPresent = false;

// Aktive Geister
let activeGhosts = [];
let maxGhosts = 3;

// Personenerkennung
let humanMassThreshold = 75;
let currentPixelMass = 0;

// Auflösungseffekt des Live-Schattens
let personVisibleFrames = 0;

// Nach wie vielen Frames beginnt die Auflösung?
// Bei ungefähr 30 FPS entsprechen 150 Frames etwa 5 Sekunden.
let dissolveStartFrames = 300;

// Fortschritt von 0 bis 1
let dissolveProgress = 0;

// Geschwindigkeit der Auflösung
let dissolveSpeed = 0.0025;


function setup() {
  createCanvas(windowWidth, windowHeight);

  socket = new WebSocket("ws://localhost:8765");

  socket.onopen = function () {
    console.log("Erfolgreich mit Kinect-Server verbunden!");
  };

  socket.onerror = function (error) {
    console.error("WebSocket-Fehler:", error);
  };

  socket.onclose = function () {
    console.log("Verbindung zum Kinect-Server geschlossen.");
  };

  socket.onmessage = function (event) {
    const imgSrc = "data:image/jpeg;base64," + event.data;

    loadImage(imgSrc, function (img) {
      kinectImage = img;
    });
  };
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
  updateRecording(personPresentNow);

  wasPersonPresent = personPresentNow;

  // Live-Schatten zeichnen
  if (dissolveProgress <= 0) {
    image(kinectImage, 0, 0, width, height);
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
  // Solange eine Person sichtbar ist, Frames aufnehmen
  if (personPresentNow) {
    if (frameCount % recordInterval === 0) {
      currentSequence.push(kinectImage.get());

      // Begrenzung des Arbeitsspeichers
      if (currentSequence.length > 60) {
        currentSequence.shift();
      }
    }
  }

  // Person war vorher da, ist jetzt aber verschwunden
  if (wasPersonPresent && !personPresentNow) {
    if (currentSequence.length >= 5) {
      memoryBank.push([...currentSequence]);

      if (memoryBank.length > maxSequences) {
        memoryBank.shift();
      }

      if (activeGhosts.length < maxGhosts) {
        const selectedSequence = random(memoryBank);
        activeGhosts.push(new Ghost(selectedSequence));
      }
    }

    currentSequence = [];
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
  img.loadPixels();

  // Kleinere Zahl = mehr Kreise und detaillierter,
  // aber auch rechenintensiver
  const step = 6;

  const scaleX = width / img.width;
  const scaleY = height / img.height;

  // Diese Linie wandert von oben nach unten
  const dissolveLine = progress * img.height;

  // Breite des Übergangsbereichs hinter der Linie
  const transitionHeight = 100;

  noStroke();

  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const index = (x + y * img.width) * 4;

      const brightness =
        (
          img.pixels[index] +
          img.pixels[index + 1] +
          img.pixels[index + 2]
        ) / 3;

      // Nur dunkle Pixel gehören zum Schatten
      if (brightness >= 50) {
        continue;
      }

      const screenX = x * scaleX;
      const screenY = y * scaleY;

      // Dieser Teil liegt noch unterhalb der Auflösungsgrenze
      if (y > dissolveLine) {
        fill(0, 255);

        rect(
          screenX,
          screenY,
          step * scaleX + 1,
          step * scaleY + 1
        );

        continue;
      }

      // Abstand des Pixels zur wandernden Grenze
      const distanceFromLine = dissolveLine - y;

      // 0 direkt an der Grenze, 1 weit dahinter
      const localProgress = constrain(
        distanceFromLine / transitionHeight,
        0,
        1
      );

      const noiseValue = noise(
        x * 0.04,
        y * 0.04,
        frameCount * 0.015
      );

      // Seitliches Wegdriften
      const offsetX =
        (noiseValue - 0.5) *
        110 *
        localProgress;

      // Kreise schweben nach oben
      const offsetY =
        -100 *
        localProgress *
        noiseValue;

      // Direkt an der Grenze noch relativ groß,
      // weiter oben immer kleiner
      const originalSize =
        min(step * scaleX, step * scaleY) + 2;

      const circleSize = lerp(
        originalSize,
        1,
        localProgress
      );

      // Weiter entfernte Partikel werden transparenter
      const alpha = lerp(
        255,
        0,
        localProgress
      );

      fill(0, alpha);

      circle(
        screenX + offsetX,
        screenY + offsetY,
        circleSize
      );
    }
  }
}


class Ghost {
  constructor(sequence) {
    this.frameIndex = 0;

    this.color = {
      r: random(80, 255),
      g: random(80, 255),
      b: random(80, 255)
    };

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

        // Nach einem Durchlauf optional eine andere Sequenz verwenden
        if (memoryBank.length > 0) {
          const selectedSequence = random(memoryBank);

          this.sequence = selectedSequence.map(
            img => this.createColoredFrame(img)
          );
        }
      }
    }
  }


  display() {
    const currentImg = this.sequence[this.frameIndex];

    if (!currentImg) {
      return;
    }

    tint(255, this.alpha);
    image(currentImg, 0, 0, width, height);
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

    if (personVisibleFrames <= dissolveStartFrames) {
      const remainingFrames =
        dissolveStartFrames - personVisibleFrames;

      text(
        "STATUS: AUFNAHME – Auflösung startet in ca. " +
        ceil(remainingFrames / 30) +
        " s",
        30,
        135
      );
    } else {
      text(
        "STATUS: SCHATTEN LÖST SICH AUF",
        30,
        135
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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
