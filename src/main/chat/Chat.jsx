import { useRef, useState, useMemo, useEffect } from "react";
import {
  Box, Tabs, Tab, List, ListItem, ListItemText, Card,
  Grid, Avatar, OutlinedInput, InputAdornment, Typography,
  Stack, IconButton, TextField, CircularProgress
} from "@mui/material";
import { Search, Send, Videocam, CallEnd, Call, Mic, MicOff, VideocamOff, ScreenShare, StopScreenShare } from "@mui/icons-material";
import { useGetConversationQuery, useSendMessageMutation } from "../../features/chat/chatApi";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import {
  useUpdateCallStatusMutation,
  useGetCallHistoryQuery,
  useCreateCallMutation
} from "../../features/room/roomApi";
import VideoCallModal from "../../components/call/VideoCallModal";

import renderTime from "../../utils/renderTime";
import ChatMessage from "./ChatMessage";
import ChatSkeleton from "../../components/reusbale/SkeltonCard";
import { useGetAllCustomerQuery } from "../../features/auth/authApi";
import Profile from "../../pages/private/profile/Profile";
import StyledBadge from "../../components/common/StyledBadge";
import useWebRTC from "../../hooks/webRtc";
import { getSocket } from "../../hooks/socket";
import AudioCallModal from "../../components/call/AudioCallModal";

const IMG_BASE_URL = "http://localhost:5003/uploads/profile";

const Chat = ({ currentUserId }) => {

  const agentId = "687608347057ea1dfefa7de0";
  const customerId = "68aa9e4a4e61ea8cf8705a21";
  
  const [inCall, setInCall] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [muted, setMuted] = useState(false);  
  const [videoOff, setVideoOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);

  const [tab, setTab] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [text, setText] = useState("");
  const [isReply, setIsReply] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [openVideoCallModal, setOpenVideoCallModal] = useState(false);
  const [openAudioCallModal, setOpenAudioCallModal] = useState(false);

  const timerRef = useRef(null);
  const socket = getSocket();

  const containerRef = useRef(null);

  // const token = localStorage.getItem("token");
  // const decoded = token ? jwtDecode(token) : null;
  // const agentId = decoded?.id;
console.log(agentId);
  // 🔗 API hooks
  const { data: callsData, isLoading: loadingCalls } = useGetCallHistoryQuery();

  const [createCall] = useCreateCallMutation();
  console.log(createCall)

   const { localVideoRef, remoteVideoRef, startCall: startWebRTC, endCall } =
      useWebRTC(roomId);

  const calls = callsData?.data || [];
  const { data: customerData } = useGetAllCustomerQuery();
  const customers = customerData?.data || [];
  const [sendMessage] = useSendMessageMutation();
  const [liveMessages, setLiveMessages] = useState([]);

  const { data: messagesData, isLoading: loadingMessages } = useGetConversationQuery(
    selectedUser?._id,
    { skip: !selectedUser }
  );

  const filteredCustomers = useMemo(() => {
    return customers?.filter(
      (user) =>
        (tab === 0 || user?.is_active) &&
        (user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user?.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [customers, tab, searchQuery]);

  const otherUserId = selectedUser?._id;

  // --- Handle messages
  const handleSend = async () => {
    if (!text.trim() || !otherUserId) return;

    const newMessage = {
      from: currentUserId,
      to: otherUserId,
      message: text.trim(),
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    setLiveMessages((prev) => [...prev, newMessage]);
    setText("");

    try {
      await sendMessage({ to: otherUserId, message: newMessage.message }).unwrap();
    } catch (err) {
      toast.error(err?.data?.message || "Send failed");
    }
  };

  const combinedMessages = useMemo(() => {
    const history = messagesData?.data?.flatMap(item => item.messages || []) || [];
    return [...history, ...liveMessages].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
  }, [messagesData, liveMessages]);

// const handleVideoCall = async () => {
//   if(!selectedUser) return toast.error('Please select a user');
  
//   try {
//     const roomId = `video-call-${selectedUser?._id}-${agentId}`;
//     console.log("roomId", roomId);
//     await createCall ({ 
//       roomId:"123",
//       callerId: agentId,
//       receiverId: selectedUser?._id
//      }).unwrap();
//     setOpenVideoCallModal(true);
//   } catch (error) {
//     console.log('fail to connect video call', error);
//     toast.error('Failed to connect video call');
//   }
// };


  // --- Detect date headers on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const items = container.querySelectorAll("[data-date]");
      for (let item of items) {
        const rect = item.getBoundingClientRect();
        const containerTop = container.getBoundingClientRect().top;
        if (rect.top >= containerTop && rect.top <= containerTop + 50) {
          setCurrentDate(item.getAttribute("data-date"));
          break;
        }
      }
    };

    container.addEventListener("scroll", onScroll);
    onScroll();

    return () => container.removeEventListener("scroll", onScroll);
  }, [combinedMessages]);

  const showSnackbar = (msg) => {
    setSnackbarMsg(msg);
    setOpenSnackbar(true);
  };

    const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

    useEffect(() => {
      if (!inCall) return;
      timerRef.current && clearInterval(timerRef.current);
      setCallTimer(0);
      timerRef.current = setInterval(() => {
        setCallTimer((p) => p + 1);
      }, 1000);
      return () => {
        timerRef.current && clearInterval(timerRef.current);
      };
    }, [inCall]);

      // Socket lifecycle listeners relevant to caller
      useEffect(() => {
        if (!socket) return;
    
        const onAccepted = async () => {
          // At this point the callee has joined the room. roomId is set, hook has re-rendered.
          showSnackbar("Call accepted. Connecting…");
          await startWebRTC(); // creates offer, attaches local stream, etc.
          setInCall(true);
        };
    
        const onRejected = () => {
          showSnackbar("Call rejected");
          cleanupCallUI();
        };
    
        const onEnded = () => {
          showSnackbar("Call ended by remote");
          handleStopCall(); // ensures peer + streams closed
        };
    
        socket.on("call:accepted", onAccepted);
        socket.on("call:rejected", onRejected);
        socket.on("call:ended", onEnded);
    
        return () => {
          socket.off("call:accepted", onAccepted);
          socket.off("call:rejected", onRejected);
          socket.off("call:ended", onEnded);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [socket, roomId, startWebRTC]);

 const handleVideoCall = async () => {
    try {
      setIsCalling(true);
      showSnackbar("Calling…");

      // 1) Create room on backend
      const res = await createCall({ receiverId: customerId }).unwrap();
      const backendRoomId = res?.data?.roomId;
      if (!backendRoomId) throw new Error("No roomId from backend");
      setRoomId(backendRoomId);

      // 2) Tell server to ring the customer
      socket.emit("call:init", {
        roomId: backendRoomId,
        from: agentId,
        receiverId: customerId,
      });

      setOpenVideoCallModal(true);

      // 3) Do NOT start WebRTC yet.
      //    Wait for "call:accepted" (see effect above).
      //    This guarantees the hook re-renders with the new roomId.
    } catch (err) {
      console.error("Start call error:", err);
      showSnackbar("Failed to start call");
      setIsCalling(false);
    } finally {
      setIsCalling(false);
    }
  };

  const handleAudioCall = async () => {
    try {
      setIsCalling(true);
      showSnackbar("Calling…");
      setOpenAudioCallModal(true);
    } catch (err) {
      console.error("Start call error:", err);
      showSnackbar("Failed to start call");
      setIsCalling(false);
    } finally {
      setIsCalling(false);
    }
  };




    const handleStopCall = () => {
    // inform server (safe even if already ended)
    if (roomId) {
      socket.emit("call:end", { roomId });
    }
    // close peer + stop media
    endCall?.();

    cleanupCallUI();
    showSnackbar("Call ended");
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
 
    const toggleScreenShare = async () => {
    try {
      // This assumes your hook exposes a peer connection via getPeerConnection elsewhere.
      // If not, wire this through your hook accordingly.
      const pc = require("../../hooks/socket").getPeerConnection?.();
      if (!pc) return showSnackbar("No peer connection");

      if (!screenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = stream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(screenTrack);

        screenTrack.onended = async () => {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const camTrack = camStream.getVideoTracks()[0];
          if (sender) await sender.replaceTrack(camTrack);
          setScreenSharing(false);
          showSnackbar("Screen sharing stopped");
        };

        setScreenSharing(true);
        showSnackbar("Screen sharing started");
      } else {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = camStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(camTrack);
        setScreenSharing(false);
        showSnackbar("Screen sharing stopped");
      }
    } catch (e) {
      console.error(e);
      showSnackbar("Failed to toggle screen share");
    }
  };

console.log("🎥 localVideo element:", localVideoRef.current);
console.log("🎥 localVideo srcObject:", localVideoRef.current?.srcObject);
console.log("📡 remoteVideo element:", remoteVideoRef.current);
console.log("📡 remoteVideo srcObject:", remoteVideoRef.current?.srcObject);


  return (
    <>
      <Grid container spacing={1}>
        {/* Left Panel */}
        <Grid size={{ xs: 12, lg: 3, sm: 6, md: 6 }}>
          <Card sx={{ p: 2 }}>
            <OutlinedInput
              startAdornment={<InputAdornment position="start"><Search /></InputAdornment>}
              fullWidth
              size="small"
              placeholder="Search..."
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Tabs value={tab} onChange={(e, val) => setTab(val)} sx={{ my: 1 }}>
              <Tab sx={{ minWidth: 75 }} label="Messages" />
              <Tab sx={{ minWidth: 75 }} label="Active" />
              <Tab sx={{ minWidth: 75 }} label="Calls" />
            </Tabs>
               <Box sx={{ height: { xs: '100vh', lg: "70vh" }, scrollbarWidth: 'none', "&::-webkit-scrollbar": { display: 'none' }, overflowY: "auto", }}>
              {tab === 2 ? (
                loadingCalls ? (
                  <CircularProgress />
                ) : calls.length > 0 ? (
                  <List>
                    {calls?.map((call) => (
                      <ListItem key={call._id} divider>
                        <Avatar>{call.participants[0]?.userId?.name?.charAt(0)}</Avatar>
                        <ListItemText
                          primary={`${call.roomId}`}
                          secondary={`Status: ${call.status} | Duration: ${call.duration || 0}s`}
                        />
                        {call.status !== "ended" && (
                          <IconButton size="small" color="error" onClick={() => endCall(call.roomId)}>
                            <CallEnd />
                          </IconButton>
                        )}
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography>No calls found</Typography>
                )
              ) : (
                filteredCustomers.map((user) => (
                  <Box key={user._id} sx={{ p: 1, backgroundColor: "#ebececf4", borderRadius: 1, cursor: "pointer" }} onClick={() => setSelectedUser(user)}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <StyledBadge
                        overlap="circular"
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        variant={user?.is_active ? "dot" : "none"}
                      >
                        <Avatar sx={{ border: "1px solid #041c0dff" }} src={`${IMG_BASE_URL}/${user.profileImage}`} />
                      </StyledBadge>
                      <Typography>{user.name}</Typography>
                    </Stack>
                  </Box>
                ))
              )}
            </Box>
          </Card>
        </Grid>

        {/* Right Panel */}
        <Grid size={{ xs: 12, lg: 6, sm: 6, md: 6 }}>
          <Card elevation={0} sx={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {selectedUser && tab !== 2 ? (
              <Box>
                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1, backgroundColor: "#ebececf4" }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <StyledBadge variant={selectedUser?.is_active ? "dot" : "none"}>
                      <Avatar src={`${IMG_BASE_URL}/${selectedUser?.profileImage}`} />
                    </StyledBadge>
                    <Box>
                      <Typography variant="h6">{selectedUser.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last seen: {renderTime(selectedUser.createdAt)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton size="small"
                    onClick={() => handleAudioCall(true)}
                    >
                      <Call />
                    </IconButton>
                    <IconButton size="small"
                    onClick={() => handleVideoCall(true)}
                    >
                      <Videocam />
                    </IconButton>
                  </Box>
                </Stack>
                <Box sx={{ position: "relative", mb: 3, height: { xs: "250px", lg: "350px" } }}>
                  {/* Fixed Current Date Header */}
                  {currentDate && (
                    <Box
                      sx={{
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
                        textAlign: "center",
                        backgroundColor: "transparent",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          backgroundColor: "#e0e0e0",
                          padding: "2px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          display: "inline-block",
                          mt: 1
                        }}
                      >
                        {dayjs(currentDate).isSame(dayjs(), "day")
                          ? "Today"
                          : dayjs(currentDate).isSame(dayjs().subtract(1, "day"), "day")
                            ? "Yesterday"
                            : dayjs(currentDate).format("DD MMM YYYY")}
                      </Typography>
                    </Box>
                  )}

                  {/* Scrollable Messages */}
                  <Box
                    ref={containerRef}
                    sx={{
                      overflowY: "auto",
                      p: 1,
                      height: "100%",
                      background: "none",
                      "&::-webkit-scrollbar": { display: "none" },
                    }}
                  >
                    {loadingMessages ? (
                      <ChatSkeleton />
                    ) : combinedMessages.length > 0 ? (
                      combinedMessages.map((msg, index) => {
                        const messageDate = dayjs(msg.createdAt).format("YYYY-MM-DD");
                        return (
                          <Box key={msg._id || `temp-${index}`} data-date={messageDate}>
                            <ChatMessage key={msg._id} msg={msg} selectedUser={selectedUser} />
                          </Box>
                        );
                      })
                    ) : (
                      <Typography>No messages found</Typography>
                    )}
                  </Box>
                </Box>
                <Box
                  sx={{
                    border: "1px solid #ddd",
                    mb: 1,
                    borderRadius: 2,
                    mx: 1,
                    backgroundColor: "#f8fbfcd1",
                  }}
                >
                  {isReply ? (
                    // ✅ Reply Box
                    <Stack
                      direction="column"
                      alignItems="flex-start"
                      sx={{
                        border: "1px solid #f9f5f5ff",
                        borderRadius: 2,
                        backgroundColor: "#ddd9d9d1",
                        m: 0.75,
                        p: 1,
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: "bold", color: "secondary.main", fontSize: "12px" }}
                      >
                        {selectedUser?.name}
                      </Typography>
                      <Typography variant="body1">
                        <span>hey this dummy message</span>
                      </Typography>
                    </Stack>
                  ) : (
                    // ✅ Normal Message Box
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <TextField
                        sx={{ flex: 1 }}
                        fullWidth
                        size="small"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type your message"
                      />
                      <IconButton onClick={handleSend}>
                        <Send />
                      </IconButton>
                    </Stack>
                  )}
                </Box>

              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="h6">Select a user to start chatting</Typography>
              </Box>
            )}
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3, sm: 6, md: 6 }}>
          <Profile />
        </Grid>
      </Grid>

      {/* audio call modal */}
      {openAudioCallModal && selectedUser && (
        <AudioCallModal
        open={openAudioCallModal}
        onClose = {() => setOpenAudioCallModal(false)}
        callType="outgoing"
        // currentUserId={currentUserId}
        // otherUserId={otherUserId}
        username={selectedUser.name}
        callTimer={callTimer}
        muted={muted}
        toggleMute={toggleMute}
        endCall={endCall}
        />
      )}
      {/* videocall modal */}
      {openVideoCallModal && selectedUser && (
        <VideoCallModal
        open={openVideoCallModal}
        onClose = {() => setOpenVideoCallModal(false)}
        callType="outgoing"
        // currentUserId={currentUserId}
        // otherUserId={otherUserId}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        callTimer={callTimer}
        callActive={inCall}
        muted={muted}
        cameraOff={videoOff}
        toggleMute={toggleMute}
        toggleCamera={toggleVideo}
        endCall={endCall}
        />
      )}
    </>
  );
};

export default Chat;
