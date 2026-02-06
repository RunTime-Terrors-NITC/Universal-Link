import { useState } from "react";
import { Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Message {
    id: string;
    sender: string;
    message: string;
    timestamp: Date;
    type: "text" | "sign" | "speech";
}

interface ChatPanelProps {
    messages: Message[];
    onSendMessage: (message: string) => void;
    currentUser: string;
}

export default function ChatPanel({
    messages,
    onSendMessage,
    currentUser,
}: ChatPanelProps) {
    const [newMessage, setNewMessage] = useState("");

    const handleSend = () => {
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage("");
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const getMessageTypeColor = (type: string) => {
        switch (type) {
            case "sign":
                return "bg-green-500/10 text-green-500 border-green-500/20";
            case "speech":
                return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            default:
                return "bg-muted text-muted-foreground";
        }
    };

    const getMessageTypeLabel = (type: string) => {
        switch (type) {
            case "sign":
                return "👋 Sign";
            case "speech":
                return "🎤 Speech";
            default:
                return "Text";
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                    Chat History
                    <Badge variant="secondary" className="text-xs">
                        {messages.length} messages
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3 p-0">
                {/* Messages Area */}
                <ScrollArea className="flex-1 px-4">
                    <div className="space-y-4 pr-4">
                        {messages.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-8">
                                No messages yet. Start the conversation!
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isCurrentUser =
                                    msg.sender === currentUser;
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex gap-3 ${isCurrentUser ? "flex-row-reverse" : "flex-row"}`}
                                    >
                                        <Avatar className="h-8 w-8 mt-1">
                                            <AvatarFallback className="text-xs">
                                                {getInitials(msg.sender)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div
                                            className={`flex-1 space-y-1 ${isCurrentUser ? "items-end" : "items-start"} flex flex-col`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium">
                                                    {msg.sender}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs ${getMessageTypeColor(msg.type)}`}
                                                >
                                                    {getMessageTypeLabel(
                                                        msg.type,
                                                    )}
                                                </Badge>
                                            </div>
                                            <div
                                                className={`rounded-lg px-3 py-2 max-w-[80%] ${
                                                    isCurrentUser
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted"
                                                }`}
                                            >
                                                <p className="text-sm">
                                                    {msg.message}
                                                </p>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {msg.timestamp.toLocaleTimeString(
                                                    [],
                                                    {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    },
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="px-4 pb-4 space-y-2">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            size="icon"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
