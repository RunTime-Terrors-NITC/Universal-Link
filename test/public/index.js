const socket = io();

// Server will pair two connected sockets and emit pairing events
socket.on("waiting", () => {
  showStatus("Waiting for peer...", "waiting");
  log("Waiting for a peer to connect...");
});

socket.on("peer-joined", (data) => {
  showStatus("Peer joined: " + data.peerId, "ready");
  log("Paired with peer: " + data.peerId);
});

// Receive SDP from peer (sent by host) and print to console
socket.on("sdp", (data) => {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    handleremotesdp(parsed);
  } catch (e) {
    console.error("Failed to parse/handle incoming SDP:", e, data);
  }
});

socket.on("peer-disconnected", () => {
  showStatus("Peer disconnected", "error");
  log("Peer disconnected");
});

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

let pc;
let localStream;
let dataChannel;
let mediaPipeCamera;
let hands;
let lastGesture = null;

const localVideo = document.getElementById("myvideo");
const remoteVideo = document.getElementById("remoteVideo");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");
const initBtn = document.getElementById("initBtn");
const statusMsg = document.getElementById("status-msg");
const gestureMessagesContainer = document.getElementById("gesture-messages");

function showStatus(msg, type = "waiting") {
  statusMsg.textContent = msg;
  statusMsg.className = `status-${type}`;
  statusMsg.style.display = "block";
}

function log(msg, type = "info") {
  const el = document.createElement("div");
  el.textContent = `[${type.toUpperCase()}] ${msg}`;
  el.style.color = type === "error" ? "#ff5555" : "#aaa";
  el.style.borderBottom = "1px solid #333";
  el.style.padding = "3px 0";

  const logContainer = document.getElementById("debug-log");
  if (logContainer) {
    logContainer.style.display = "block";
    logContainer.prepend(el);
  }
  console.log(`[${type}]`, msg);
}

function displayGesture(message, isSent = true) {
  // Clear placeholder
  if (gestureMessagesContainer.querySelector('[style*="text-align: center"]')) {
    gestureMessagesContainer.innerHTML = "";
  }

  const messageEl = document.createElement("div");
  messageEl.className = `gesture-message ${isSent ? "gesture-sent" : "gesture-received"}`;

  const timestamp = new Date().toLocaleTimeString();
  const prefix = isSent ? "➤ You:" : "◀ Remote:";

  messageEl.innerHTML = `
        <strong>${prefix}</strong> ${message}
        <span class="gesture-time">${timestamp}</span>
    `;

  gestureMessagesContainer.prepend(messageEl);

  // Keep only last 20 messages
  while (gestureMessagesContainer.children.length > 20) {
    gestureMessagesContainer.removeChild(gestureMessagesContainer.lastChild);
  }
}

async function initApp() {
  try {
    showStatus("Initializing...", "waiting");
    log("Starting initialization...");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is NOT supported. Use HTTPS or localhost.");
    }

    // Try getting video and audio with fallbacks
    localStream = await getMediaStream();

    // Display the stream
    if (localStream.getVideoTracks().length > 0) {
      localVideo.srcObject = localStream;
      await localVideo.play();
    } else {
      localVideo.style.background = "#222";
      const label = localVideo.parentElement.querySelector(".label");
      label.textContent = "You (Audio Only)";
    }

    // Create WebRTC connection
    createPeerConnection();

    // Initialize MediaPipe hand tracking
    await initializeHandTracking();

    // Update UI
    initBtn.parentElement.style.display = "none";
    document.getElementById("step-create").style.display = "block";
    document.getElementById("step-data").style.display = "block";

    showStatus(
      "Ready. Choose 'Start Call' or paste a code from a friend.",
      "waiting",
    );
  } catch (e) {
    console.error(e);
    let msg = "Error: " + e.message;
    if (e.name === "NotFoundError") msg = "No device found.";
    if (e.name === "NotAllowedError") msg = "Permission denied.";

    showStatus(msg, "error");
    log(e.stack || e.message, "error");
  }
}

async function getMediaStream() {
  // Try Video + Audio
  try {
    log("Requesting Video+Audio...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: true,
    });
    log("Got Video+Audio stream.");
    return stream;
  } catch (e) {
    log("Video+Audio failed: " + e.message, "error");
  }

  // Try Video only
  try {
    log("Requesting Video Only...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    showStatus("Microphone not found, using video only.", "waiting");
    log("Got Video Only stream.");
    return stream;
  } catch (e) {
    log("Video Only failed: " + e.message, "error");
  }

  // Try Audio only
  try {
    log("Requesting Audio Only...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    showStatus("Camera not found, using audio only.", "waiting");
    log("Got Audio Only stream.");

    if (
      confirm(
        "Camera failed, but Mic works. Add a 'Fake Video' stream for testing?",
      )
    ) {
      const fakeStream = createFakeStream();
      const videoTrack = fakeStream.getVideoTracks()[0];
      stream.addTrack(videoTrack);
      log("Added FAKE video track to Real audio.");
    }
    return stream;
  } catch (e) {
    log("Audio Only failed: " + e.message, "error");
  }

  // Use fake stream as last resort
  if (
    confirm(
      "Camera/Mic failed. Use simulated (fake) camera to test connection?",
    )
  ) {
    const stream = createFakeStream();
    log("Using FAKE stream.");
    return stream;
  }

  throw new Error("Could not get media stream");
}

function createFakeStream() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");

  // Animation to prove it's live
  setInterval(() => {
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#" + Math.floor(Math.random() * 16777215).toString(16);
    ctx.font = "30px Arial";
    ctx.fillText("TEST VIDEO " + new Date().toLocaleTimeString(), 120, 240);
  }, 1000);

  const stream = canvas.captureStream(30);

  // Add dummy audio track
  try {
    const audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const dst = audioCtx.createMediaStreamDestination();
    osc.connect(dst);
    osc.start();
    const track = dst.stream.getAudioTracks()[0];
    stream.addTrack(track);
  } catch (e) {
    log("Could not create fake audio: " + e.message, "error");
  }

  return stream;
}

function createPeerConnection() {
  pc = new RTCPeerConnection(config);

  // Create data channel for gestures
  dataChannel = pc.createDataChannel("gestures");
  dataChannel.onopen = () => {
    log("Data channel opened successfully");
    showStatus("Connected! Data channel ready.", "ready");
  };
  dataChannel.onmessage = (event) => {
    log("Remote gesture received: " + event.data);
    displayGesture(event.data, false);
  };
  dataChannel.onerror = (error) => {
    log("Data channel error: " + error, "error");
  };

  // Add local tracks
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
    log(`Added ${track.kind} track to peer connection`);
  });

  // Handle remote tracks
  pc.ontrack = (event) => {
    log("Remote track received: " + event.track.kind);
    remoteVideo.srcObject = event.streams[0];
  };

  // Handle incoming data channel (for receiving side)
  pc.ondatachannel = (event) => {
    const receiveChannel = event.channel;
    log("Received data channel: " + receiveChannel.label);

    receiveChannel.onmessage = (e) => {
      log("Remote gesture: " + e.data);
      displayGesture(e.data, false);
    };
    receiveChannel.onopen = () => {
      log("Receive data channel opened");
    };
  };

  // ICE Candidate handling
  pc.onicecandidate = (event) => {
    if (event.candidate === null) {
      // ICE gathering complete
      document.getElementById("localSdp").value = JSON.stringify(
        pc.localDescription,
      );
      console.log(JSON.stringify(pc.localDescription));
      socket.emit("sdp", JSON.stringify(pc.localDescription)); // Send SDP to peer via signaling server
      showStatus("Code generated! Copy 'Your Code' and send it.", "ready");
    }
  };

  // Connection state monitoring
  pc.oniceconnectionstatechange = () => {
    log("ICE State: " + pc.iceConnectionState);
    if (pc.iceConnectionState === "connected") {
      showStatus("Connected!", "ready");
    } else if (pc.iceConnectionState === "disconnected") {
      showStatus("Disconnected", "error");
    } else if (pc.iceConnectionState === "failed") {
      showStatus("Connection failed", "error");
    }
  };

  pc.onconnectionstatechange = () => {
    log("Connection State: " + pc.connectionState);
  };
}

async function createOffer() {
  try {
    showStatus("Generating offer... please wait for code.", "waiting");
    log("Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    log("Offer created and set as local description");
  } catch (e) {
    log("Error creating offer: " + e.message, "error");
    showStatus("Error creating offer", "error");
  }
}

async function createAnswer() {
  try {
    showStatus("Generating answer... please wait for code.", "waiting");
    log("Creating answer...");
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    log("Answer created and set as local description");
  } catch (e) {
    log("Error creating answer: " + e.message, "error");
    showStatus("Error creating answer", "error");
  }
}

async function handleremotesdp(remoteDesc) {
  try {
    if (!remoteDesc) throw new Error("No remote SDP provided");

    // If a string was somehow passed, try to parse it
    const desc =
      typeof remoteDesc === "string" ? JSON.parse(remoteDesc) : remoteDesc;

    if (!pc) {
      console.warn("PeerConnection not created yet. Creating one now.");
      createPeerConnection();
    }

    await pc.setRemoteDescription(desc);

    if (desc.type === "offer") {
      await createAnswer();
    } else {
      showStatus("Answer processed. Connection establishing...", "waiting");
    }
  } catch (e) {
    console.error("handleremotesdp error:", e);
    showStatus("Error applying remote SDP: " + e.message, "error");
  }
}

function copyToClipboard(elementId, event) {
  const copyText = document.getElementById(elementId);
  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile

  // Try modern API
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(copyText.value)
      .then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = "✓ Copied!";
        setTimeout(() => (btn.textContent = originalText), 1500);
      })
      .catch(() => {
        // Fallback
        document.execCommand("copy");
      });
  } else {
    document.execCommand("copy");
  }
}

async function initializeHandTracking() {
  try {
    log("Initializing MediaPipe Hands...");

    hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults(onHandsResults);

    // Only start camera if we have video track
    if (localStream.getVideoTracks().length > 0) {
      mediaPipeCamera = new Camera(localVideo, {
        onFrame: async () => {
          await hands.send({ image: localVideo });
        },
        width: 640,
        height: 480,
      });

      await mediaPipeCamera.start();
      log("MediaPipe camera started");
    } else {
      log("No video track available, skipping hand tracking", "error");
    }
  } catch (e) {
    log("Error initializing hand tracking: " + e.message, "error");
  }
}

function onHandsResults(results) {
  // Clear and redraw canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height,
  );

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];

    // Draw hand landmarks
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 2,
    });
    drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 1 });

    // Detect gesture
    const fingers = getFingerStates(landmarks);
    detectAndSendGesture(fingers);
  }

  canvasCtx.restore();
}

// Gesture Detection Logic
function isFingerOpen(tip, pip, mcp) {
  return tip.y < pip.y && pip.y < mcp.y;
}

function getFingerStates(lm) {
  return {
    thumb: isFingerOpen(lm[4], lm[3], lm[2]),
    index: isFingerOpen(lm[8], lm[6], lm[5]),
    middle: isFingerOpen(lm[12], lm[10], lm[9]),
    ring: isFingerOpen(lm[16], lm[14], lm[13]),
    pinky: isFingerOpen(lm[20], lm[18], lm[17]),
  };
}

function isPeaceGesture(fingers) {
  return fingers.index && fingers.middle && !fingers.ring && !fingers.pinky;
}

function isFist(fingers) {
  return (
    !fingers.thumb &&
    !fingers.index &&
    !fingers.middle &&
    !fingers.ring &&
    !fingers.pinky
  );
}

function isThumbsUp(fingers) {
  return (
    fingers.thumb &&
    !fingers.index &&
    !fingers.middle &&
    !fingers.ring &&
    !fingers.pinky
  );
}

function isHelloGesture(fingers) {
  return (
    fingers.thumb &&
    fingers.index &&
    fingers.middle &&
    fingers.ring &&
    fingers.pinky
  );
}

function isBirdGesture(fingers) {
  return !fingers.index && fingers.middle && !fingers.ring && !fingers.pinky;
}

function detectAndSendGesture(fingers) {
  let gesture = null;
  let message = null;

  if (isPeaceGesture(fingers) && lastGesture !== "PEACE") {
    gesture = "PEACE";
    message = "✌️ Peace";
  } else if (isBirdGesture(fingers) && lastGesture !== "BIRD") {
    gesture = "BIRD";
    message = "🖕 Middle Finger";
  } else if (isHelloGesture(fingers) && lastGesture !== "HELLO") {
    gesture = "HELLO";
    message = "👋 Hello";
  } else if (isFist(fingers) && lastGesture !== "FIST") {
    gesture = "FIST";
    message = "✊ Fist";
  } else if (isThumbsUp(fingers) && lastGesture !== "THUMBS") {
    gesture = "THUMBS";
    message = "👍 Thumbs Up";
  }

  if (gesture && message) {
    lastGesture = gesture;

    // Send via data channel
    if (dataChannel && dataChannel.readyState === "open") {
      dataChannel.send(message);
      log("Sent gesture: " + message);
      displayGesture(message, true);
    } else {
      log("Data channel not ready, gesture not sent", "error");
    }
  }
}

// ========================================
// 6. INITIALIZATION
// ========================================
log("Application loaded. Click 'Initialize Camera' to start.");
