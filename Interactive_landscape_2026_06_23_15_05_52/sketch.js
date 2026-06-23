let socket;
let shadowImg;
let loading = false;

function setup() {
  createCanvas(windowWidth, windowHeight);

  socket = new WebSocket("ws://localhost:8765");

  socket.onmessage = function (event) {
    if (loading) return;

    loading = true;

    loadImage("data:image/jpeg;base64," + event.data, function (img) {
      shadowImg = img;
      loading = false;
    });
  };
}

function draw() {
  background(255);

  if (!shadowImg) return;

  let s = Math.min(width / shadowImg.width, height / shadowImg.height);
  let drawW = shadowImg.width * s;
  let drawH = shadowImg.height * s;

  let x = (width - drawW) / 2;
  let y = (height - drawH) / 2;

  image(shadowImg, x, y, drawW, drawH);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}