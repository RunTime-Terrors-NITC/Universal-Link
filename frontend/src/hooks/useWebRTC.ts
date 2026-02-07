import { useRef, useState, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
    ],
};

interface Peer {
    id: string;
    connection: RTCPeerConnection;
    stream?: MediaStream;
}

interface UseWebRTCProps {
    roomId: string;
    socket: Socket;
    localStream: MediaStream | undefined;
}

export function useWebRTC({ roomId, socket, localStream }: UseWebRTCProps) {
    const peersRef = useRef<Map<string,Peer>>(new Map());
    // store all peer connection in a ref;

    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

    const createPeerConnection = useCallback((peerId:string):RTCPeerConnection=>{
        console.log(`Creating peer connection for ${peerId}`);

        const peerConnection = new RTCPeerConnection(ICE_SERVERS)

        if(localStream){
            localStream.getTracks().forEach((track)=>{
                peerConnection.addTrack(track,localStream)
                console.log(`Added ${track.kind} track to peer ${peerId}`);
            })
        }
    })
 
}
