import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    Volume2,
    VolumeX,
    Settings,
    Copy,
    Check,
    MessageSquare,
    X,
    Hand,
    MoreVertical,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ChatPanel from "@/components/ChatPanel";
import VideoGrid from "@/components/VideoGrid";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useSignLanguage } from "@/hooks/useSignLanguage";

export default function Room() {
    const location = useLocation();
    const navigate = useNavigate();
    const { name, roomId, role } = location.state || {};

    // Socket ref to prevent recreation on re-renders and shared state between tabs
    const socketRef = useRef<Socket | null>(null);

    // Initialize socket once
    if (!socketRef.current) {
        socketRef.current = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:4000");
    }

    const socket = socketRef.current;

    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [isTtsOn, setIsTtsOn] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isSignMode, setIsSignMode] = useState(false);
    const [captions, setCaptions] = useState<Record<string, { confirmed: string, forming: string }>>({});
    const [messages, setMessages] = useState<
        Array<{
            id: string;
            sender: string;
            message: string;
            timestamp: Date;
            type: null | "sign-text";
        }>
    >([]);

    const [localStream, setLocalStream] = useState<MediaStream>();
    const [participants, setParticipants] = useState([
        {
            id: "1",
            name: name || "You",
            isLocal: true,
            isMuted: !isMicOn,
            isVideoOff: !isCamOn,
            role: role as "signer" | "speaker",
        },
    ]);

    const { remoteStreams, sendMessage } = useWebRTC({
        roomId: roomId || "",
        socket,
        localStream,
        onMessage: (peerId, message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === "caption") {
                    setCaptions((prev) => ({
                        ...prev,
                        [peerId]: { confirmed: data.confirmed, forming: data.forming },
                    }));

                    // Clear caption after a delay if both are empty (rare) or maybe just keep them until replaced?
                    // YouTube captions differ: they stay for a bit then disappear.
                    // If 'forming' is empty and 'confirmed' is set, it means a sentence just finished.
                    // We can clear it after 5 seconds of no activity.
                    // But managing timers per peer is complex.
                    // Let's just set a timeout to clear *everything* for that peer if no update comes.
                    // Actually, rely on updates. If they start a new sentence, 'confirmed' might still be the old one?
                    // The hook `confirmedSentence` state persists until the *next* confirmation?
                    // No, `setConfirmedSentence` is called on Enter. It stays there.
                    // Ideally `confirmedSentence` should fade out.
                    // Let's implement fade out in UI (VideoGrid) or just keep it simple: showing the last confirmed sentence is good context.

                    // Allow simple clearing
                    setTimeout(() => {
                        setCaptions((prev) => {
                            // Only clear if it hasn't changed
                            if (prev[peerId]?.confirmed === data.confirmed && prev[peerId]?.forming === data.forming) {
                                // If it's old, maybe clear 'confirmed' but keep 'forming'?
                                // If 'forming' hasn't changed in 5s, maybe clear it too?
                                const newCaptions = { ...prev };
                                delete newCaptions[peerId];
                                return newCaptions;
                            }
                            return prev;
                        });
                    }, 5000);
                }
            } catch (e) {
                // Fallback for plain text messages if any (backward compatibility or chat)
                console.log("Received non-JSON message or chat:", message);
            }
        }
    });

    // Sign Language Integration
    const hiddenVideoRef = useRef<HTMLVideoElement>(null);
    const { detectedGesture, confidence, currentSentence, confirmedSentence } = useSignLanguage({
        videoRef: hiddenVideoRef,
        isEnabled: isSignMode && !!localStream,
    });

    // Send captions
    useEffect(() => {
        if (confirmedSentence || currentSentence) {
            const payload = JSON.stringify({
                type: 'caption',
                confirmed: confirmedSentence,
                forming: currentSentence
            });
            sendMessage(payload);

            // Update local display
            setCaptions(prev => ({
                ...prev,
                local: { confirmed: confirmedSentence, forming: currentSentence }
            }));

            // Clear local after delay
            setTimeout(() => {
                setCaptions(prev => {
                    if (prev.local?.confirmed === confirmedSentence && prev.local?.forming === currentSentence) {
                        const newC = { ...prev };
                        delete newC.local;
                        return newC;
                    }
                    return prev;
                });
            }, 5000);
        }
    }, [confirmedSentence, currentSentence, sendMessage]);

    // Redirect if missing required params
    useEffect(() => {
        if (!name || !roomId || !role) {
            navigate("/");
        }
    }, [name, roomId, role, navigate]);

    // Initialize local media stream
    useEffect(() => {
        let stream: MediaStream | null = null;

        const initMediaStream = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                setLocalStream(stream);

                if (hiddenVideoRef.current) {
                    hiddenVideoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error("Error accessing media devices:", error);
            }
        };

        initMediaStream();

        // Cleanup: stop tracks on unmount
        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // Setup socket event listeners
    useEffect(() => {
        const handleConnect = () => {
            console.log("Connected to server:", socket.id);
            setIsConnected(true);
            // Join room after connection is established
            if (roomId) {
                socket.emit("join-room", roomId);
            }
        };

        const handleDisconnect = () => {
            console.log("Disconnected from server");
            setIsConnected(false);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        // If already connected, join room immediately
        if (socket.connected && roomId) {
            handleConnect();
        }

        // Cleanup
        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            if (roomId) {
                socket.emit("leave-room", roomId);
            }
        };
    }, [roomId]);

    // Update local participant when mic/cam state changes
    useEffect(() => {
        // Enable/disable actual audio track
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = isMicOn;
            }
        }
    }, [isMicOn, localStream]);

    // Update video track when camera state changes
    useEffect(() => {
        // Enable/disable actual video track
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = isCamOn;
                console.log(`Video track ${isCamOn ? 'enabled' : 'disabled'}`);
            }
        }
    }, [isCamOn, localStream]);



    // Emit user state update when local mic/cam changes
    useEffect(() => {
        if (socket && roomId) {
            socket.emit("user-state-update", {
                roomId,
                userId: socket.id,
                isMicOn,
                isCamOn,
            });
        }
    }, [isMicOn, isCamOn, roomId]);

    // Handle incoming user state updates
    useEffect(() => {
        const handleUserStateUpdate = ({ userId, isMicOn, isCamOn }: any) => {
            console.log(`User state update: ${userId} mic:${isMicOn} cam:${isCamOn}`);
            setParticipants((prev) =>
                prev.map((p) => {
                    if (p.id === userId) {
                        return { ...p, isMuted: !isMicOn, isVideoOff: !isCamOn };
                    }
                    return p;
                })
            );
        };

        socket.on("user-state-update", handleUserStateUpdate);

        return () => {
            socket.off("user-state-update", handleUserStateUpdate);
        };
    }, []);

    // Update participants list with local and remote streams
    useEffect(() => {
        const remotePeers = Array.from(remoteStreams.entries()).map(
            ([id, stream]) => {
                // Find existing participant state if available to preserve mute/video status
                const existing = participants.find(p => p.id === id);
                return {
                    id,
                    name: `User ${id.substring(0, 4)}`,
                    isLocal: false,
                    isMuted: existing ? existing.isMuted : false, // Default to false if new
                    isVideoOff: existing ? existing.isVideoOff : false, // Default to false if new
                    role: "speaker" as const,
                    stream,
                    caption: captions[id],
                };
            }
        );

        const localParticipant = {
            id: "local",
            name: name || "You",
            isLocal: true,
            isMuted: !isMicOn,
            isVideoOff: !isCamOn,
            role: role as "signer" | "speaker",
            stream: localStream,
            caption: captions["local"],
        };

        setParticipants([localParticipant, ...remotePeers]);

        /* console.log("Participants updated:", {
            total: 1 + remotePeers.length,
            local: localParticipant.name,
            remote: remotePeers.map((p) => p.name),
        }); */
    }, [remoteStreams, name, isMicOn, isCamOn, role, localStream, captions]);

    const handleEndCall = () => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
        }
        navigate("/");
    };



    const handleSendMessage = (
        message: string,
        type: null | "sign-text" = null,
    ) => {
        const newMessage = {
            id: Date.now().toString(),
            sender: name || "You",
            message,
            timestamp: new Date(),
            type,
        };
        setMessages((prev) => [...prev, newMessage]);
        // TODO: Send message via signaling
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                Room:
                            </span>
                            <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                                {roomId}
                            </code>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={copyRoomId}
                                className="h-7 w-7 p-0"
                            >
                                {copied ? (
                                    <Check className="h-3 w-3" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <div
                                className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                            />
                            <span className="text-sm">
                                {isConnected ? "Connected" : "Disconnected"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted">
                            <Users className="h-4 w-4" />
                            <span className="text-sm font-medium">
                                {participants.length}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div
                            className={`px-3 py-1 rounded-full text-sm font-medium ${isSignMode
                                ? "bg-green-500/10 text-green-500"
                                : "bg-blue-500/10 text-blue-500"
                                }`}
                        >
                            {isSignMode ? "👋 Sign" : "🎤 Speaker"}{" "}
                            Mode
                        </div>
                        <Button size="sm" variant="outline">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Video Grid Area */}
                <div className="flex-1 relative bg-muted/20">
                    <VideoGrid
                        participants={participants}
                        localStream={localStream}
                        captions={captions}
                    />

                    {/* Hidden video for KNN processing */}
                    <video
                        ref={hiddenVideoRef}
                        className="absolute top-0 left-0 w-[640px] h-[480px] opacity-0 pointer-events-none -z-10"
                        autoPlay
                        playsInline
                        muted
                    />

                    {/* Waiting State */}
                    {!isConnected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                            <Card className="max-w-md">
                                <CardHeader className="text-center">
                                    <CardTitle>
                                        Waiting for Connection...
                                    </CardTitle>
                                    <CardDescription>
                                        Share room ID{" "}
                                        <code className="px-2 py-1 bg-muted rounded">
                                            {roomId}
                                        </code>{" "}
                                        with your partner
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </div>
                    )}



                </div>

                {/* Chat Panel Sidebar (Toggleable) */}
                {isChatOpen && (
                    <div className="w-80 bg-card border-l flex flex-col relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-10"
                            onClick={() => setIsChatOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        <div className="flex-1 overflow-hidden p-4">
                            <ChatPanel
                                messages={messages}
                                onSendMessage={(msg) =>
                                    handleSendMessage(msg, null)
                                }
                                currentUser={name || "You"}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Control Bar */}
            <div className="border-t bg-card">
                <div className="container mx-auto px-4 py-4 flex justify-center gap-3">
                    <Button
                        size="lg"
                        variant={isMicOn ? "default" : "destructive"}
                        onClick={() => setIsMicOn(!isMicOn)}
                        className="h-12 w-12 rounded-full p-0"
                    >
                        {isSignMode ? (
                            isMicOn ? (
                                <Hand className="h-5 w-5" />
                            ) : (
                                <MicOff className="h-5 w-5" />
                            )
                        ) : (
                            isMicOn ? (
                                <Mic className="h-5 w-5" />
                            ) : (
                                <MicOff className="h-5 w-5" />
                            )
                        )}
                    </Button>
                    <Button
                        size="lg"
                        variant={isCamOn ? "default" : "destructive"}
                        onClick={() => setIsCamOn(!isCamOn)}
                        className="h-12 w-12 rounded-full p-0"
                    >
                        {isCamOn ? (
                            <Video className="h-5 w-5" />
                        ) : (
                            <VideoOff className="h-5 w-5" />
                        )}
                    </Button>
                    <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleEndCall}
                        className="h-12 w-12 rounded-full p-0"
                    >
                        <PhoneOff className="h-5 w-5" />
                    </Button>
                    <div className="relative">
                        <Button
                            size="lg"
                            variant={isOptionsOpen ? "default" : "outline"}
                            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                            className="h-12 w-12 rounded-full p-0"
                        >
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                        {isOptionsOpen && (
                            <>
                                <div
                                    className="fixed inset-0"
                                    onClick={() => setIsOptionsOpen(false)}
                                />
                                <Card className="absolute bottom-full mb-2 py-0 left-1/2 -translate-x-1/2 w-56 shadow-lg z-50">
                                    <CardContent className="p-1">
                                        <button
                                            onClick={() => {
                                                setIsSignMode(!isSignMode);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors text-left"
                                        >
                                            <Hand className="h-5 w-5" />
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">
                                                    Sign Mode
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {isSignMode
                                                        ? "Enabled"
                                                        : "Disabled"}
                                                </div>
                                            </div>
                                            <div
                                                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isSignMode
                                                    ? "bg-primary border-primary"
                                                    : "border-muted-foreground"
                                                    }`}
                                            >
                                                {isSignMode && (
                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                )}
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsTtsOn(!isTtsOn);
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted transition-colors text-left"
                                        >
                                            {isTtsOn ? (
                                                <Volume2 className="h-5 w-5" />
                                            ) : (
                                                <VolumeX className="h-5 w-5" />
                                            )}
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">
                                                    Mute Sound
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {isTtsOn
                                                        ? "Sound On"
                                                        : "Sound Off"}
                                                </div>
                                            </div>
                                            <div
                                                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${!isTtsOn
                                                    ? "bg-primary border-primary"
                                                    : "border-muted-foreground"
                                                    }`}
                                            >
                                                {!isTtsOn && (
                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                )}
                                            </div>
                                        </button>

                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                    <Button
                        size="lg"
                        variant={isChatOpen ? "default" : "outline"}
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className="h-12 w-12 rounded-full p-0"
                    >
                        <MessageSquare className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div >
    );
}
