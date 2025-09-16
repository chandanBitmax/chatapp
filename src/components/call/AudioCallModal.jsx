// src/components/AudioCallModal.jsx
import React from "react";
import {
  Modal,
  Box,
  IconButton,
  Typography,
  Avatar,
  Stack
} from "@mui/material";
import {
  Mic,
  MicOff,
  CallEnd,
} from "@mui/icons-material";

export default function AudioCallModal({
  open,
  onClose,
  username = "Username",
  callTimer = 0,
  muted = false,
  toggleMute,
  endCall,
}) {
  const formatTime = (seconds) => {
    const min = String(Math.floor(seconds / 60)).padStart(2, "0");
    const sec = String(seconds % 60).padStart(2, "0");
    return `${min}:${sec}`;
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          bgcolor: "transparent", // WhatsApp dark green
        }}
      >
        <Box
          sx={{
            width: 300,
            height: 500,
            bgcolor: "#075E54",
            borderRadius: 2,
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            py: 4,
          }}
        >
          {/* Top Bar */}
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6" fontWeight={500}>
              {username}
            </Typography>
            <Typography variant="body2" color="grey.300" mt={0.5}>
              {formatTime(callTimer)}
            </Typography>
          </Box>

          {/* Avatar */}
          <Avatar
            sx={{
              width: 120,
              height: 120,
              bgcolor: "#3e8e7e",
              fontSize: 50,
            }}
          >
            {username?.[0]?.toUpperCase() || "U"}
          </Avatar>

          {/* Buttons */}
          <Stack direction="row" spacing={4}>
            <IconButton
              onClick={toggleMute}
              sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "#fff" }}
            >
              {muted ? <MicOff /> : <Mic />}
            </IconButton>

            <IconButton
              onClick={() => {
                endCall();
                onClose();
              }}
              sx={{
                bgcolor: "red",
                color: "#fff",
                "&:hover": { bgcolor: "#cc0000" },
              }}
            >
              <CallEnd />
            </IconButton>
          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}
