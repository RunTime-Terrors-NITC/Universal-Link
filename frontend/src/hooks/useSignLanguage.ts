
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

    const onResults = useCallback(
        (results: Results) => {
            // console.log("MediaPipe Results received. Landmarks:", results.multiHandLandmarks?.length);
            if (
                !results.multiHandLandmarks ||
                results.multiHandLandmarks.length === 0
            ) {
                // setDetectedGesture("");
                return;
            }

            const landmarks = results.multiHandLandmarks[0];
            const vector = normalizeLandmarks(landmarks as Landmark[]);
            const prediction = classify(vector);

            // console.log("Prediction:", prediction);

            if (prediction) {
                // Simple smoothing or thresholding could be added here
                setDetectedGesture(prediction.label);
                setConfidence(prediction.dist);
            }
        },
        [classify, normalizeLandmarks]
    );

    // Processing Loop
    useEffect(() => {
        let active = true;
        // console.log("useSignLanguage effect triggered. isEnabled:", isEnabled);

        const processVideo = async () => {
            if (!isEnabled || !videoRef.current || !handsRef.current) {
                // console.log("Skipping processVideo", { isEnabled, video: !!videoRef.current, hands: !!handsRef.current });
                return;
            }

            const video = videoRef.current;

            if (video.readyState < 2) {
                // Video not ready
                // console.log("Video not ready, waiting...");
                frameIdRef.current = requestAnimationFrame(processVideo);
                return;
            }

            // Only process if time advanced (not paused)
            // Only process if time advanced (not paused)
            if (video.currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = video.currentTime;
                // console.log("Processing frame", video.currentTime, video.videoWidth, video.videoHeight);
                try {
                    await handsRef.current.send({ image: video });
                } catch (err) {
                    console.error("MediaPipe error:", err);
                }
            } else {
                // console.log("Frame skipped: time not advanced");
            }

            if (active) {
                frameIdRef.current = requestAnimationFrame(processVideo);
            }
        };

        if (isEnabled) {
            // console.log("Starting animation frame loop");
            frameIdRef.current = requestAnimationFrame(processVideo);
        } else {
            cancelAnimationFrame(frameIdRef.current);
            setDetectedGesture("");
        }

        return () => {
            active = false;
            cancelAnimationFrame(frameIdRef.current);
        };
    }, [isEnabled, isModelLoading]);

    return { detectedGesture, confidence, isModelLoading };
}
