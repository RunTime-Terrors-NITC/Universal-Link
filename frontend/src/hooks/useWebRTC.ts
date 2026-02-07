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
    dataChannel?: RTCDataChannel;
}

interface UseWebRTCProps {
    roomId: string;
    socket: Socket;
    localStream: MediaStream | undefined;
    onMessage?: (peerId: string, message: string) => void;
}

export function useWebRTC({ roomId, socket, localStream, onMessage }: UseWebRTCProps) {
    const peersRef = useRef<Map<string, Peer>>(new Map());
    // store all peer connection in a ref;

    // Queue of peer IDs that joined before localStream was ready
    const pendingPeersRef = useRef<Set<string>>(new Set());

    const [remoteStreams, setRemoteStreams] = useState<
        Map<string, MediaStream>
    >(new Map());

    const setupDataChannel = useCallback((channel: RTCDataChannel, peerId: string) => {
        channel.onopen = () => {
            console.log(`Data channel "${channel.label}" open with ${peerId}`);
            const peer = peersRef.current.get(peerId);
            if (peer) {
                peer.dataChannel = channel;
            }
        };

        channel.onmessage = (event) => {
            console.log(`Received message from ${peerId}:`, event.data);
            if (onMessage) {
                onMessage(peerId, event.data);
            }
        };

        // Store the data channel immediately as well
        const peer = peersRef.current.get(peerId);
        if (peer) {
            peer.dataChannel = channel;
        }
    }, [onMessage]);

    const createPeerConnection = useCallback(
        (peerId: string): RTCPeerConnection => {
            console.log(`Creating peer connection for ${peerId}`);

            const peerConnection = new RTCPeerConnection(ICE_SERVERS);

            if (localStream) {
                localStream.getTracks().forEach((track) => {
                    peerConnection.addTrack(track, localStream);
                    console.log(`Added ${track.kind} track to peer ${peerId}`);
                });
            }

            // Handle incoming data channels
            peerConnection.ondatachannel = (event) => {
                const dataChannel = event.channel;
                console.log(`Received data channel "${dataChannel.label}" from ${peerId}`);
                setupDataChannel(dataChannel, peerId);
            };

            // Handle incoming tracks from remote peer (receive their audio/video)
            peerConnection.ontrack = (event) => {
                console.log(
                    `Received ${event.track.kind} track from ${peerId}`,
                );
                const [remoteStream] = event.streams;

                if (remoteStream) {
                    setRemoteStreams((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(peerId, remoteStream);
                        return newMap;
                    });

                    // Update the peer's stream
                    const peer = peersRef.current.get(peerId);
                    if (peer) {
                        peer.stream = remoteStream;
                    }
                }
            };

            // Handle ICE candidates (network path discovery)
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log(`Sending ICE candidate to ${peerId}`);
                    socket.emit("ice-candidate", {
                        candidate: event.candidate,
                        to: peerId,
                    });
                }
            };

            // Monitor connection state
            peerConnection.onconnectionstatechange = () => {
                console.log(
                    `Connection state with ${peerId}: ${peerConnection.connectionState}`,
                );

                if (
                    peerConnection.connectionState === "disconnected" ||
                    peerConnection.connectionState === "failed"
                ) {
                    removePeer(peerId);
                }
            };

            // Store the peer connection
            peersRef.current.set(peerId, {
                id: peerId,
                connection: peerConnection,
            });

            return peerConnection;
        },
        [localStream, socket, setupDataChannel],
    );


    const createOffer = useCallback(
        async (peerId: string) => {
            try {
                const peerConnection = createPeerConnection(peerId);

                // Create data channel
                const dataChannel = peerConnection.createDataChannel("captions");
                setupDataChannel(dataChannel, peerId);

                const peer = peersRef.current.get(peerId);
                if (peer) {
                    peer.dataChannel = dataChannel;
                }

                // Store data channel in peer map (we need to update the interface first)
                // For now, let's update Peer interface at the top of the file

                // Create an offer (SDP - Session Description Protocol)
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                console.log(`Sending offer to ${peerId}`);
                console.log(offer);
                socket.emit("offer", {
                    offer,
                    to: peerId,
                    room: roomId,
                });
            } catch (error) {
                console.error(`Error creating offer for ${peerId}:`, error);
            }
        },
        [createPeerConnection, socket],
    );

    const handleOffer = useCallback(
        async (offer: RTCSessionDescriptionInit, from: string) => {
            try {
                console.log(`Received offer from ${from}`);
                const peerConnection = createPeerConnection(from);

                // Set remote offer
                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription(offer),
                );

                // Create answer
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                console.log(answer);
                console.log(" offer : ", offer);

                console.log(`Sending answer to ${from}`);
                socket.emit("answer", {
                    answer,
                    to: from,
                    room: roomId,
                });
            } catch (error) {
                console.error(`Error handling offer from ${from}:`, error);
            }
        },
        [createPeerConnection, socket],
    );

    const handleAnswer = useCallback(
        async (answer: RTCSessionDescriptionInit, from: string) => {
            try {
                console.log(`Received answer from ${from}`);
                const peer = peersRef.current.get(from);

                console.log(answer);

                if (peer) {
                    await peer.connection.setRemoteDescription(
                        new RTCSessionDescription(answer),
                    );
                }
            } catch (error) {
                console.error(`Error handling answer from ${from}:`, error);
            }
        },
        [],
    );

    const handleIceCandidate = useCallback(
        async (candidate: RTCIceCandidateInit, from: string) => {
            try {
                const peer = peersRef.current.get(from);

                if (peer && peer.connection.remoteDescription) {
                    await peer.connection.addIceCandidate(
                        new RTCIceCandidate(candidate),
                    );
                    console.log(`Added ICE candidate from ${from}`);
                }
            } catch (error) {
                console.error(
                    `Error adding ICE candidate from ${from}:`,
                    error,
                );
            }
        },
        [],
    );

    const removePeer = useCallback((peerId: string) => {
        console.log(`Removing peer ${peerId}`);
        const peer = peersRef.current.get(peerId);

        if (peer) {
            peer.connection.close();
            peersRef.current.delete(peerId);

            setRemoteStreams((prev) => {
                const newMap = new Map(prev);
                newMap.delete(peerId);
                return newMap;
            });
        }
    }, []);

    const handleUserJoined = useCallback(
        (userId: string) => {
            console.log(`User ${userId} joined the room`);
            // If localStream isn't ready yet, queue this peer
            if (!localStream) {
                console.log(`Queueing ${userId} - localStream not ready`);
                pendingPeersRef.current.add(userId);
                return;
            }
            // As the existing user, create an offer for the new user
            createOffer(userId);
        },
        [createOffer, localStream],
    );

    const handleUserLeft = useCallback(
        (userId: string) => {
            console.log(`User ${userId} left the room`);
            removePeer(userId);
        },
        [removePeer],
    );

    useEffect(() => {
        if (!socket || !roomId) return;

        // Listen for signaling events
        socket.on("offer", ({ offer, from }) => handleOffer(offer, from));
        socket.on("answer", ({ answer, from }) => handleAnswer(answer, from));
        socket.on("ice-candidate", ({ candidate, from }) =>
            handleIceCandidate(candidate, from),
        );
        socket.on("user-joined", ({ userId }) => handleUserJoined(userId));
        socket.on("user-left", ({ userId }) => handleUserLeft(userId));

        // Cleanup listeners on unmount
        return () => {
            socket.off("offer");
            socket.off("answer");
            socket.off("ice-candidate");
            socket.off("user-joined");
            socket.off("user-left");
        };
    }, [
        socket,
        roomId,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        handleUserJoined,
        handleUserLeft,
    ]);

    // Process pending peers and update existing connections when localStream becomes available
    useEffect(() => {
        if (!localStream) return;

        // Process any pending peers that joined before localStream was ready
        pendingPeersRef.current.forEach((userId) => {
            console.log(`Processing pending peer ${userId}`);
            createOffer(userId);
        });
        pendingPeersRef.current.clear();

        // Add tracks to any existing peer connections that don't have them
        peersRef.current.forEach((peer) => {
            const senders = peer.connection.getSenders();
            const hasAudio = senders.some((s) => s.track?.kind === "audio");
            const hasVideo = senders.some((s) => s.track?.kind === "video");

            localStream.getTracks().forEach((track) => {
                if (track.kind === "audio" && !hasAudio) {
                    peer.connection.addTrack(track, localStream);
                    console.log(
                        `Added audio track to existing peer ${peer.id}`,
                    );
                }
                if (track.kind === "video" && !hasVideo) {
                    peer.connection.addTrack(track, localStream);
                    console.log(
                        `Added video track to existing peer ${peer.id}`,
                    );
                }
            });
        });
    }, [localStream, createOffer]);

    useEffect(() => {
        return () => {
            peersRef.current.forEach((peer) => {
                peer.connection.close();
            });
            peersRef.current.clear();
        };
    }, []);

    const sendMessage = useCallback((message: string) => {
        peersRef.current.forEach((peer) => {
            if (peer.dataChannel && peer.dataChannel.readyState === "open") {
                peer.dataChannel.send(message);
            }
        });
    }, []);

    // Update setupDataChannel to store the channel
    // We need to move setupDataChannel definition or use a ref if we want to update the peer map inside it properly without stale closures? 
    // Actually peersRef is a ref, so it's fine.

    // Let's refine setupDataChannel to store the channel in the peer object
    // I already added the logic in the replacement above but let's make sure it's correct.
    // The previous replacement for setupDataChannel didn't explicitly store it in the peer object. 
    // I will add another replacement to fix that.

    return {
        remoteStreams,
        createOffer, // Manually create offer if needed
        removePeer, // Manually remove peer if needed
        sendMessage,
    };
}
