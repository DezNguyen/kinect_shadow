
let socket;
let kinectImage;
let loading = false;

function setup() {
  createCanvas(windowWidth, windowHeight);

  socket = new WebSocket("ws://localhost:8765");

  socket.onmessage = function (event) {
    if (loading) return;

    loading = true;

    loadImage("data:image/jpeg;base64," + event.data, function (img) {
      kinectImage = img;
      loading = false;
    });
  };

}

function draw() {
  background(255);

  if (!kinectImage) return;

  let s = Math.min(width / kinectImage.width, height / kinectImage.height);
  let drawW = kinectImage.width * s;
  let drawH = kinectImage.height * s;

  let x = (width - drawW) / 2;
  let y = (height - drawH) / 2;

  image(kinectImage, x, y, drawW, drawH);

  filter(INVERT, false);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}