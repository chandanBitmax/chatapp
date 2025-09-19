import React, { useEffect, useRef } from "react";
import {
  Modal,
  Box,
  IconButton,
  Typography,
  Avatar,
  Stack,
  Paper,
} from "@mui/material";
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
  Call,
} from "@mui/icons-material";
import IncommingRingtone from "../../assets/ringtone1.mp3";

export default function CallModal({
  open,
  onClose,
  callType = "audio", // "audio" | "video"
  localRef,
  remoteRef,
  username = "User",
  callTimer = 0,
  muted = false,
  cameraOff = false,
  toggleMute,
  toggleCamera,
  endCall,
  isRinging = false,
  ringingType = "incoming", // "incoming" | "outgoing"
  onAccept,
  onReject,
}) {
  const ringtoneRef = useRef(null);

  const formatTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEndCall = () => {
    endCall?.();
    onClose?.();
  };

  useEffect(() => {
    if (isRinging && ringtoneRef.current) {
      ringtoneRef.current.play().catch((err) =>
        console.warn("Autoplay blocked:", err)
      );
    } else if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    };
  }, [isRinging, ringingType]);

  if (!open) return null;

  return (
    <>
      {isRinging && (
        <audio
          ref={ringtoneRef}
          src={
            ringingType === "incoming"
              ? `${IncommingRingtone}`
              : "/sounds/outgoing-tone.mp3"
          }
          loop
        />
      )}

      {!isRinging && callType === "audio" && (
        <>
          <audio ref={localRef} autoPlay muted />
          <audio ref={remoteRef} autoPlay />
        </>
      )}
      {!isRinging && callType === "video" && (
        <>
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", background: "black" }}
          />
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            style={{
              position: "absolute",
              right: 16,
              top: 16,
              width: 160,
              height: 120,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.3)",
              objectFit: "cover",
              background: "black",
            }}
          />
        </>
      )}

      <Modal open={open} onClose={onClose}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            bgcolor: "rgba(0,0,0,0.7)",
          }}
        >
          {isRinging ? (
            ringingType === "incoming" ? (
              <Box
                sx={{
                  width: 320,
                  height: 500,
                  bgcolor: "#2e4c45",
                  borderRadius: 3,
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  py: 5,
                  px: 3,
                }}
              >
                <Avatar sx={{ width: 140, height: 140, fontSize: 48, bgcolor: "#a3f1e1", color: "#2e4c45", mb: 2 }}>
                  {username?.[0]?.toUpperCase() || "U"}
                </Avatar>
                <Typography variant="h6">{username}</Typography>
                <Typography variant="body2" color="grey.300" mt={1}>
                  {callType === "audio" ? "Incoming Audio Call…" : "Incoming Video Call…"}
                </Typography>
                <Stack direction="row" spacing={5} sx={{ mt: 5 }}>
                  <IconButton onClick={onReject} sx={{ bgcolor: "red", color: "#fff" }}>
                    <CallEnd />
                  </IconButton>
                  <IconButton onClick={onAccept} sx={{ bgcolor: "green", color: "#fff" }}>
                    <Call />
                  </IconButton>
                </Stack>
              </Box>
            ) : (
              <Box
                sx={{
                  width: 320,
                  height: 500,
                  bgcolor: "#1f2a44",
                  borderRadius: 3,
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  py: 5,
                  px: 3,
                }}
              >
                <Avatar sx={{ width: 140, height: 140, fontSize: 48, bgcolor: "#6fa8dc", color: "#fff", mb: 2 }}>
                  {username?.[0]?.toUpperCase() || "U"}
                </Avatar>
                <Typography variant="h6">{username}</Typography>
                <Typography variant="body2" color="grey.300" mt={1}>
                  Calling…
                </Typography>
                <IconButton onClick={handleEndCall} sx={{ bgcolor: "red", color: "#fff", mt: 5 }}>
                  <CallEnd />
                </IconButton>
              </Box>
            )
          ) : (
            <>
              {callType === "audio" ? (
                <Box
                  sx={{
                    width: 320,
                    height: 500,
                    bgcolor: "#2e4c45",
                    borderRadius: 3,
                    color: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 5,
                    px: 3,
                  }}
                >
                  <Box sx={{ textAlign: "center", mt: 2 }}>
                    <Typography variant="h6" fontWeight={600}>{username}</Typography>
                    <Typography variant="body2" color="grey.300" mt={0.5}>{formatTime(callTimer)}</Typography>
                  </Box>
                  <Avatar sx={{ width: 140, height: 140, fontSize: 48, bgcolor: "#a3f1e1", color: "#2e4c45" }}>
                    {username?.[0]?.toUpperCase() || "U"}
                  </Avatar>
                  <Stack direction="row" spacing={5} sx={{ mb: 3 }}>
                    <IconButton onClick={toggleMute} sx={{ color: "#fff" }}>
                      {muted ? <MicOff /> : <Mic />}
                    </IconButton>
                    <IconButton onClick={handleEndCall} sx={{ bgcolor: "red", color: "#fff" }}>
                      <CallEnd />
                    </IconButton>
                  </Stack>
                </Box>
              ) : (
                <Paper sx={{ position: "relative", width: { xs: "95%", md: "70%" }, height: "80vh", bgcolor: "black" }}>
                  <Box sx={{ position: "absolute", top: 12, left: 12, color: "#fff", bgcolor: "rgba(0,0,0,0.4)", px: 1, borderRadius: 1 }}>
                    <Typography variant="caption">{formatTime(callTimer)}</Typography>
                  </Box>
                  <Stack direction="row" spacing={2} sx={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)" }}>
                    <IconButton onClick={toggleMute} sx={{ color: "#fff" }}>
                      {muted ? <MicOff /> : <Mic />}
                    </IconButton>
                    <IconButton onClick={toggleCamera} sx={{ color: "#fff" }}>
                      {cameraOff ? <VideocamOff /> : <Videocam />}
                    </IconButton>
                    <IconButton onClick={handleEndCall} sx={{ color: "#fff", bgcolor: "red" }}>
                      <CallEnd />
                    </IconButton>
                  </Stack>
                </Paper>
              )}
            </>
          )}
        </Box>
      </Modal>
    </>
  );
}
