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
        left: sample.vector.left,
        right: sample.vector.right
      });
    });
  });

  console.log("✅ Dataset loaded:", referenceSamples.length, "samples");
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

// ---------------- DISTANCE ----------------
function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// ---------------- KNN ----------------
const K = 1;

function classify(input) {
  const distances = [];

  for (const ref of referenceSamples) {
    let dist = 0;
    let used = 0;

    if (input.left && ref.left) {
      dist += euclidean(input.left, ref.left);
      used++;
    }

    if (input.right && ref.right) {
      dist += euclidean(input.right, ref.right);
      used++;
    }

    // Skip if no comparable hands
    if (used === 0) continue;

    distances.push({
      label: ref.label,
      dist: dist / used // normalize by number of hands used
    });
  }

  if (distances.length === 0) return null;

  distances.sort((a, b) => a.dist - b.dist);
  const kNearest = distances.slice(0, K);

  const counts = {};
  kNearest.forEach(n => {
    counts[n.label] = (counts[n.label] || 0) + 1;
  });

  let bestLabel = null;
  let maxCount = -1;

  for (const label in counts) {
    if (counts[label] > maxCount) {
      maxCount = counts[label];
      bestLabel = label;
    }
  }

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
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.9,
  minTrackingConfidence: 0.9
});

let lastGesture = "";

hands.onResults(results => {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0)
    return;

  let input = { left: null, right: null };

  results.multiHandLandmarks.forEach((landmarks, i) => {
    if (!landmarks || landmarks.length !== 21) return;

    const label = results.multiHandedness[i].label; // "Left" / "Right"
    const vector = normalizeLandmarks(landmarks);

    if (label === "Left") input.left = vector;
    if (label === "Right") input.right = vector;
  });
  console.log(input);
  const prediction = classify(input);
  if (!prediction) return;

  if (lastGesture !== prediction.label) {
    lastGesture = prediction.label;
    console.log(
      "🖐️ Prediction:",
      prediction.label,
      "distance:",
      prediction.dist.toFixed(3)
    );
  }
});

// ---------------- CAMERA ----------------
let frameCount = 0;
const FrameSkip = 30;

const camera = new Camera(video, {
  onFrame: async () => {
    frameCount++;
    if (frameCount % FrameSkip !== 0) return;
    if (frameCount > 1_000_000) frameCount = 0;
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

// ---------------- INIT ----------------
(async () => {
  await loadDataset();
  camera.start();
})();
