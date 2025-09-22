import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  IconButton,
  Box,
  Typography,
} from "@mui/material";
import { CallEnd, Close } from "@mui/icons-material";
import { getSocket } from "../../../hooks/socket";
import useWebRTC from "../../../hooks/webRtc";
import VideoCallModal from "../../../components/call/VideoCallModal";
import AudioCallModal from "../../../components/call/AudioCallModal";

export default function CustomerVideoCall() {
  const [incomingCall, setIncomingCall] = useState(null);
  const [AudioCallIncoming, setAudioCallIncoming] = useState(false); 
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAudioCallActive, setIsAudioCallActive] = useState(false);
  const socket = getSocket();

  // ✅ include acceptCall from hook
  const {
    localVideoRef,
    remoteVideoRef,
    acceptCall, // ✅ use this when accepting
    endCall,
  } = useWebRTC(incomingCall?.roomId, {audio: true, video: true});

  const{
    localVideoRef: audioLocalVideoRef,
    remoteVideoRef: audioRemoteVideoRef,
    acceptCall: audioAcceptCall, // ✅ use this when accepting
    endCall: audioEndCall,
  }= useWebRTC(incomingCall?.roomId, {audio: true, video: false});

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
    console.log("socket", socket);

    const handleIncoming = (data) => {
      console.log("incoming call", data);
      // if(data.callType === "video") {
        setIncomingCall({ roomId: data.roomId, from: data.from, receiverId: data.receiverId, callType: data.callType });
      // }else if(data.callType === "audio") {
      //   setAudioCallIncoming({ roomId: data.roomId, from: data.from, receiverId: data.receiverId, callType: data.callType });
      //   console.log("AudioCallIncoming", AudioCallIncoming, data);
      // }
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
  const handleAccept =  () => {
    if (!incomingCall) return;

    console.log("✅ Accepting call", incomingCall.roomId);
    socket.emit("call:accept", { roomId: incomingCall.roomId });

    setIsCallActive(true);
    // Wait for offer → then answer
    // socket.once("webrtc:offer", async ({ sdp }) => {
    //   console.log("📡 Received offer from agent");
    //   await acceptCall(sdp); // ✅ correct function for callee
    //   setIsCallActive(true);
    // });
  };

  const handleAcceptAudio = () => {
    if (!AudioCallIncoming) return;

    console.log("✅ Accepting call", AudioCallIncoming.roomId);
    socket.emit("call:accept", { roomId: AudioCallIncoming.roomId });

    setIsAudioCallActive(true);
    
    }



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

console.log("🎥 localVideo element:", localVideoRef.current);
console.log("🎥 localVideo srcObject:", localVideoRef.current?.srcObject);
console.log("📡 remoteVideo element:", remoteVideoRef.current);
console.log("📡 remoteVideo srcObject:", remoteVideoRef.current?.srcObject);


  return (
    <>
      {/* Incoming Call Dialog */}
      {incomingCall && !isCallActive && (
        <Dialog open onClose={handleReject}>
          <DialogTitle>📞 Incoming Call</DialogTitle>
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

      {/*Audio incoming Call Dialog */}
      {AudioCallIncoming && !isAudioCallActive && (
        <Dialog open onClose={handleReject}
        >
          <DialogTitle>📞</DialogTitle>
          <DialogContent>
            <Typography>
              Agent <strong>{AudioCallIncoming.from}</strong> is calling you...
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleReject} color="error" variant="outlined">
              Reject
            </Button>
            <Button onClick={handleAcceptAudio} color="primary" variant="contained">
              Accept
            </Button>
          </DialogActions>
          </Dialog>
      )}
      

      {/* Audio Call modal */}
      {isAudioCallActive && (
        <AudioCallModal
          open={isAudioCallActive}
          onClose={handleEndCall}
          localVideoRef={audioLocalVideoRef}
          remoteVideoRef={audioRemoteVideoRef}
          />
      )}

      {/* Video Call Modal */}
      {isCallActive && (
        <VideoCallModal
          open={isCallActive}
          onClose={handleEndCall}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          // callActive={isCallActive}
          // callTimer={callTimer}
          // muted={muted}
          // cameraOff={cameraOff}
          // toggleMute={toggleMute}
          // toggleCamera={toggleCamera}
          // endCall={handleEndCall}
          />
      )}
    </>
  );
}
