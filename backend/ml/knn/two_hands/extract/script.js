const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const copyBtn = document.getElementById('copyBtn');
const output = document.getElementById('output');
const status = document.getElementById('status');
const copyFeedback = document.getElementById('copyFeedback');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let finalSamples = [];
let resolveHand;

// ---------------- MEDIAPIPE SETUP ----------------
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5
});

hands.onResults(results => {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    resolveHand(null);
    return;
  }

  let left = null;
  let right = null;

  results.multiHandLandmarks.forEach((landmarks, i) => {
    const label = results.multiHandedness[i].label; // "Left" or "Right"
    const vector = normalizeLandmarks(landmarks);

    if (label === "Left") left = vector;
    if (label === "Right") right = vector;
  });

  resolveHand({ left, right });
});


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
    parseFloat((p.x / maxDist).toFixed(6)),
    parseFloat((p.y / maxDist).toFixed(6)),
    parseFloat((p.z / maxDist).toFixed(6))
  ]);
}

// ---------------- BATCH PROCESSING ----------------
async function processImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      resolveHand = resolve;
      await hands.send({ image: canvas });
    };
    img.src = URL.createObjectURL(file);
  });
}

processBtn.onclick = async () => {
  const files = fileInput.files;
  if (files.length === 0) return alert("Please select images first.");

  finalSamples = [];
  status.innerText = "Processing...";
  processBtn.disabled = true;
  copyBtn.disabled = true;

  for (let i = 0; i < files.length; i++) {
    status.innerText = `Processing ${i + 1}/${files.length}...`;
    const result = await processImage(files[i]);

    if (result) {
        finalSamples.push({
        id: finalSamples.length + 1,
        vector: {
            left: result.left,
            right: result.right
        }
        });
    }
  }

  const resultJSON = { samples: finalSamples };
  output.innerText = JSON.stringify(resultJSON, null, 4);
  
  status.innerText = `Done! Created ${finalSamples.length} samples.`;
  processBtn.disabled = false;
  copyBtn.disabled = false;
};

// ---------------- COPY TO CLIPBOARD ----------------
copyBtn.onclick = async () => {
  const textToCopy = output.innerText;
  try {
    await navigator.clipboard.writeText(textToCopy);
    copyFeedback.innerText = "✓ Copied!";
    copyFeedback.style.color = "#0f0";
    
    // Reset feedback message after 2 seconds
    setTimeout(() => { copyFeedback.innerText = ""; }, 2000);
  } catch (err) {
    console.error("Failed to copy: ", err);
    copyFeedback.innerText = "Error copying.";
    copyFeedback.style.color = "red";
  }
};