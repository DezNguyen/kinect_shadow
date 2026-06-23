let socket;
let kinectImage;

let memoryBank = [];       
let maxMemory = 500;       
let recordInterval = 30;   

let activeGhosts = [];     
let maxGhosts = 10;       
let spawnChance = 0.3;     

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

  let s = Math.min(width / kinectImage.width, height / kinectImage.height);
  let drawW = kinectImage.width * s;
  let drawH = kinectImage.height * s;

  let x = (width - drawW) / 2;
  let y = (height - drawH) / 2;



  if (kinectImage) {
    // Nur speichern, wenn jemand im Bild ist
    if (frameCount % recordInterval === 0) {
      if (hasPerson(kinectImage)) {
        memoryBank.push(kinectImage.get());
        if (memoryBank.length > maxMemory) {
          memoryBank.shift(); 
        }
      }
    }

    if (activeGhosts.length < maxGhosts && memoryBank.length > 0) {
      if (random(1) < spawnChance) {
        let randomPastImage = random(memoryBank);
        activeGhosts.push(new Ghost(randomPastImage));
      }
    }

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
    //image(kinectImage, 0, 0, width, height);
    image(kinectImage, x, y, drawW, drawH);
    blendMode(BLEND); 
    noTint();
  }
}

class Ghost {
  constructor(img) {
    this.img = img;
    this.alpha = 0;                     
    this.targetAlpha = random(60, 180); 
    this.fadeSpeed = random(0.5, 2);    
    this.lifeTime = random(300, 900);    
    this.state = "FADE_IN";
    this.isDead = false;
  }

  update() {
    if (this.state === "FADE_IN") {
      this.alpha += this.fadeSpeed;
      if (this.alpha >= this.targetAlpha) {
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
        this.isDead = true; 
      }
    }
  }

  display() {
    tint(255, this.alpha);
    image(this.img, 0, 0, width, height);
  }
}


function hasPerson(img) {
  img.loadPixels();
  for (let i = 0; i < img.pixels.length; i += 400) {
    if (img.pixels[i] < 50) {
      return true; 
    }
  }
  return false; 
}

function keyPressed(){
  if (key === 'b' || key === 'B'){
    socket.send("save_background");
    console.log("Background saved");
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}