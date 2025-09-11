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

export default function CustomerVideoCall() {
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const socket = getSocket();

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
      setIncomingCall({ roomId: data.roomId, from: data.from });
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

      {/* Active Call Window */}
      {isCallActive && (
        <Dialog open fullWidth maxWidth="md" onClose={handleEndCall}>
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Video Call</Typography>
              <IconButton onClick={handleEndCall}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
              <Box>
                <Typography textAlign="center">You</Typography>
                <video
                  key={isCallActive ? "local-active" : "local-idle"}
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  width="300"
                  height="225"
                  style={{ borderRadius: "8px", objectFit: "cover" }}
                />
              </Box>
              <Box>
                <Typography textAlign="center">Agent</Typography>
                <video
                 key={isCallActive ? "remote-active" : "remote-idle"}
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  width="300"
                  height="225"
                  style={{ borderRadius: "8px", objectFit: "cover" }}
                />
              </Box>
            </Box>

            <Box mt={2} display="flex" justifyContent="center">
              <Button
                onClick={handleEndCall}
                variant="contained"
                color="error"
                startIcon={<CallEnd />}
              >
                End Call
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
