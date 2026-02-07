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
    const [detectedGesture] = useState("");
    const [sentenceBuffer, setSentenceBuffer] = useState("");
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

    const { remoteStreams } = useWebRTC({
        roomId: roomId || "",
        socket,
        localStream,
    });

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
            }
        }
    }, [isCamOn, localStream]);

    // Update participants list with local and remote streams
    useEffect(() => {
        const remotePeers = Array.from(remoteStreams.entries()).map(
            ([id, stream]) => ({
                id,
                name: `User ${id.substring(0, 4)}`,
                isLocal: false,
                isMuted: false,
                isVideoOff: false,
                role: "speaker" as const,
                stream,
            }),
        );

        const localParticipant = {
            id: "local",
            name: name || "You",
            isLocal: true,
            isMuted: !isMicOn,
            isVideoOff: !isCamOn,
            role: role as "signer" | "speaker",
            stream: localStream,
        };

        setParticipants([localParticipant, ...remotePeers]);

        console.log("Participants updated:", {
            total: 1 + remotePeers.length,
            local: localParticipant.name,
            remote: remotePeers.map((p) => p.name),
        });
    }, [remoteStreams, name, isMicOn, isCamOn, role, localStream]);

    const handleEndCall = () => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
        }
        navigate("/");
    };

    const handleSend = () => {
        // TODO: Send sentenceBuffer via signaling
        if (sentenceBuffer.trim()) {
            handleSendMessage(sentenceBuffer, "sign-text");
            setSentenceBuffer("");
        }
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
                            className={`px-3 py-1 rounded-full text-sm font-medium ${role === "signer"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-blue-500/10 text-blue-500"
                                }`}
                        >
                            {role === "signer" ? "👋 Signer" : "🎤 Speaker"}{" "}
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

                    {/* Detected Gesture Overlay for Signers */}
                    {role === "signer" && detectedGesture && (
                        <div className="absolute top-4 left-4">
                            <Card className="border-green-500/50 bg-green-500/10 backdrop-blur-sm">
                                <CardContent className="p-4">
                                    <div className="text-sm text-green-500 font-medium mb-1">
                                        Detected Sign
                                    </div>
                                    <div className="text-3xl font-bold text-green-500">
                                        {detectedGesture}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Sentence Buffer for Signers */}
                    {role === "signer" && (
                        <div className="absolute bottom-20 left-4 right-4">
                            <Card className="backdrop-blur-sm bg-card/90">
                                <CardContent className="p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Building sentence...
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={sentenceBuffer}
                                            readOnly
                                            placeholder="Your signs will appear here..."
                                            className="flex-1"
                                        />
                                        <Button
                                            onClick={handleSend}
                                            disabled={!sentenceBuffer.trim()}
                                            size="icon"
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
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
                        {isMicOn ? (
                            <Mic className="h-5 w-5" />
                        ) : (
                            <MicOff className="h-5 w-5" />
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
        </div>
    );
}
