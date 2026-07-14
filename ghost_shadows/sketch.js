let socket;
let kinectImage;


let memoryBank = [];
let maxSequences = 8;
let recordInterval = 2;


let currentSequence = [];
let wasPersonPresent = false;


let activeGhosts = [];
let maxGhosts =  3;

let humanMassThreshold = 120;
let currentPixelMass = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  socket = new WebSocket('ws://localhost:8765');

  socket.onopen = function() {
    console.log("Erfolgreich mit Kinect-Server verbunden!");
  };

  socket.onmessage = function(event) {
    let imgSrc = "data:image/jpeg;base64," + event.data;
    loadImage(imgSrc, function(img) {
      kinectImage = img;
    });
  };
}

function draw() {
  background(255);

  if (kinectImage) {
    let personPresentNow = hasPerson(kinectImage);
    if (personPresentNow) {
      if (frameCount % recordInterval === 0) {
        currentSequence.push(kinectImage.get());

        // Speicherschutz: max ~6 Sek.
        if (currentSequence.length > 60) {
          currentSequence.shift();
        }
      }
    }
    if (wasPersonPresent && !personPresentNow) {
      if (currentSequence.length >= 5) {
        memoryBank.push([...currentSequence]);

        if (memoryBank.length > maxSequences) {
          memoryBank.shift();
        }

        if (activeGhosts.length < maxGhosts) {
          let selectedSequence = random(memoryBank);
          activeGhosts.push(new Ghost(selectedSequence));
        }
      }

      currentSequence = [];
    }

    wasPersonPresent = personPresentNow;

    blendMode(MULTIPLY);

    for (let i = activeGhosts.length - 1; i >= 0; i--) {
      let g = activeGhosts[i];
      g.update();
      g.display();
      if (g.isDead) {
        activeGhosts.splice(i, 1);
      }
    }

    tint(255, 255);
    image(kinectImage, 0, 0, width, height);

    blendMode(BLEND);
    noTint();

    fill(255, 0, 0);
    noStroke();
    textSize(32);
    textAlign(LEFT, TOP);
    text("Live-Pixel-Masse: " + currentPixelMass, 30, 30);
    text("Aktueller Threshold: " + humanMassThreshold, 30, 70);

    // Visuelles Feedback
    if (currentPixelMass > humanMassThreshold) {
        fill(0, 255, 0);
        text("STATUS: AUFNAHME LÄUFT...", 30, 110);
    } else {
        fill(0, 0, 255);
        text("STATUS: RAUM LEER / GEISTER AKTIV", 30, 110);
    }
  }
}

class Ghost {
  constructor(sequence) {
    this.frameIndex = 0;
    this.scale = random(0.8, 1.2);
    this.scaleSpeed = random(-0.0015, 0.0015);

    this.color = {
      r: random(80, 255),
      g: random(80, 255),
      b: random(80, 255)
    };

    // Frames einmalig vorbereiten
    this.sequence = sequence
      .map(img => this.createColoredFrame(img))
      .filter(frame => frame !== null);

    this.alpha = 0;
    this.targetAlpha = 110;
    this.fadeSpeed = 0.3;

    this.lifeTime = random(300, 1800);
    this.state = "FADE_IN";
    this.isDead = false;

    this.animationSpeed = 6;
    this.age = 0;
  }

  createColoredFrame(img) {
  const colored = img.get();
  colored.loadPixels();

  let minX = colored.width;
  let minY = colored.height;
  let maxX = 0;
  let maxY = 0;
  let foundShadow = false;

  for (let y = 0; y < colored.height; y++) {
    for (let x = 0; x < colored.width; x++) {
      const i = (x + y * colored.width) * 4;

      const brightness =
        (colored.pixels[i] +
         colored.pixels[i + 1] +
         colored.pixels[i + 2]) / 3;

      if (brightness < 50) {
        foundShadow = true;

        colored.pixels[i] = this.color.r;
        colored.pixels[i + 1] = this.color.g;
        colored.pixels[i + 2] = this.color.b;
        colored.pixels[i + 3] = 255;

        minX = min(minX, x);
        minY = min(minY, y);
        maxX = max(maxX, x);
        maxY = max(maxY, y);
      } else {
        colored.pixels[i + 3] = 0;
      }
    }
  }

  colored.updatePixels();

  if (!foundShadow) {
    return null;
  }

  const padding = 10;

  minX = max(0, minX - padding);
  minY = max(0, minY - padding);
  maxX = min(colored.width - 1, maxX + padding);
  maxY = min(colored.height - 1, maxY + padding);

  return {
    img: colored.get(
      minX,
      minY,
      maxX - minX + 1,
      maxY - minY + 1
    ),
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  };
  }

  update() {
    this.age++;
    this.scale += this.scaleSpeed;

    if(this.scale > 1.4 || this.scale < 0.7){
      this.scaleSpeed *= -1;
    }

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
    const frame = this.sequence[this.frameIndex];

    if (!frame) return;

    const centerX = frame.x + frame.w / 2;
    const centerY = frame.y + frame.h / 2;

    const scaleX = width / kinectImage.width;
    const scaleY = height / kinectImage.height;

    push();

    translate(centerX * scaleX, centerY * scaleY);
    scale(this.scale);

    tint(255, this.alpha);

    image(
        frame.img,
        -(frame.w * scaleX) / 2,
        -(frame.h * scaleY) / 2,
        frame.w * scaleX,
        frame.h * scaleY
    );

    pop();
  }
}


function hasPerson(img) {
  img.loadPixels();
  let darkPixelCount = 0;

  for (let i = 0; i < img.pixels.length; i += 400) {
    if (img.pixels[i] < 50) {
      darkPixelCount++;
    }
  }

  currentPixelMass = darkPixelCount;

  if (darkPixelCount > humanMassThreshold) {
    return true;
  }

  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}