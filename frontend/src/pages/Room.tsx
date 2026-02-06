import { useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
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

export default function Room() {
    const location = useLocation();
    const navigate = useNavigate();
    const { name, roomId, role } = location.state || {};

    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [isTtsOn, setIsTtsOn] = useState(true);
    const [isConnected] = useState(false);
    const [copied, setCopied] = useState(false);
    const [liveTranscript] = useState("");
    const [detectedGesture] = useState("");
    const [sentenceBuffer, setSentenceBuffer] = useState("");

    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!name || !roomId || !role) {
            navigate("/");
        }
    }, [name, roomId, role, navigate]);

    const handleEndCall = () => {
        // TODO: Clean up WebRTC connections
        navigate("/");
    };

    const handleSend = () => {
        // TODO: Send sentenceBuffer via signaling
        setSentenceBuffer("");
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
            <div className="flex-1 flex overflow-hidden">
                {/* Video Area */}
                <div className="flex-1 relative bg-muted/20">
                    {/* Remote Video */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        className="w-full h-full object-cover"
                    />

                    {/* Local Video PIP */}
                    <Card className="absolute top-4 right-4 w-48 h-36 overflow-hidden border-2">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                        />
                    </Card>

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

                {/* Communication Panel */}
                <div className="w-80 bg-card border-l flex flex-col">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Live Transcript */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">
                                    Live Transcript
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-muted/50 rounded-lg p-3 min-h-25 max-h-37.5 overflow-y-auto text-sm">
                                    {liveTranscript || (
                                        <span className="text-muted-foreground">
                                            Waiting for speech...
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Detected Gesture */}
                        {role === "signer" && (
                            <Card className="border-green-500/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">
                                        Detected Gesture
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-green-500/10 rounded-lg p-4 text-center">
                                        <div className="text-3xl font-bold text-green-500">
                                            {detectedGesture || "..."}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Sentence Buffer */}
                        {role === "signer" && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">
                                        Sentence Buffer
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Input
                                        value={sentenceBuffer}
                                        readOnly
                                        placeholder="Your signs will appear here..."
                                        className="resize-none"
                                    />
                                    <Button
                                        onClick={handleSend}
                                        className="w-full"
                                        disabled={!sentenceBuffer.trim()}
                                    >
                                        Send Message
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
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
                </div>
            </div>
        </div>
    );
}
