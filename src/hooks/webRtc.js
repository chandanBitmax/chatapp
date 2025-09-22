// src/hooks/useWebRTC.js
import { useEffect, useRef, useState } from "react";
import { getSocket } from "./socket";

export default function useWebRTC(roomId, {audio, video}={}) {
  const [remoteStream, setRemoteStream] = useState(null);
  const localVideoRef = useRef(null);   
  const remoteVideoRef = useRef(null);  
  const peerRef = useRef(null);    
  const localStreamRef = useRef(null);  
  
  const socket = getSocket();
  

  if (!audio && !video) {
  throw new Error("At least one of audio or video must be requested in getUserMedia");
}

  /** Create RTCPeerConnection and attach media */
  const createPeerConnection = async (audio, video) => {
     if (!audio && !video) {
    throw new Error("❌ createPeerConnection: Must request at least audio or video");
  }
    // grab camera + mic
    const localStream = await navigator.mediaDevices.getUserMedia({
      video,
      audio
    });

   console.log("✅ Obtained local media stream", localStream);

    localStreamRef.current = localStream;

    tryAttachLocalStream();

    // attach to local <video>
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      console.log("✅ Attached localStream to localVideoRef", localStream);
    }else{
      console.error("❌ localVideoRef is null");
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

      // if (remoteVideoRef.current) {
      //   remoteVideoRef.current.srcObject = stream;
      // }else {
      //   console.warn("⚠️ remoteVideoRef is null when receiving track",remoteVideoRef);
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
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log("✅ Attached remoteStream to remoteVideoRef");
    }
  }, [remoteStream, remoteVideoRef.current]);

  /** Caller: start a call, create offer */
  const startCall = async () => {
    await createPeerConnection(audio, video);
    const peer = peerRef.current;
    if (!peer) return console.error("❌ PeerConnection not initialized");

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("webrtc:offer", { roomId, sdp: offer });
  };

  /** Callee: accept offer and send answer */
  const acceptCall = async (offer) => {
    if (!offer) {
      console.error("❌ acceptCall called with null offer");
      return;
    }
    await createPeerConnection(audio, video);
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
      if (localVideoRef.current && localStreamRef.current) {
        if (!localVideoRef.current.srcObject) {
          localVideoRef.current.srcObject = localStreamRef.current;
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
  //   if (remoteVideoRef.current && remoteStream) {
  //     remoteVideoRef.current.srcObject = remoteStream;
  //     console.log("✅ Remote stream attached to remoteVideoRef", remoteStream);
  //   } else {
  //     console.warn("⚠️ remoteVideoRef is null or remoteStream is not yet available");
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

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemoteStream(new MediaStream());

    if (roomId) {
      socket.emit("call:end", { roomId });
    }
  };

  return {
    localVideoRef,
    remoteVideoRef,
    remoteStream,
    startCall,
    acceptCall,
    endCall,
  };
}
