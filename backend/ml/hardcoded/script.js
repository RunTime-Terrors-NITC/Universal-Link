const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');

const hands = new Hands({
    locateFile: file =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1, 
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

function isFingerOpen(tip, pip, mcp) {
    return tip.y < pip.y && pip.y < mcp.y;
}

function getFingerStates(lm) {
    return {
        index:  isFingerOpen(lm[8],  lm[6],  lm[5]),
        middle: isFingerOpen(lm[12], lm[10], lm[9]),
        ring:   isFingerOpen(lm[16], lm[14], lm[13]),
        pinky:  isFingerOpen(lm[20], lm[18], lm[17]),
    };
}

function isPeaceGesture(fingers) {
    return (
        fingers.index &&
        fingers.middle &&
        !fingers.ring &&
        !fingers.pinky
    );
}
function isBird(fingers) {
    return (
        !fingers.index &&
        fingers.middle &&
        !fingers.ring &&
        !fingers.pinky
    );
}


hands.onResults(results => {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (
        results.multiHandLandmarks &&
        results.multiHandLandmarks.length > 0 &&
        results.multiHandLandmarks[0].length === 21
    ) {
        const lm = results.multiHandLandmarks[0];

        drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, { color: '#00FF00' });
        drawLandmarks(canvasCtx, lm, { color: '#FF0000' });

        const fingers = getFingerStates(lm);

        if (isPeaceGesture(fingers)) {
        console.log("✌️ PEACE");
        }
        if(isBird(fingers)){
            console.log("Fuck Off");
        }
    }
});


const camera = new Camera(videoElement, {
    onFrame: async () => {
    await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

camera.start();
