import { useEffect, useRef, useState, useCallback } from "react";
import {
    GestureRecognizer,
    FilesetResolver,
    DrawingUtils
} from "@mediapipe/tasks-vision";

// --- Types ---
type Landmark = { x: number; y: number; z: number };
type ReferenceSample = { label: string; vector: number[] };

interface UseSignLanguageProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef?: React.RefObject<HTMLCanvasElement | null>; // Optional canvas for debugging
    isEnabled: boolean;
    isSignMode: boolean; // Add explicit mode flag if passed, otherwise assume enabled = mode
}

export function useSignLanguage({ videoRef, canvasRef, isEnabled, isSignMode }: UseSignLanguageProps) {
    const [detectedGesture, setDetectedGesture] = useState<string>("");
    const [confidence, setConfidence] = useState<number>(0);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(true); // Also tracks CSV loading

    // Sentence State
    const [currentSentence, setCurrentSentence] = useState<string>("");
    const [confirmedSentence, setConfirmedSentence] = useState<string>("");

    // Refs
    const recognizerRef = useRef<GestureRecognizer | null>(null);
    const requestRef = useRef<number>(undefined);
    const referenceDataRef = useRef<ReferenceSample[]>([]);
    const bufferRef = useRef<string[]>([]);
    const lastProcessedTimeRef = useRef<number>(0);

    // Logic Constants
    const KNN_K = 5;
    const MIN_CONFIDENCE = 0.7;
    const BUFFER_SIZE = 10;
    const POLLING_RATE_MS = 60; // ~15 FPS to save CPU for KNN

    // --- 1. Helper: Normalization (Center + Scale) ---
    const normalizeLandmarks = (landmarks: Landmark[]): number[] => {
        if (landmarks.length === 0) return [];

        // Center on Wrist (index 0)
        const wrist = landmarks[0];
        const centered = landmarks.map(lm => ({
            x: lm.x - wrist.x,
            y: lm.y - wrist.y,
            z: lm.z - wrist.z
        }));

        // Scale by max distance from wrist
        const maxDist = Math.max(...centered.map(lm => Math.sqrt(lm.x ** 2 + lm.y ** 2 + lm.z ** 2)));
        const scale = maxDist > 0 ? maxDist : 1;

        // Flatten to vector [x, y, z, x, y, z...]
        const vector: number[] = [];
        centered.forEach(lm => {
            vector.push(lm.x / scale, lm.y / scale, lm.z / scale);
        });

        return vector;
    };

    // --- 2. Load CSV Dataset ---
    useEffect(() => {
        const loadResources = async () => {
            try {
                // A. Load MediaPipe Model
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
                );
                recognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 1
                });

                // B. Load CSV Dataset
                const response = await fetch('/asl_mediapipe_keypoints_dataset.csv');
                const text = await response.text();
                const lines = text.split('\n');

                const samples: ReferenceSample[] = [];
                // Skip header (line 0)
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const parts = line.split(',');
                    const label = parts[parts.length - 1]; // Last col is label

                    // The CSV contains pre-normalized (or raw) coords in columns 0..62
                    // To be safe, we re-construct and RE-normalize to match our live pipeline exactly.
                    const rawValues = parts.slice(0, parts.length - 1).map(Number);

                    const landmarks: Landmark[] = [];
                    for (let j = 0; j < rawValues.length; j += 3) {
                        landmarks.push({ x: rawValues[j], y: rawValues[j + 1], z: rawValues[j + 2] });
                    }

                    if (landmarks.length === 21) {
                        // Re-normalize to ensure consistency with live data
                        const vector = normalizeLandmarks(landmarks);
                        samples.push({ label, vector });
                    }
                }

                referenceDataRef.current = samples;
                console.log(`✅ Loaded ${samples.length} ASL samples & MediaPipe Model`);
                setIsModelLoading(false);

            } catch (error) {
                console.error("Initialization Failed:", error);
            }
        };

        loadResources();
    }, []);


    // --- 3. Classification (KNN) ---
    const classify = useCallback((landmarks: Landmark[]) => {
        if (referenceDataRef.current.length === 0) return { label: "", score: 0 };

        const inputVector = normalizeLandmarks(landmarks);
        const pqueue: { dist: number; label: string }[] = [];

        // Optimization: Stride (check every Nth sample) to improve performance
        // This is safe if dataset is shuffled or large enough
        const STRIDE = 10;

        for (let i = 0; i < referenceDataRef.current.length; i += STRIDE) {
            const sample = referenceDataRef.current[i];

            // Euclidean Distance
            let sum = 0;
            for (let j = 0; j < inputVector.length; j++) {
                sum += (inputVector[j] - sample.vector[j]) ** 2;
            }
            const dist = Math.sqrt(sum);

            // Maintain Top K
            if (pqueue.length < KNN_K) {
                pqueue.push({ dist, label: sample.label });
                pqueue.sort((a, b) => a.dist - b.dist);
            } else if (dist < pqueue[pqueue.length - 1].dist) {
                pqueue.pop();
                pqueue.push({ dist, label: sample.label });
                pqueue.sort((a, b) => a.dist - b.dist);
            }
        }

        // Weighted Voting (closer distance = higher weight)
        // Simple Majority Vote
        const counts: { [key: string]: number } = {};
        pqueue.forEach(p => {
            counts[p.label] = (counts[p.label] || 0) + 1;
        });

        let bestLabel = "";
        let maxCount = 0;
        for (const l in counts) {
            if (counts[l] > maxCount) {
                maxCount = counts[l];
                bestLabel = l;
            }
        }

        return { label: bestLabel, score: maxCount / KNN_K };
    }, []);


    // --- 4. Prediction Loop ---
    const predict = useCallback(() => {
        if (!isEnabled || !isSignMode || !recognizerRef.current || !videoRef.current) return;

        const now = performance.now();
        if (now - lastProcessedTimeRef.current < POLLING_RATE_MS) {
            requestRef.current = requestAnimationFrame(predict);
            return;
        }
        lastProcessedTimeRef.current = now;

        const video = videoRef.current;
        if (video.readyState < 2) {
            requestRef.current = requestAnimationFrame(predict);
            return;
        }

        try {
            const results = recognizerRef.current.recognizeForVideo(video, now);

            // Canvas Drawing
            if (canvasRef?.current) {
                const ctx = canvasRef.current.getContext("2d");
                if (ctx) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    canvasRef.current.width = video.videoWidth;
                    canvasRef.current.height = video.videoHeight;

                    if (results.landmarks) {
                        const drawingUtils = new DrawingUtils(ctx);
                        for (const landmarks of results.landmarks) {
                            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
                            drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
                        }
                    }
                }
            }

            // Detection
            if (results.landmarks && results.landmarks.length > 0) {
                const landmarks = results.landmarks[0];
                const { label, score } = classify(landmarks);

                if (score >= MIN_CONFIDENCE) {
                    // Buffer for temporal smoothing
                    const buffer = bufferRef.current;
                    buffer.push(label);
                    if (buffer.length > BUFFER_SIZE) buffer.shift();

                    // Check stability (e.g. 70% of buffer matches)
                    const counts: { [key: string]: number } = {};
                    let stableLabel = "";
                    let maxFreq = 0;
                    buffer.forEach(l => counts[l] = (counts[l] || 0) + 1);

                    for (const l in counts) {
                        if (counts[l] > maxFreq) {
                            maxFreq = counts[l];
                            stableLabel = l;
                        }
                    }

                    if (maxFreq > BUFFER_SIZE * 0.7) {
                        setDetectedGesture(stableLabel);
                        setConfidence(score);
                        handleSentenceLogic(stableLabel);
                    }
                } else {
                    setDetectedGesture("");
                    setConfidence(0);
                }
            } else {
                bufferRef.current = []; // Clear buffer if no hands
            }

        } catch (err) {
            console.error(err);
        }

        requestRef.current = requestAnimationFrame(predict);
    }, [isEnabled, isSignMode, classify, canvasRef, videoRef]);


    // --- 5. Sentence Logic ---
    const lastCharRef = useRef<string>("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const WORD_MAP: { [key: string]: string } = {
        "A": "Am",
        "B": "Bad",
        "E": "Assalamualaikum",
        "G": "Go",
        "H": "Hospital",
        "I": "I",
        "J": "Arun Nats",
        "L": "Love",
        "O": "Now",
        "P": "Please",
        "U": "You",
        "W": "Want",
        "X": "DELETE", // Delete
        "Y": "CONFIRM" // Confirm
    };

    const handleSentenceLogic = (gesture: string) => {
        // Clean label from dataset (some might have extra spaces)
        const label = gesture.trim();

        // 1. Check if allowed in user list
        const allowed = ["A", "B", "E", "G", "H", "I", "J", "L", "O", "P", "U", "W", "X", "Y"];
        if (!allowed.includes(label)) return;

        // Prevent spamming the same word instantly
        if (label === lastCharRef.current) return;

        const mappedWord = WORD_MAP[label];
        if (!mappedWord) return;

        if (mappedWord === "DELETE") {
            setCurrentSentence(prev => {
                const words = prev.trim().split(" ");
                return words.slice(0, -1).join(" ");
            });
        } else if (mappedWord === "CONFIRM") {
            // Trigger confirmation (TTS) + Auto Period
            setCurrentSentence(prev => {
                if (prev.trim()) {
                    setConfirmedSentence(prev.trim() + "."); // Add period automatically
                    return "";
                }
                return prev;
            });
        } else {
            // Normal word append
            setCurrentSentence(prev => {
                const trimmed = prev.trim();
                if (!trimmed) return mappedWord;

                const words = trimmed.split(" ");
                const lastWord = words[words.length - 1];

                if (lastWord === mappedWord) return prev; // Ignore duplicate

                return trimmed + " " + mappedWord;
            });
        }

        lastCharRef.current = label;

        // Allow repeating after delay
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { lastCharRef.current = ""; }, 2000);
    };

    const confirmSentence = () => {
        if (currentSentence.trim()) {
            setConfirmedSentence(currentSentence);
            setCurrentSentence("");
        }
    };

    const clearSentence = () => {
        setCurrentSentence("");
        setConfirmedSentence("");
    };


    // --- 6. Lifecycle ---
    useEffect(() => {
        if (isEnabled && isSignMode && !isModelLoading) {
            requestRef.current = requestAnimationFrame(predict);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            setDetectedGesture("");
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isEnabled, isSignMode, isModelLoading, predict]);

    return {
        detectedGesture,
        confidence,
        isModelLoading,
        currentSentence,
        confirmedSentence,
        confirmSentence, // Expose control
        clearSentence
    };
}

