import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  IconButton,
  Box,
  Typography
} from "@mui/material";
import { Chat } from "@mui/icons-material";
import SpeedDial from "@mui/material/SpeedDial";
import { CallEnd, Close } from "@mui/icons-material";
import { jwtDecode } from "jwt-decode";
import ChatBot from "../customer/customerChat/ChatBot";
import { getSocket } from "../../../hooks/socket";
import useWebRTC from "../../../hooks/webRtc";
import VideoCallModal from "../../../components/call/VideoCallModal";
import AudioCallModal from "../../../components/call/AudioCallModal";
export default function CustomerVideoCall({ currentUserId }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAudioCall, setIsAudioCall] = useState(false);
  const [muted, setMuted] = useState(false);  
  const [videoOff, setVideoOff] = useState(false);
  const socket = getSocket();
  const [showChat, setShowChat] = useState(false);
  const token = localStorage.getItem("token");
  const decoded = token ? jwtDecode(token) : null;
  const customerUserId = decoded?.id;

  // ✅ include acceptCall from hook
  const {
    localVideoRef,
    remoteVideoRef,
    acceptCall, // ✅ use this when accepting
    endCall,
  } = useWebRTC(incomingCall?.roomId);

  // Debug logger
  // useEffect(() => {
  //   if (!socket) return;
  //   const logAllEvents = (event, ...args) => {
  //     console.log("📡 Incoming Event:", event, args);
  //   };
  //   [
  //     "call:incoming",
  //     "call:accepted",
  //     "call:rejected",
  //     "call:ended",
  //     "webrtc:offer",
  //     "webrtc:answer",
  //     "webrtc:ice-candidate",
  //     "call:error",
  //   ].forEach((event) => {
  //     socket.on(event, (...args) => logAllEvents(event, ...args));
  //   });
  //   return () => {
  //     [
  //       "call:incoming",
  //       "call:accepted",
  //       "call:rejected",
  //       "call:ended",
  //       "webrtc:offer",
  //       "webrtc:answer",
  //       "webrtc:ice-candidate",
  //       "call:error",
  //     ].forEach((event) => socket.off(event));
  //   };
  // }, [socket]);

  // Listen for incoming calls

  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data) => {
      setIncomingCall({ roomId: data.roomId, from: data.from, type: data.type});
    };

    const handleEnded = () => {
      setIncomingCall(null);
      setIsCallActive(false);
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:ended", handleEnded);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:ended", handleEnded);
    };
  }, [socket]);

  // ✅ Accept call
  const handleAccept = async  () => {
    if (!incomingCall) return;

    const { roomId, type } = incomingCall; // ✅ this line is correct

    console.log("✅ Accepting call", roomId);
    socket.emit("call:accept", { roomId });

      if (type === "video") {
    await acceptCall(incomingCall.offer); // 👈 pass the SDP offer from backend
    console.log("✅ Video call accepted, starting WebRTC",incomingCall.offer)
    setIsCallActive(true);
  } else {
    await acceptCall(incomingCall.offer); // audio is just video=false stream
    console.log("✅ Audio call accepted, starting WebRTC",incomingCall.offer)
    setIsAudioCall(true);
  }
  setIsCallActive(true);
  };

  const handleReject = () => {
    if (incomingCall) {
      socket.emit("call:reject", { roomId: incomingCall.roomId });
      setIncomingCall(null);
    }
  };

  const handleEndCall = () => {
    endCall();
    if (incomingCall) {
      socket.emit("call:end", { roomId: incomingCall.roomId });
    }
    setIncomingCall(null);
    setIsCallActive(false);
  };

   const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const videoTracks = localVideoRef.current.srcObject.getVideoTracks();
      if (videoTracks.length) {
        const next = !videoTracks[0].enabled;
        videoTracks[0].enabled = next;
        setVideoOff(!next);
      }
    }
  };

      const toggleMute = () => {
      if (localVideoRef.current?.srcObject) {
        const audioTracks = localVideoRef.current.srcObject.getAudioTracks();
        if (audioTracks.length) {
          const next = !audioTracks[0].enabled;
          audioTracks[0].enabled = next;
          setMuted(!next);
        }
      }
    };

    const cleanupCallUI = () => {
    timerRef.current && clearInterval(timerRef.current);
    setInCall(false);
    setRoomId(null);
    setCallTimer(0);
    setMuted(false);
    setVideoOff(false);
    setScreenSharing(false);
  };

// console.log("🎥 localVideo element:", localVideoRef.current);
// console.log("🎥 localVideo srcObject:", localVideoRef.current?.srcObject);
// console.log("📡 remoteVideo element:", remoteVideoRef.current);
// console.log("📡 remoteVideo srcObject:", remoteVideoRef.current?.srcObject);

console.log("incomingCall:", incomingCall);

  return (
    <>
      {/* Incoming Call Dialog */}
      {incomingCall && !isCallActive && (
        <Dialog open onClose={handleReject}>
          <DialogTitle>{incomingCall.type === "audio" ? "🔊 Incoming Audio Call" : "📹 Incoming Video Call"}</DialogTitle>
          <DialogContent>
            <Typography>
              Agent <strong>{incomingCall.from}</strong> is calling you...
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleReject} color="error" variant="outlined">
              Reject
            </Button>
            <Button onClick={handleAccept} color="primary" variant="contained">
              Accept
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Audiocall modal */}
      {isAudioCall && incomingCall?.type === "audio" && (<AudioCallModal
      open={isAudioCall}
      onClose = {() => setIsAudioCall(false)}
      callType="incomming"
      endCall={handleEndCall}
      username="Agent"
      muted={muted}
      toggleMute={toggleMute}
       />)}
      

      {/* videocall modal */}
            {isCallActive && incomingCall?.type === "video" &&  (
              <VideoCallModal
              open={isCallActive}
              onClose = {() => setIsCallActive(false)}
              callType="incomming"
              // currentUserId={currentUserId}
              // otherUserId={otherUserId}
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
              // callTimer={callTimer}
              // callActive={inCall}
              // muted={muted}
              cameraOff={videoOff}
              toggleMute={toggleMute}
              toggleCamera={toggleVideo}
              endCall={endCall}
              />
            )}

      <Box sx={{ height: "87.7vh", flexGrow: 1, position: "relative" }}>

      {/* ChatBot Window */}
      {showChat && (
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)", // center horizontally & vertically
            zIndex: 999,
          }}
        >
          <ChatBot />
        </Box>
      )}


            {/* Floating Chat Icon */}
      <SpeedDial
        ariaLabel="Chat"
        sx={{ position: "absolute", bottom: 16, right: 16 }}
        icon={<Chat />}
        onClick={() => setShowChat((prev) => !prev)}
      />
    </Box>
    </>
  );
}
