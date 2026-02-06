import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hand, Mic, Video, Sparkles, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
    const [name, setName] = useState("");
    const [roomId, setRoomId] = useState("");
    const navigate = useNavigate();

    const generateRoomId = () => {
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomId(id);
    };

    const joinAs = (role: "signer" | "speaker") => {
        if (!name.trim()) {
            alert("Please enter your display name");
            return;
        }
        const finalRoomId =
            roomId.trim() ||
            Math.random().toString(36).substring(2, 8).toUpperCase();
        navigate("/room", {
            state: { name: name.trim(), roomId: finalRoomId, role },
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Header */}
            <header className="border-b backdrop-blur-sm bg-background/80">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                            <Sparkles className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <h1 className="text-2xl font-bold">Universal Link</h1>
                    </div>

                </div>
            </header>

            {/* Hero Section */}
            <main className="container mx-auto px-4 py-12 md:py-20">
                <div className="max-w-6xl mx-auto">
                    {/* Hero Text */}
                    <div className="text-center mb-12 space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                            <Zap className="h-4 w-4" />
                            Real-time Sign Language Translation
                        </div>
                        <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
                            Bridge the Gap Between
                            <span className="block text-primary mt-2">
                                Sign Language & Speech
                            </span>
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Connect instantly with P2P video chat featuring
                            AI-powered sign language recognition and real-time
                            translation. Under 200ms latency.
                        </p>
                    </div>

                    {/* Join Room Card */}
                    <Card className="max-w-2xl mb-12 mx-auto border-2 shadow-xl">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">
                                Get Started
                            </CardTitle>
                            <CardDescription>
                                Enter your details and choose your communication
                                mode
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Form Fields */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Display Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Alice"
                                        value={name}
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="room">Room ID</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="room"
                                            placeholder="Leave blank for random"
                                            value={roomId}
                                            onChange={(e) =>
                                                setRoomId(
                                                    e.target.value.toUpperCase(),
                                                )
                                            }
                                            className="h-11"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={generateRoomId}
                                            className="h-11"
                                        >
                                            Generate
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Role Selection */}
                            <div className="space-y-3">
                                <Label className="text-base">
                                    Choose Your Mode
                                </Label>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <Button
                                        size="lg"
                                        className="h-auto py-6 flex-col gap-2 bg-green-600 hover:bg-green-700"
                                        onClick={() => joinAs("signer")}
                                    >
                                        <Hand className="h-8 w-8" />
                                        <div className="space-y-1">
                                            <div className="font-semibold text-lg">
                                                Join as Signer
                                            </div>
                                            <div className="text-xs opacity-90">
                                                I use Sign Language
                                            </div>
                                        </div>
                                    </Button>
                                    <Button
                                        size="lg"
                                        className="h-auto py-6 flex-col gap-2 bg-blue-600 hover:bg-blue-700"
                                        onClick={() => joinAs("speaker")}
                                    >
                                        <Mic className="h-8 w-8" />
                                        <div className="space-y-1">
                                            <div className="font-semibold text-lg">
                                                Join as Speaker
                                            </div>
                                            <div className="text-xs opacity-90">
                                                I use Speech
                                            </div>
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Features */}
                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        <Card className="border-2">
                            <CardHeader>
                                <Video className="h-10 w-10 text-primary mb-2" />
                                <CardTitle>WebRTC Video</CardTitle>
                                <CardDescription>
                                    Low-latency peer-to-peer video communication
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="border-2">
                            <CardHeader>
                                <Hand className="h-10 w-10 text-primary mb-2" />
                                <CardTitle>Hand Tracking</CardTitle>
                                <CardDescription>
                                    Real-time sign language detection with
                                    MediaPipe
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="border-2">
                            <CardHeader>
                                <Shield className="h-10 w-10 text-primary mb-2" />
                                <CardTitle>Private & Secure</CardTitle>
                                <CardDescription>
                                    End-to-end encryption with direct P2P
                                    connections
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>



                    
                </div>
            </main>
        </div>
    );
}
