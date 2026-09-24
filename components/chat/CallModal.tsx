"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Monitor,
} from "lucide-react";
import {
  startRingtone,
  startOfflineRingtone,
  stopAllRingtones,
  playCallConnectSound,
  playCallEndSound,
} from "@/lib/utils/sound";
import { useToast } from "@/components/providers/ToastProvider";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelay",
      credential: "openrelay",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelay",
      credential: "openrelay",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelay",
      credential: "openrelay",
    },
  ],
  iceCandidatePoolSize: 10,
};

export type CallStatus =
  | "idle"
  | "calling"
  | "incoming"
  | "connected"
  | "ended";

interface CallModalProps {
  conversationId: string;
  currentUserId: string;
  otherUser: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  callType: "AUDIO" | "VIDEO";
  callStatus: CallStatus;
  isOtherUserOnline?: boolean;
  incomingOfferSdp?: RTCSessionDescriptionInit | null;
  onAcceptIncoming: () => void;
  onRejectIncoming: () => void;
  onEndCall: (details?: { wasConnected: boolean; duration: number }) => void;
  onSendSignal: (payload: {
    action: "offer" | "answer" | "ice-candidate" | "reject" | "end" | "missed";
    targetUserId: string;
    callType?: "AUDIO" | "VIDEO";
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    reason?: string;
    duration?: number;
    wasConnected?: boolean;
  }) => Promise<void>;
  remoteAnswerSdp?: RTCSessionDescriptionInit | null;
  pendingIceCandidate?: RTCIceCandidateInit | null;
  pendingIceCandidates?: RTCIceCandidateInit[];
}

export function CallModal({
  otherUser,
  callType,
  callStatus,
  isOtherUserOnline = false,
  incomingOfferSdp,
  onAcceptIncoming,
  onRejectIncoming,
  onEndCall,
  onSendSignal,
  remoteAnswerSdp,
  pendingIceCandidate,
  pendingIceCandidates = [],
}: CallModalProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(callType === "AUDIO");
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const processedCandidatesCountRef = useRef(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneStopRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();

  // 1. Ringtone for incoming / calling with instant cleanup
  useEffect(() => {
    if (callStatus === "incoming") {
      ringtoneStopRef.current = startRingtone();
    } else if (callStatus === "calling") {
      if (isOtherUserOnline) {
        ringtoneStopRef.current = startRingtone();
      } else {
        ringtoneStopRef.current = startOfflineRingtone();
      }
    } else {
      stopAllRingtones();
      if (ringtoneStopRef.current) {
        ringtoneStopRef.current();
        ringtoneStopRef.current = null;
      }
    }

    return () => {
      stopAllRingtones();
      if (ringtoneStopRef.current) {
        ringtoneStopRef.current();
        ringtoneStopRef.current = null;
      }
    };
  }, [callStatus, isOtherUserOnline]);

  // Clean up any audio on unmount
  useEffect(() => {
    return () => {
      stopAllRingtones();
    };
  }, []);

  // 2. Call duration timer when connected
  useEffect(() => {
    if (callStatus === "connected") {
      stopAllRingtones();
      playCallConnectSound();
      setDurationSeconds(0);
      callTimerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [callStatus]);

  // Clean up media tracks & peer connection on call end
  const cleanupStreams = useCallback(() => {
    stopAllRingtones();
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
  }, [localStream]);

  // Handle local video element binding
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Handle remote audio & video element binding
  useEffect(() => {
    if (remoteStream) {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch((err) => {
          console.warn("Remote audio play notice:", err);
        });
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          console.warn("Remote video play notice:", err);
        });
      }
    }
  }, [remoteStream]);

  // 3. Initialize Outgoing Call PeerConnection (Caller side)
  const initOutgoingCall = useCallback(async () => {
    try {
      // Pre-unlock audio element in user gesture for mobile devices
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "VIDEO",
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote track
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          onSendSignal({
            action: "ice-candidate",
            targetUserId: otherUser.id,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Create and send WebRTC offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await onSendSignal({
        action: "offer",
        targetUserId: otherUser.id,
        callType,
        sdp: offer,
      });
    } catch {
      toast.error("Could not access camera/microphone.", "Permission Denied");
      stopAllRingtones();
      onEndCall();
    }
  }, [callType, otherUser.id, onSendSignal, onEndCall, toast]);

  // Start outgoing call when in "calling" status
  useEffect(() => {
    if (callStatus === "calling" && !peerConnectionRef.current) {
      initOutgoingCall();
    }
  }, [callStatus, initOutgoingCall]);

  // 4. Handle Incoming Call Answer (Callee side accepts)
  const handleAcceptCall = async () => {
    stopAllRingtones();
    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }
    // Pre-unlock audio element in user gesture for mobile devices
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }
    onAcceptIncoming();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "VIDEO",
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          onSendSignal({
            action: "ice-candidate",
            targetUserId: otherUser.id,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      if (incomingOfferSdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferSdp));

        // Flush any ICE candidates that arrived before offer was set
        while (iceCandidateQueueRef.current.length > 0) {
          const queued = iceCandidateQueueRef.current.shift();
          if (queued) {
            await pc.addIceCandidate(new RTCIceCandidate(queued)).catch((err) => {
              console.warn("[WebRTC] Error adding queued ICE candidate:", err);
            });
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await onSendSignal({
          action: "answer",
          targetUserId: otherUser.id,
          sdp: answer,
        });
      }
    } catch {
      toast.error("Could not access camera/microphone.", "Permission Denied");
      stopAllRingtones();
      onEndCall();
    }
  };

  // 5. Handle Remote Answer arrived (Caller side receives answer)
  useEffect(() => {
    if (remoteAnswerSdp && peerConnectionRef.current) {
      stopAllRingtones();
      const pc = peerConnectionRef.current;
      if (pc.signalingState === "have-local-offer") {
        pc.setRemoteDescription(new RTCSessionDescription(remoteAnswerSdp))
          .then(async () => {
            // Flush any ICE candidates that arrived before remote answer was processed
            while (iceCandidateQueueRef.current.length > 0) {
              const queued = iceCandidateQueueRef.current.shift();
              if (queued && peerConnectionRef.current) {
                await peerConnectionRef.current
                  .addIceCandidate(new RTCIceCandidate(queued))
                  .catch((err) => {
                    console.warn("[WebRTC] Error adding queued ICE candidate:", err);
                  });
              }
            }
          })
          .catch((err) => console.error("Error setting remote answer:", err));
      }
    }
  }, [remoteAnswerSdp]);

  // 6. Handle Incoming ICE candidates with queueing
  useEffect(() => {
    const allCandidates = [
      ...pendingIceCandidates,
      ...(pendingIceCandidate ? [pendingIceCandidate] : []),
    ];

    if (allCandidates.length === 0) return;

    const newCandidates = allCandidates.slice(processedCandidatesCountRef.current);
    processedCandidatesCountRef.current = allCandidates.length;

    newCandidates.forEach((cand) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        pc.addIceCandidate(new RTCIceCandidate(cand)).catch((err) => {
          console.warn("[WebRTC] addIceCandidate error:", err);
        });
      } else {
        iceCandidateQueueRef.current.push(cand);
      }
    });
  }, [pendingIceCandidates, pendingIceCandidate]);

  // 7. Toggle Audio Mute
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // 8. Toggle Video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // 9. Screen Share
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current || typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      toast.info("Screen sharing is only available on desktop browsers.");
      return;
    }

    if (!isSharingScreen) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const pc = peerConnectionRef.current;
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === "video");

        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          if (localStream) {
            const originalVideo = localStream.getVideoTracks()[0];
            if (originalVideo && videoSender) {
              videoSender.replaceTrack(originalVideo);
            }
          }
          setIsSharingScreen(false);
        };

        setIsSharingScreen(true);
      } catch {
        // user cancelled
      }
    } else {
      if (localStream) {
        const originalVideo = localStream.getVideoTracks()[0];
        const pc = peerConnectionRef.current;
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender && originalVideo) {
          videoSender.replaceTrack(originalVideo);
        }
      }
      setIsSharingScreen(false);
    }
  };

  // 10. End Call
  const handleHangup = useCallback(() => {
    stopAllRingtones();
    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }
    playCallEndSound();
    cleanupStreams();
    const wasConnected = callStatus === "connected";
    onEndCall({ wasConnected, duration: durationSeconds });
  }, [callStatus, durationSeconds, cleanupStreams, onEndCall]);

  // Auto-timeout for calling: 18s if offline, 40s if online
  useEffect(() => {
    if (callStatus !== "calling") return;

    const timeoutLimit = isOtherUserOnline ? 40000 : 18000;
    const timer = setTimeout(() => {
      toast.info(
        isOtherUserOnline
          ? "No answer. Missed call logged."
          : "User is offline. Missed call logged.",
        "Call Ended"
      );
      handleHangup();
    }, timeoutLimit);

    return () => clearTimeout(timer);
  }, [callStatus, isOtherUserOnline, handleHangup, toast]);

  if (callStatus === "idle") return null;

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  // View A: Incoming Call Alert Dialog
  if (callStatus === "incoming") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
        <div className="relative w-full max-w-sm p-6 bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl text-center space-y-6 animate-in zoom-in-95">
          <div className="relative inline-block mx-auto mt-2">
            <span className="absolute -inset-2.5 rounded-full bg-indigo-500/30 animate-ping" />
            <Avatar
              src={otherUser.avatar}
              name={otherUser.name}
              size="lg"
              className="relative z-10 border-2 border-indigo-500 shadow-xl"
            />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white tracking-tight">{otherUser.name}</h3>
            <p className="text-xs text-indigo-400 font-semibold flex items-center justify-center gap-1.5 animate-pulse">
              {callType === "VIDEO" ? (
                <>
                  <Video className="w-4 h-4" />
                  <span>Incoming Video Call...</span>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  <span>Incoming Voice Call...</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2">
            <button
              onClick={() => {
                stopAllRingtones();
                if (ringtoneStopRef.current) {
                  ringtoneStopRef.current();
                  ringtoneStopRef.current = null;
                }
                onRejectIncoming();
              }}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition active:scale-95"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button
              onClick={handleAcceptCall}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition active:scale-95 animate-bounce"
              title="Accept"
            >
              <Phone className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View B: Active Call Window (Calling or Connected)
  return (
    <div
      className={`fixed z-50 flex flex-col bg-slate-950/95 border border-slate-800 backdrop-blur-2xl shadow-2xl transition-all duration-300 select-none ${
        isFullScreen
          ? "inset-0 rounded-none"
          : "inset-2 sm:inset-6 md:inset-12 rounded-3xl overflow-hidden"
      }`}
    >
      {/* Top Header */}
      <div className="h-14 px-4 sm:px-6 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Avatar src={otherUser.avatar} name={otherUser.name} size="sm" />
          <div>
            <h4 className="text-sm font-bold text-white leading-tight">{otherUser.name}</h4>
            <p className="text-[11px] text-slate-400">
              {callStatus === "calling" ? (
                isOtherUserOnline ? (
                  <span className="text-emerald-400 animate-pulse font-medium">Ringing...</span>
                ) : (
                  <span className="text-amber-400 animate-pulse font-medium">Calling (Offline)...</span>
                )
              ) : (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Connected · {formatTimer(durationSeconds)}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video / Audio Body */}
      <div className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden">
        {/* Audio element for remote audio playback in all call types (off-screen, not display:none) */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: "1px",
            height: "1px",
            opacity: 0.001,
            pointerEvents: "none",
          }}
        />

        {callType === "VIDEO" && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 space-y-5 animate-in fade-in">
            <div className="relative">
              {callStatus === "connected" && (
                <>
                  <span className="absolute -inset-6 rounded-full bg-emerald-500/15 animate-ping [animation-duration:2.5s]" />
                  <span className="absolute -inset-3 rounded-full bg-emerald-500/25 animate-pulse" />
                </>
              )}
              {callStatus === "calling" && (
                <span className="absolute -inset-4 rounded-full bg-indigo-500/20 animate-pulse" />
              )}
              <Avatar
                src={otherUser.avatar}
                name={otherUser.name}
                size="xl"
                className={`relative z-10 border-4 shadow-2xl transition-all duration-300 ${
                  callStatus === "connected" ? "border-emerald-500 ring-4 ring-emerald-500/30" : "border-slate-800"
                }`}
              />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">{otherUser.name}</h3>

              {callStatus === "calling" && (
                <p className="text-xs text-slate-400 mt-1">
                  {isOtherUserOnline
                    ? "Ringing device..."
                    : "User is currently offline (Calling...)"}
                </p>
              )}

              {callStatus === "connected" && (
                <div className="flex flex-col items-center gap-2.5">
                  {/* Bouncing Audio Waveform Bars */}
                  <div className="flex items-center gap-1.5 h-6 px-3 py-1 bg-slate-900/80 rounded-full border border-slate-800">
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0s] h-3" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s] h-5" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s] h-3" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.1s] h-6" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.25s] h-4" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Call Ongoing · {formatTimer(durationSeconds)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Picture-in-Picture Local Video Preview (for video calls) */}
        {callType === "VIDEO" && localStream && (
          <div className="absolute top-4 right-4 w-28 h-36 sm:w-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-500/40 bg-slate-900 z-30">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoDisabled ? "hidden" : "block"}`}
            />
            {isVideoDisabled && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500 text-xs">
                <VideoOff className="w-6 h-6 mb-1 text-slate-600" />
                <span>Camera Off</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="h-20 bg-slate-900/90 border-t border-slate-800/80 px-4 flex items-center justify-center gap-3 sm:gap-5 z-20">
        {/* Toggle Audio Mute */}
        <button
          onClick={toggleAudio}
          className={`p-3.5 rounded-2xl transition active:scale-95 ${
            isAudioMuted
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200"
          }`}
          title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Camera (if Video call) */}
        {callType === "VIDEO" && (
          <button
            onClick={toggleVideo}
            className={`p-3.5 rounded-2xl transition active:scale-95 ${
              isVideoDisabled
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
            title={isVideoDisabled ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        {/* Screen Share (Desktop only) */}
        {callType === "VIDEO" && (
          <button
            onClick={toggleScreenShare}
            className={`p-3.5 rounded-2xl transition active:scale-95 hidden sm:inline-flex ${
              isSharingScreen
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
            title={isSharingScreen ? "Stop Sharing Screen" : "Share Screen"}
          >
            <Monitor className="w-5 h-5" />
          </button>
        )}

        {/* Hangup Button */}
        <button
          onClick={handleHangup}
          className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-2 shadow-xl transition active:scale-95"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline">End Call</span>
        </button>
      </div>
    </div>
  );
}
