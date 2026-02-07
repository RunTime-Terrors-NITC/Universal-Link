const video = document.getElementById("video");

let referenceSamples = [];

// ---------------- LOAD DATASET ----------------
async function loadDataset() {
  const res = await fetch("./dataset.json");
  const data = await res.json();

  data.gestures.forEach(gesture => {
    gesture.samples.forEach(sample => {
      referenceSamples.push({
        label: gesture.label,
        vector: sample.vector
      });
    });
  });

  console.log("✅ Dataset loaded:", referenceSamples);
}

// ---------------- NORMALIZATION ----------------
function normalizeLandmarks(landmarks) {
  const wrist = landmarks[0];

  let maxDist = 0;
  const relative = landmarks.map(p => {
    const x = p.x - wrist.x;
    const y = p.y - wrist.y;
    const z = p.z - wrist.z;
    maxDist = Math.max(maxDist, Math.sqrt(x*x + y*y + z*z));
    return { x, y, z };
  });

  return relative.flatMap(p => [
    p.x / maxDist,
    p.y / maxDist,
    p.z / maxDist
  ]);
}

// ---------------- KNN ----------------
const K = 5; // Change this value to adjust K

function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function classify(vector) {
  // 1. Calculate distance to ALL reference samples
  const allDistances = referenceSamples.map(ref => ({
    label: ref.label,
    dist: euclidean(vector, ref.vector)
  }));

  // 2. Sort by distance (smallest to largest)
  allDistances.sort((a, b) => a.dist - b.dist);

  // 3. Slice the top K
  const kNearest = allDistances.slice(0, K);

  // 4. Vote / Frequency Count
  const counts = {};
  kNearest.forEach(neighbor => {
    counts[neighbor.label] = (counts[neighbor.label] || 0) + 1;
  });

  // 5. Find the label with the highest count
  let bestLabel = null;
  let maxCount = -1;

  for (const label in counts) {
    if (counts[label] > maxCount) {
      maxCount = counts[label];
      bestLabel = label;
    }
  }

  // Return the best label.
  // We also return the distance of the *closest* neighbor (kNearest[0].dist)
  // so your existing console.log code continues to work without errors.
  return { 
    label: bestLabel, 
    dist: kNearest[0].dist 
  };
}

// ---------------- MEDIAPIPE ----------------
const hands = new Hands({
  locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.9,
  minTrackingConfidence: 0.9
});

let lastGesture=""

hands.onResults(results => {
  if (
    !results.multiHandLandmarks ||
    results.multiHandLandmarks.length === 0
  ) {
    return;
  }

  const landmarks = results.multiHandLandmarks[0];
  if (!landmarks || landmarks.length !== 21) return;

  const vector = normalizeLandmarks(landmarks);
  const prediction = classify(vector);

  if(lastGesture!=prediction.label){
      lastGesture=prediction.label;
      console.log(
        "🖐️ Prediction:",
        prediction.label,
        "distance:",
        prediction.dist.toFixed(3)
      );
  }
});


// ---------------- CAMERA ----------------
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

(async () => {
  await loadDataset();
  camera.start();
})();
