const video = document.getElementById("video");

let model;

// Load model
async function loadModel() {
  model = await tf.loadLayersModel("model/model.json");
  console.log("✅ Model Loaded");
}

loadModel();

function buildFeatureVector(multiHandLandmarks) {
  let features = [];

  // ---- 1. Hand count flag ----
  const twoHands = multiHandLandmarks.length === 2 ? 1 : 0;
  features.push(twoHands);

  // ---- 2. Landmarks ----
  // Always process TWO hands
  for (let i = 0; i < 2; i++) {
    if (multiHandLandmarks[i]) {
      multiHandLandmarks[i].forEach(p => {
        features.push(p.x, p.y, p.z);
      });
    } else {
      // Pad missing hand with zeros (21 × 3)
      for (let j = 0; j < 63; j++) {
        features.push(0);
      }
    }
  }

  return features; // length = 127
}


// MediaPipe Hands
const hands = new Hands({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

// Convert landmarks to array
function landmarksToArray(landmarks) {
  let arr = [];
  landmarks.forEach(p => {
    arr.push(p.x, p.y, p.z);
  });
  return arr;
}

hands.onResults(results => {
  if (!model || !results.multiHandLandmarks) return;

  const input = buildFeatureVector(results.multiHandLandmarks);
  console.log("Features:", input.length, input);

  if (input.length !== 127) {
    console.error("❌ Feature length mismatch:", input.length);
    return;
  }

  const tensor = tf.tensor([input]);

  const prediction = model.predict(tensor);
  const index = prediction.argMax(1).dataSync()[0];

  console.log("Prediction:", index);
});


// Camera
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

camera.start();
