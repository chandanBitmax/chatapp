// src/hooks/useWebRTC.js

import { useEffect, useRef, useState } from "react";
import { getSocket } from "./socket";

export default function useWebRTC(roomId, { audio , video  } = {}) {
  const [remoteStream, setRemoteStream] = useState(null);
  const localMediaRef = useRef(null);   // <video> or <audio>
  const remoteMediaRef = useRef(null);  // <video> or <audio>
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const socket = getSocket();


  /** Create RTCPeerConnection and attach media */
  const createPeerConnection = async () => {

     console.log("createPeerConnection with:", { audio, video });

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    
    const localStream = await navigator.mediaDevices.getUserMedia({ audio, video });
    localStreamRef.current = localStream;

    console.log("✅ Created local stream", localStream);

    tryAttachLocalStream();

    // attach to local media element
    if (localMediaRef.current) {
      localMediaRef.current.srcObject = localStream;
      console.log("✅ Attached local stream", { audio, video });
    }else{
      console.error("❌ localMediaRef is null");
    }

    // const peer = new RTCPeerConnection({
    //   iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    // });
    
    // add local tracks
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

    // handle remote tracks
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      console.log("📡 Remote track received", event.streams);
      setRemoteStream(stream);
            console.log("✅ Remote stream set in state:", remoteStream)

    };

    // send ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && roomId) {
        socket.emit("webrtc:ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };
  peerRef.current = peer;
    return peer;
  };

  //  /** Attach remote stream when ref becomes available */
  // useEffect(() => {
  //   if (remoteStream && remoteVideoRef.current) {
  //     remoteVideoRef.current.srcObject = remoteStream;
  //     console.log("✅ Attached remoteStream to remoteVideoRef");
  //   }
  // }, [remoteStream, remoteVideoRef.current]);

  /** Caller: start a call (create offer) */
  const startCall = async () => {

   const res= await createPeerConnection(); 
    console.log("createPeerConnection result:", res);

    const peer = peerRef.current;
    if (!peer) return console.error("❌ PeerConnection not initialized");

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("webrtc:offer", { roomId, sdp: offer });
  };

  /** Callee: accept call and send answer */
  const acceptCall = async (offer) => {
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

 // replace tryAttachLocalStream
const tryAttachLocalStream = () => {
  const interval = setInterval(() => {
    if (localMediaRef.current && localStreamRef.current) {
      if (!localMediaRef.current.srcObject) {
        localMediaRef.current.srcObject = localStreamRef.current;
        console.log("✅ Attached local stream (retry)");
      }
      clearInterval(interval);
    }
  }, 100);

  setTimeout(() => clearInterval(interval), 5000);
};


  useEffect(() => {
  if (remoteStream && remoteMediaRef.current) {
    remoteMediaRef.current.srcObject = remoteStream;

    remoteMediaRef.current
      .play()
      .then(() => console.log("✅ Remote stream playing"))
      .catch((err) => {
        console.warn("⚠️ Autoplay blocked, waiting for user gesture", err);
      });
  }
}, [remoteStream]);


  /** Signaling listeners */
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ sdp }) => {
      console.log("📡 Got offer via socket → running acceptCall()");
      await acceptCall(sdp);
    };

    const handleAnswer = async ({ sdp }) => {
      const peer = peerRef.current;
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
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

  /** Cleanup on unmount */
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
    if (localMediaRef.current) {
      localMediaRef.current.srcObject = null;
    }
    if (remoteMediaRef.current) {
      remoteMediaRef.current.srcObject = null;
    }
    setRemoteStream(new MediaStream());

    if (roomId) {
      socket.emit("call:end", { roomId });
    }
  };

  return {
    localMediaRef,
    remoteMediaRef,
    remoteStream,
    startCall,
    acceptCall,
    endCall,
    peerRef, // useful for screen sharing / track replacement
  };
}
