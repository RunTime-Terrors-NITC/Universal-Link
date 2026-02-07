
import { useEffect, useRef, useState, useCallback } from "react";
import { Hands, type Results } from "@mediapipe/hands";
// import * as Cam from "@mediapipe/camera_utils"; // Unused

// Types
interface Landmark {
    x: number;
    y: number;
    z: number;
}

interface ReferenceSample {
    label: string;
    vector: number[];
}

interface Dataset {
    gestures: Array<{
        label: string;
        samples: Array<{
            vector: number[];
        }>;
    }>;
}

interface UseSignLanguageProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isEnabled: boolean;
}

const K = 5;

export function useSignLanguage({ videoRef, isEnabled }: UseSignLanguageProps) {
    const [detectedGesture, setDetectedGesture] = useState<string>("");
    const [confidence, setConfidence] = useState<number>(0);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
    const handsRef = useRef<Hands | null>(null);
    // const cameraRef = useRef<Cam.Camera | null>(null); // Unused
    const referenceSamplesRef = useRef<ReferenceSample[]>([]);
    const lastVideoTimeRef = useRef<number>(-1);
    const frameIdRef = useRef<number>(0);

    // Load dataset
    useEffect(() => {
        async function loadDataset() {
            try {
                const res = await fetch("/dataset.json");
                const data: Dataset = await res.json();
                const samples: ReferenceSample[] = [];

                data.gestures.forEach((gesture) => {
                    gesture.samples.forEach((sample) => {
                        samples.push({
                            label: gesture.label,
                            vector: sample.vector,
                        });
                    });
                });

                referenceSamplesRef.current = samples;
                console.log("✅ Dataset loaded:", samples.length, "samples");
            } catch (error) {
                console.error("Failed to load dataset:", error);
            }
        }
        loadDataset();
    }, []);

    // Initialize MediaPipe Hands
    useEffect(() => {
        const hands = new Hands({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5,
        });

        hands.onResults(onResults);
        handsRef.current = hands;
        setIsModelLoading(false);

        return () => {
            // Cleanup if needed
        };
    }, []);

    // KNN Logic
    const normalizeLandmarks = useCallback((landmarks: Landmark[]) => {
        const wrist = landmarks[0];
        let maxDist = 0;

        const relative = landmarks.map((p) => {
            const x = p.x - wrist.x;
            const y = p.y - wrist.y;
            const z = p.z - wrist.z;
            maxDist = Math.max(maxDist, Math.sqrt(x * x + y * y + z * z));
            return { x, y, z };
        });

        return relative.flatMap((p) => [
            p.x / maxDist,
            p.y / maxDist,
            p.z / maxDist,
        ]);
    }, []);

    const euclidean = useCallback((a: number[], b: number[]) => {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            const d = a[i] - b[i];
            sum += d * d;
        }
        return Math.sqrt(sum);
    }, []);

    const classify = useCallback(
        (vector: number[]) => {
            if (referenceSamplesRef.current.length === 0) return null;

            // 1. Calculate distances
            const allDistances = referenceSamplesRef.current.map((ref) => ({
                label: ref.label,
                dist: euclidean(vector, ref.vector),
            }));

            // 2. Sort by distance
            allDistances.sort((a, b) => a.dist - b.dist);

            // 3. Slice top K
            const kNearest = allDistances.slice(0, K);

            // 4. Vote
            const counts: Record<string, number> = {};
            kNearest.forEach((neighbor) => {
                counts[neighbor.label] = (counts[neighbor.label] || 0) + 1;
            });

            // 5. Find best label
            let bestLabel = "";
            let maxCount = -1;

            for (const label in counts) {
                if (counts[label] > maxCount) {
                    maxCount = counts[label];
                    bestLabel = label;
                }
            }

            return {
                label: bestLabel,
                dist: kNearest[0].dist,
            };
        },
        [euclidean]
    );

    const [currentSentence, setCurrentSentence] = useState<string>("");
    const [confirmedSentence, setConfirmedSentence] = useState<string>("");
    const detectionBufferRef = useRef<string[]>([]);
    const lastProcessedGestureRef = useRef<string>("");
    const activeGestureRef = useRef<string>("");
    const lastConfidenceRef = useRef<number>(0);

    // Helper: Find most frequent string in array
    const getMode = (arr: string[]) => {
        if (arr.length === 0) return "";
        const counts: Record<string, number> = {};
        let maxCount = 0;
        let mode = "";

        for (const item of arr) {
            counts[item] = (counts[item] || 0) + 1;
            if (counts[item] > maxCount) {
                maxCount = counts[item];
                mode = item;
            }
        }
        return mode;
    };

    const onResults = useCallback(
        (results: Results) => {
            let label = "";
            let dist = 0;

            if (
                results.multiHandLandmarks &&
                results.multiHandLandmarks.length > 0
            ) {
                const landmarks = results.multiHandLandmarks[0];
                const vector = normalizeLandmarks(landmarks as Landmark[]);
                const prediction = classify(vector);
                if (prediction) {
                    label = prediction.label;
                    dist = prediction.dist;
                }
            }

            // Buffer Logic
            const buffer = detectionBufferRef.current;
            buffer.push(label);

            // Keep buffer at size 20 (approx 0.6-1 sec of frames)
            if (buffer.length > 20) {
                buffer.shift();
            }

            // Process if buffer is full enough
            if (buffer.length >= 20) {
                const dominantGesture = getMode(buffer);

                // Count occurrences of dominant gesture
                const count = buffer.filter(g => g === dominantGesture).length;
                const threshold = 12; // 60% of 20 frames

                if (count >= threshold) {
                    // Update exposed state only if dominant gesture changes to avoid rapid re-renders
                    if (dominantGesture !== activeGestureRef.current) {
                        activeGestureRef.current = dominantGesture;
                        setDetectedGesture(dominantGesture);
                    }

                    // Update confidence
                    if (Math.abs(dist - lastConfidenceRef.current) > 0.1) {
                        lastConfidenceRef.current = dist;
                        setConfidence(dist);
                    }

                    // Sentence Construction Logic
                    // We only act if the stable gesture changes
                    if (dominantGesture !== lastProcessedGestureRef.current) {
                        console.log(`[useSignLanguage] Stable gesture changed: "${lastProcessedGestureRef.current}" -> "${dominantGesture}"`);
                        lastProcessedGestureRef.current = dominantGesture;

                        if (dominantGesture && dominantGesture !== "") {
                            if (dominantGesture === "Enter" || dominantGesture === "OK") {
                                console.log("[useSignLanguage] Confirmation detected - confirming sentence.");
                                // Commit sentence
                                setCurrentSentence((prev) => {
                                    setConfirmedSentence(prev.trim() + ".");
                                    return "";
                                });
                            } else {
                                // Append word
                                setCurrentSentence((prev) => {
                                    // Don't append if it's the same as the last word in the sentence (to avoid "Hello Hello")
                                    // UNLESS the user explicitly made a different gesture in between (which they did, because lastProcessed changed)
                                    // But we should double check the last word of the sentence just in case.
                                    const words = prev.trim().split(" ");
                                    const lastWord = words[words.length - 1];

                                    if (lastWord !== dominantGesture) {
                                        const newSentence = (prev + " " + dominantGesture).trim();
                                        console.log("[useSignLanguage] Sentence updated:", newSentence);
                                        return newSentence;
                                    }
                                    return prev;
                                });
                            }
                        }
                    }
                }
            }
        },
        [classify, normalizeLandmarks]
    );

    // Processing Loop
    useEffect(() => {
        let active = true;

        const processVideo = async () => {
            if (!isEnabled || !videoRef.current || !handsRef.current) {
                return;
            }

            const video = videoRef.current;

            if (video.readyState < 2) {
                frameIdRef.current = requestAnimationFrame(processVideo);
                return;
            }

            if (video.currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = video.currentTime;
                try {
                    await handsRef.current.send({ image: video });
                } catch (err) {
                    console.error("MediaPipe error:", err);
                }
            }

            if (active) {
                frameIdRef.current = requestAnimationFrame(processVideo);
            }
        };

        if (isEnabled) {
            frameIdRef.current = requestAnimationFrame(processVideo);
            // Reset state when enabled
            detectionBufferRef.current = [];
            lastProcessedGestureRef.current = "";
        } else {
            cancelAnimationFrame(frameIdRef.current);
            setDetectedGesture("");
        }

        return () => {
            active = false;
            cancelAnimationFrame(frameIdRef.current);
        };
    }, [isEnabled, isModelLoading]);

    return {
        detectedGesture,
        confidence,
        isModelLoading,
        currentSentence,
        confirmedSentence
    };
}
