import { useRef, useState, useMemo, useEffect } from "react";
import {
  Box, Tabs, Tab, List, ListItem, ListItemText, Card,
  Grid, Avatar, OutlinedInput, InputAdornment, Typography,
  Stack, IconButton, TextField, CircularProgress,Button, Snackbar,
} from "@mui/material";
import {
  Search, Send, Videocam, Call, CallEnd, Mic, MicOff, VideocamOff,StopScreenShare,ScreenShare,
} from "@mui/icons-material";
import { useGetConversationQuery, useSendMessageMutation } from "../../features/chat/chatApi";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import {
  useGetCallHistoryQuery,
  useCreateCallMutation
} from "../../features/room/roomApi";
import renderTime from "../../utils/renderTime";
import ChatMessage from "./ChatMessage";
import ChatSkeleton from "../../components/reusbale/SkeltonCard";
import { useGetAllCustomerQuery } from "../../features/auth/authApi";
import Profile from "../../pages/private/profile/Profile";
import StyledBadge from "../../components/common/StyledBadge";
import useWebRTC from "../../hooks/webRtc";
import { getSocket } from "../../hooks/socket";
import CallModal from "../../components/call/CallModal";
import VideoCallModal from "../../components/call/VideoCallModal"
import AudioCallModal from "../../components/call/AudioCallModal"

const IMG_BASE_URL = "http://localhost:5003/uploads/profile";

const Chat = ({ currentUserId }) => {
  const agentId = "687608347057ea1dfefa7de0";
  const customerId = "68aa9e4a4e61ea8cf8705a21";

  const [inCall, setInCall] = useState(false);
  const [inAudioCall, setInAudioCall] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [text, setText] = useState("");
  const [tab, setTab] = useState(0);
  const [liveMessages, setLiveMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);



  const [openVideoCallModal, setOpenVideoCallModal] = useState(false);
  const [openAudioCallModal, setOpenAudioCallModal] = useState(false);

  const timerRef = useRef(null);
  const socket = getSocket();
  const containerRef = useRef(null);

  const { data: callsData, isLoading: loadingCalls } = useGetCallHistoryQuery();
  const [createCall] = useCreateCallMutation();
  const calls = callsData?.data || [];

  const { data: customerData } = useGetAllCustomerQuery();
  const customers = customerData?.data || [];

  const [sendMessage] = useSendMessageMutation();
  const { data: messagesData, isLoading: loadingMessages } = useGetConversationQuery(
    selectedUser?._id,
    { skip: !selectedUser }
  );

  
  // WebRTC hooks
  const {
    localVideoRef: localVideoRef,
    remoteVideoRef: remoteVideoRef,
    startCall: startVideoCall,
    endCall: endVideoCall,
  } = useWebRTC(roomId, { audio: true, video: true });

  const {
    localVideoRef: localAudioRef,
    remoteVideoRef: remoteAudioRef,
    startCall: startAudioCall,
    endCall: endAudioCall,
  } = useWebRTC(roomId, { audio: true, video: false });
  
  // console.log("localAudioRef", localAudioRef)
  // console.log("remoteAudioRef", remoteAudioRef)
  // console.log("localVideoRef", localVideoRef)
  // console.log("remoteVideoRef", remoteVideoRef)
  // Messages
  const handleSend = async () => {
    if (!text.trim() || !selectedUser?._id) return;
    const msg = {
      from: currentUserId,
      to: selectedUser._id,
      message: text.trim(),
      createdAt: new Date().toISOString(),
      _id: "temp-" + Date.now(),
    };
    setLiveMessages((prev) => [...prev, msg]);
    setText("");
    socket.emit("sendMessage", msg);
    try {
      await sendMessage({ to: selectedUser._id, message: msg.message }).unwrap();
    } catch (err) {
      toast.error(err?.data?.message || "Send failed");
    }
  };

  const combinedMessages = useMemo(() => {
    const history = messagesData?.data?.flatMap((i) => i.messages || []) || [];
    return [...history, ...liveMessages].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
  }, [messagesData, liveMessages]);

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
    return () => {ScreenShare
      timerRef.current && clearInterval(timerRef.current);
    };
  }, [inCall]);

   useEffect(() => {
    if (!socket) return;

    const onAccepted = async () => {
      // At this point the callee has joined the room. roomId is set, hook has re-rendered.
      showSnackbar("Call accepted. Connecting…");
      await startVideoCall(); // creates offer, attaches local stream, etc.
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
  }, [socket, roomId, startVideoCall]);

  {/* Audio call */}
    useEffect(() => {
    if (!socket) return;

    const onAccepted = async () => {
      // At this point the callee has joined the room. roomId is set, hook has re-rendered.
      showSnackbar("Call accepted. Connecting…");
      await startAudioCall(); // creates offer, attaches local stream, etc.
      setInAudioCall(true);
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
  }, [socket, roomId, startAudioCall]);

  // Call flow
  const handleVideoCall = async () => {
    
    try {
      setIsCalling(true);
     showSnackbar("Calling…");

      const res = await createCall({ receiverId: customerId }).unwrap();
      const backendRoomId = res?.data?.roomId;
      console.log("backendRoomId", backendRoomId);
      setRoomId(backendRoomId);
      // await startVideoCall();
      socket.emit("call:init", { roomId: backendRoomId, from: agentId, receiverId: customerId, callType: "video" });
      setOpenVideoCallModal(true);
      //  setInCall(true); // set state early so UI renders
      
    } catch (err) {
      toast.error("Failed to start call");
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
      const res = await createCall({ receiverId: customerId }).unwrap();
      const backendRoomId = res?.data?.roomId;
      setRoomId(backendRoomId);
      socket.emit("call:init", { roomId: backendRoomId, from: agentId, receiverId: customerId, callType: "audio" });
      await startAudioCall();
      setOpenAudioCallModal(true);
      
    } catch (err) {
      toast.error("Failed to start call");
      showSnackbar("Failed to start call");
      setIsCalling(false);
    } finally {
      setIsCalling(false);
    }
  };

  const handleStopCall = () => {
    if (roomId) socket.emit("call:end", { roomId });
    endVideoCall();
    endAudioCall();
    cleanupCallUI();
  };

  const cleanupCallUI = () => {
    clearInterval(timerRef.current);
    setInCall(false);
    setRoomId(null);
    setCallTimer(0);
    setMuted(false);
    setVideoOff(false);
  };

  // Socket listeners for call flow
  // useEffect(() => {
  //   if (!socket) return;
  //   const onAccepted = async ({ callType }) => {
  //     if (callType === "video") await startVideoCall();
  //     if (callType === "audio") await startAudioCall();
  //     setInCall(true);
  //   };
  //   const onRejected = () => {
  //     toast.info("Call rejected");
  //     cleanupCallUI();
  //   };
  //   const onEnded = () => {
  //     toast.info("Call ended");
  //     handleStopCall();
  //   };
  //   socket.on("call:accepted", onAccepted);
  //   socket.on("call:rejected", onRejected);
  //   socket.on("call:ended", onEnded);
  //   return () => {
  //     socket.off("call:accepted", onAccepted);
  //     socket.off("call:rejected", onRejected);
  //     socket.off("call:ended", onEnded);
  //   };
  // }, [socket, roomId, startVideoCall, startAudioCall]);

    // Socket lifecycle listeners relevant to caller
 
  // Timer
  useEffect(() => {
    if (inCall) {
      setCallTimer(0);
      timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [inCall]);

  // Mute/video toggle
  const toggleMute = () => {
    const stream = localVideoRef.current?.srcObject || localAudioRef.current?.srcObject;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
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

  // Track current date while scrolling
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

  const filteredCustomers = useMemo(() => {
    return customers?.filter(
      (user) =>
        (tab === 0 || user?.is_active) &&
        (user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user?.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [customers, tab, searchQuery]);

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

  // console.log("remotevideoRef", remoteVideoRef)
  // console.log("remoteAudioRef", remoteAudioRef)
  // console.log("localVideoRef", localVideoRef)
  // console.log("localAudioRef", localAudioRef)

  // console.log("inCall", inCall)
  // console.log("isCalling", isCalling)

  return (
    <>
      <Grid container spacing={1}>
        {/* Left Panel */}
        <Grid item xs={12} sm={6} md={6} lg={3}>
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
            <Box sx={{ height: { xs: '100vh', lg: "70vh" }, overflowY: "auto", "&::-webkit-scrollbar": { display: 'none' } }}>
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
                          <IconButton size="small" color="error" onClick={handleStopCall}>
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
                      <StyledBadge variant={user?.is_active ? "dot" : "none"}>
                        <Avatar src={`${IMG_BASE_URL}/${user.profileImage}`} />
                      </StyledBadge>
                      <Typography>{user.name}</Typography>
                    </Stack>
                  </Box>
                ))
              )}
            </Box>
          </Card>
        </Grid>

        {/* Chat Panel */}
        <Grid item xs={12} sm={6} md={6} lg={6}>
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
                        {isTyping ? "typing..." : `Last seen: ${renderTime(selectedUser.createdAt)}`}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton size="small" onClick={handleAudioCall}><Call /></IconButton>
                    <IconButton size="small" onClick={handleVideoCall}><Videocam /></IconButton>
                  </Box>
                </Stack>

                {/* Messages */}
                <Box sx={{ position: "relative", mb: 3, height: { xs: "250px", lg: "350px" } }}>
                  {currentDate && (
                    <Box sx={{ position: "sticky", top: 0, zIndex: 20, textAlign: "center" }}>
                      <Typography variant="caption" sx={{ backgroundColor: "#e0e0e0", px: 1, borderRadius: 1 }}>
                        {dayjs(currentDate).isSame(dayjs(), "day")
                          ? "Today"
                          : dayjs(currentDate).isSame(dayjs().subtract(1, "day"), "day")
                            ? "Yesterday"
                            : dayjs(currentDate).format("DD MMM YYYY")}
                      </Typography>
                    </Box>
                  )}
                  <Box ref={containerRef} sx={{ overflowY: "auto", p: 1, height: "100%" }}>
                    {loadingMessages ? (
                      <ChatSkeleton />
                    ) : combinedMessages.length > 0 ? (
                      combinedMessages.map((msg, index) => {
                        const messageDate = dayjs(msg.createdAt).format("YYYY-MM-DD");
                        return (
                          <Box key={msg._id || `temp-${index}`} data-date={messageDate}>
                            <ChatMessage msg={msg} selectedUser={selectedUser} />
                          </Box>
                        );
                      })
                    ) : (
                      <Typography>No messages found</Typography>
                    )}
                  </Box>
                </Box>

                {/* Input */}
                <Box sx={{ border: "1px solid #ddd", mb: 1, borderRadius: 2, mx: 1, backgroundColor: "#f8fbfcd1" }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TextField
                      sx={{ flex: 1 }}
                      fullWidth
                      size="small"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Type your message"
                    />
                    <IconButton onClick={handleSend}><Send /></IconButton>
                  </Stack>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="h6">Select a user to start chatting</Typography>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Profile Panel */}
        <Grid item xs={12} sm={6} md={6} lg={3}>
          <Profile />
        </Grid>
      </Grid>

      {/* Audio Call Modal */}
      {inAudioCall && <AudioCallModal
        open={openAudioCallModal}
        localAudioRef={localAudioRef}
        remoteAudioRef={remoteAudioRef}
        />
      }
    {/* Video Call Modal */}
    {inCall && <VideoCallModal
       open={openVideoCallModal}
      localVideoRef={localVideoRef}
      remoteVideoRef={remoteVideoRef}       
     />
    }




      <Snackbar
        open={openSnackbar}
        autoHideDuration={3000}
        onClose={() => setOpenSnackbar(false)}
        message={snackbarMsg}
      />
    </>
  );
};

export default Chat;
