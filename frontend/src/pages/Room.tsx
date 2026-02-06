import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
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

export default function Room() {
    const location = useLocation();
    const navigate = useNavigate();
    const { name, roomId, role } = location.state || {};

    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [isTtsOn, setIsTtsOn] = useState(true);
    const [isConnected] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [detectedGesture] = useState("");
    const [sentenceBuffer, setSentenceBuffer] = useState("");
    const [messages, setMessages] = useState<
        Array<{
            id: string;
            sender: string;
            message: string;
            timestamp: Date;
            type: "text" | "sign" | "speech";
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
        // Add remote participants here when they connect
    ]);

    useEffect(() => {
        // if (!name || !roomId || !role) {
        //     navigate("/");
        // }

        // Initialize local media stream
        const initMediaStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                setLocalStream(stream);
            } catch (error) {
                console.error("Error accessing media devices:", error);
            }
        };

        initMediaStream();

        // Cleanup
        return () => {
            if (localStream) {
                localStream
                    .getTracks()
                    .forEach((track: MediaStreamTrack) => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        // Update participants state when mic/cam state changes
        setParticipants((prev) =>
            prev.map((p) =>
                p.isLocal
                    ? { ...p, isMuted: !isMicOn, isVideoOff: !isCamOn }
                    : p,
            ),
        );
    }, [isMicOn, isCamOn]);

    const handleEndCall = () => {
        // TODO: Clean up WebRTC connections
        if (localStream) {
            localStream
                .getTracks()
                .forEach((track: MediaStreamTrack) => track.stop());
        }
        navigate("/");
    };

    const handleSend = () => {
        // TODO: Send sentenceBuffer via signaling
        if (sentenceBuffer.trim()) {
            handleSendMessage(sentenceBuffer, "sign");
            setSentenceBuffer("");
        }
    };

    const handleSendMessage = (
        message: string,
        type: "text" | "sign" | "speech" = "text",
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
        <div className="min-h-screen bg-background flex flex-col">
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
                    </div>
                    <div className="flex items-center gap-3">
                        <div
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                                role === "signer"
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
                                    handleSendMessage(msg, "text")
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
                    <Button
                        size="lg"
                        variant={isTtsOn ? "default" : "outline"}
                        onClick={() => setIsTtsOn(!isTtsOn)}
                        className="h-12 w-12 rounded-full p-0"
                    >
                        {isTtsOn ? (
                            <Volume2 className="h-5 w-5" />
                        ) : (
                            <VolumeX className="h-5 w-5" />
                        )}
                    </Button>
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
