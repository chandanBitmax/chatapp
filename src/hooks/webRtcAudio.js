// src/hooks/useWebRTC.js
import { useEffect, useRef, useState } from "react";
import { getSocket } from "./socket";

export default function useWebRTCAudio(roomId) {
  const [remoteStream, setRemoteStream] = useState(null);
  const localAudioRef = useRef(null);   
  const remoteAudioRef = useRef(null);  
  const peerRef = useRef(null);    
  const localStreamRef = useRef(null);  
  const socket = getSocket();

  /** Create RTCPeerConnection and attach media */
  const createPeerConnection = async () => {
    // grab camera + mic
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });

    localStreamRef.current = localStream;

    tryAttachLocalStream();

    // attach to local <video>
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
      console.log("✅ Attached localStream to localAudioRef", localStream);
    }else{
      console.error("❌ localAudioRef is null");
    }

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = peer;

    // add local tracks
    localStream.getTracks().forEach((track) =>
      peer.addTrack(track, localStream)
    );

    // handle remote tracks
    peer.ontrack = (event) => {
      const [stream] = event.streams;
       console.log("📡 Remote track received", event.streams);
      setRemoteStream(stream);
      console.log("✅ Remote stream set in state:", remoteStream)

      // if (remoteAudioRef.current) {
      //   remoteAudioRef.current.srcObject = stream;
      // }else {
      //   console.warn("⚠️ remoteAudioRef is null when receiving track",remoteAudioRef);
      // }
    };

    // send ICE candidates to signaling server
    peer.onicecandidate = (event) => {
      if (event.candidate && roomId) {
        socket.emit("webrtc:ice-candidate", { roomId, candidate: event.candidate });
      }
    };

    return peer;
  };

  /** Attach remote stream when ref becomes available */
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      console.log("✅ Attached remoteStream to remoteAudioRef");
    }
  }, [remoteStream, remoteAudioRef.current]);

  /** Caller: start a call, create offer */
  const startAudioCall = async () => {
    await createPeerConnection();
    const peer = peerRef.current;
    if (!peer) return console.error("❌ PeerConnection not initialized");

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("webrtc:offer", { roomId, sdp: offer });
  };

  /** Callee: accept offer and send answer */
  const acceptAudioCall = async (offer) => {
    if (!offer) {
      console.error("❌ acceptCall called with null offer");
      return;
    }
    await createPeerConnection();
    const peer = peerRef.current;
     if (!peer) return console.error("❌ PeerConnection not initialized");
    console.log("✅ acceptCall attaching local stream:", localStreamRef.current);
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("webrtc:answer", { roomId, sdp: answer });
  };

  /** Attach local stream to video tag (with retry) */
  const tryAttachLocalStream = () => {
    const interval = setInterval(() => {
      if (localAudioRef.current && localStreamRef.current) {
        if (!localAudioRef.current.srcObject) {
          localAudioRef.current.srcObject = localStreamRef.current;
          console.log("✅ Attached local stream to local video element (retry)");
        }
        clearInterval(interval);
      }
    }, 100);

    // Timeout after 5s
    setTimeout(() => clearInterval(interval), 5000);
  };

  //   /** Attach remote stream if it changes */
  // useEffect(() => {
  //   if (remoteAudioRef.current && remoteStream) {
  //     remoteAudioRef.current.srcObject = remoteStream;
  //     console.log("✅ Remote stream attached to remoteAudioRef", remoteStream);
  //   } else {
  //     console.warn("⚠️ remoteAudioRef is null or remoteStream is not yet available");
  //   }
  // }, [remoteStream]);  // This will run whenever remoteStream is updated

  /** Listen for signaling */
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ sdp }) => {
      console.log("📡 Got offer via socket → running acceptCall()");
      await acceptCall(sdp);
    };

    const handleAnswer = async ({ sdp }) => {
      const peer = peerRef.current;
      if (peer) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleCandidate = async ({ candidate }) => {
      try {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    };


   socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleCandidate);

    return () => {
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleCandidate);
    };
  }, [socket, roomId]);

    /** Cleanup when component unmounts */
  useEffect(() => {
    return () => {
      endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


/** End call and cleanup */
  const endCall = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setRemoteStream(new MediaStream());

    if (roomId) {
      socket.emit("call:end", { roomId });
    }
  };

  return {
    localAudioRef,
    remoteAudioRef,
    remoteStream,
    startAudioCall,
    acceptAudioCall,
    endCall,
  };
}
