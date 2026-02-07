import { useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Participant {
    id: string;
    name: string;
    stream?: MediaStream;
    isMuted?: boolean;
    isVideoOff?: boolean;
    isLocal?: boolean;
    role?: "signer" | "speaker";
    caption?: string;
}

interface VideoGridProps {
    participants: Participant[];
    localStream?: MediaStream;
}

export default function VideoGrid({
    participants,
    localStream,
}: VideoGridProps) {
    const getGridLayout = (count: number) => {
        if (count === 1) return "grid-cols-1";
        if (count === 2) return "grid-cols-1 md:grid-cols-2";
        if (count <= 4) return "grid-cols-2";
        if (count <= 6) return "grid-cols-2 md:grid-cols-3";
        return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    };

    return (
        <div
            className={`grid gap-4 h-full p-4 ${getGridLayout(participants.length)}`}
            style={{ gridAutoRows: "minmax(0, 1fr)" }}
        >
            {participants.map((participant) => (
                <VideoTile
                    key={participant.id}
                    participant={participant}
                    localStream={participant.isLocal ? localStream : undefined}
                />
            ))}
        </div>
    );
}

interface VideoTileProps {
    participant: Participant;
    localStream?: MediaStream;
}

function VideoTile({ participant, localStream }: VideoTileProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!videoRef.current) return;

        // Use participant.stream if available, otherwise use localStream for local participant
        const streamToUse =
            participant.stream || (participant.isLocal ? localStream : null);

        if (streamToUse) {
            videoRef.current.srcObject = streamToUse;
        }
    }, [participant.stream, participant.isLocal, localStream]);

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };



    return (
        <Card className="relative py-0 overflow-hidden bg-muted/20 h-full group">
            {/* Video Element - Always rendered but hidden when needed */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={participant.isLocal}
                className={`w-full h-full object-cover ${participant.isLocal ? "scale-x-[-1]" : ""} ${participant.isVideoOff ? "hidden" : ""}`}
            />

            {/* Placeholder when video is off */}
            {participant.isVideoOff && (
                <div className="w-full h-full flex items-center justify-center bg-muted/40">
                    <Avatar className="h-20 w-20">
                        <AvatarFallback className="text-2xl">
                            {getInitials(participant.name)}
                        </AvatarFallback>
                    </Avatar>
                </div>
            )}

            {/* Overlay Info */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Top Bar */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                    <Badge
                        variant="secondary"
                        className="bg-background/80 backdrop-blur-sm"
                    >
                        {participant.name}
                        {participant.isLocal && " (You)"}
                    </Badge>
                    {participant.role && (
                        <Badge
                            className={`${participant.role === "signer"
                                ? "bg-green-500/80 hover:bg-green-500"
                                : "bg-blue-500/80 hover:bg-blue-500"
                                } backdrop-blur-sm`}
                        >
                            {participant.role === "signer" ? "👋" : "🎤"}
                        </Badge>
                    )}
                </div>

                {/* Bottom Status Icons */}
                <div className="absolute bottom-2 right-2 flex gap-2">
                    {participant.isMuted && (
                        <div className="p-2 rounded-full bg-red-500/80 backdrop-blur-sm">
                            <MicOff className="h-3 w-3 text-white" />
                        </div>
                    )}
                    {participant.isVideoOff && (
                        <div className="p-2 rounded-full bg-red-500/80 backdrop-blur-sm">
                            <VideoOff className="h-3 w-3 text-white" />
                        </div>
                    )}
                    {!participant.isMuted && (
                        <div className="p-2 rounded-full bg-green-500/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <Mic className="h-3 w-3 text-white" />
                        </div>
                    )}
                    {!participant.isVideoOff && (
                        <div className="p-2 rounded-full bg-green-500/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <VideoIcon className="h-3 w-3 text-white" />
                        </div>
                    )}
                </div>
            </div>

            {/* Hand Tracking Overlay for Signers */}
            {participant.role === "signer" && !participant.isVideoOff && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <canvas
                        id={`hand-canvas-${participant.id}`}
                        className="opacity-0 group-hover:opacity-60 transition-opacity"
                    />
                </div>
            )}

            {/* Caption Overlay */}
            {participant.caption && (
                <div className="absolute bottom-16 left-4 right-4 text-center pointer-events-none">
                    <span className="inline-block px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-white text-lg font-medium shadow-sm border border-white/10">
                        {participant.caption}
                    </span>
                </div>
            )}
        </Card>
    );
}
