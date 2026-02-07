import { useState, useEffect, useRef } from "react";

// Helper for browser compatibility
const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

interface UseSpeechRecognitionProps {
    isEnabled: boolean;
    onResult?: (transcript: string, isFinal: boolean) => void;
}

export default function useSpeechRecognition({ isEnabled, onResult }: UseSpeechRecognitionProps) {
    const [currentTranscript, setCurrentTranscript] = useState("");
    const [finalTranscript, setFinalTranscript] = useState("");
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (!isEnabled || !SpeechRecognition) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US"; // Default to English, maybe make configurable later

        recognition.onresult = (event: any) => {
            let interim = "";
            let final = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }

            if (final) {
                setFinalTranscript(prev => {
                    const newVal = prev + " " + final;
                    return newVal.trim();
                });

                // If we possess a callback, we can trigger it with the chunk
                if (onResult) {
                    onResult(final.trim(), true);
                }
            }

            if (interim) {
                setCurrentTranscript(interim);
                if (onResult) {
                    onResult(interim, false);
                }
            } else {
                setCurrentTranscript("");
                if (onResult) {
                    onResult("", false); // Clear forming
                }
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            // Optionally restart or handle error
        };

        recognition.onend = () => {
            // If enabled, restart?
            if (isEnabled && recognitionRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    // ignore
                }
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (e) { console.log("Error starting recognition", e); }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
        };
    }, [isEnabled]); // onResult should be stable or ref

    return {
        currentTranscript,
        finalTranscript,
        isSupported: !!SpeechRecognition
    };
}
