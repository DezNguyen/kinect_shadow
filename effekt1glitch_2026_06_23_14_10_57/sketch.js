let socket;
let kinectImage;

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

  background(0); 
}

function draw() {

  blendMode(BLEND); 
  fill(0, 0, 0, 40); 
  rect(0, 0, width, height);

  if (kinectImage) {
    blendMode(SCREEN); 
    let offset = random(3, 15); 

    tint(255, 50, 50); 
    image(kinectImage, -offset, 0, width, height);

    tint(50, 255, 255); 
    image(kinectImage, offset, 0, width, height);

    noTint();
  }
}

function keyPressed(){
  if (key === 'b' || key === 'B'){
    socket.send("save_background");
    console.log("Background saved");
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0); 
}
