import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SIGNAL_TYPES = {
  join: "webrtc:join",
  offer: "webrtc:offer",
  answer: "webrtc:answer",
  iceCandidate: "webrtc:ice-candidate",
  leave: "webrtc:leave"
};

const CALL_PHASE = {
  idle: "idle",
  requestingMedia: "requesting-media",
  ringing: "ringing",
  incoming: "incoming",
  connecting: "connecting",
  active: "active",
  ending: "ending"
};

const JOIN_PHASE = {
  invite: "invite",
  accept: "accept",
  syncPeer: "sync-peer"
};

const MAX_GROUP_PARTICIPANTS = 10;
const ALONE_TIMEOUT_MS = 12000;
const DEFAULT_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const getParticipantId = (participant) => {
  if (!participant || typeof participant !== "object") return "";
  return String(participant.id || participant.user_id || participant._id || "");
};

const getParticipantName = (participant) => {
  if (!participant || typeof participant !== "object") return "Unknown";
  return participant.name || participant.username || participant.fullName || "Unknown";
};

const isLoopbackHost = (hostname) => {
  if (!hostname) return false;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
};

const normalizeRemoteParticipant = (participant) => ({
  ...participant,
  isMuted: Boolean(participant?.isMuted),
  isVideoEnabled: participant?.isVideoEnabled ?? true,
  status: participant?.status || "invited",
  stream: participant?.stream || null
});

const createStreamSnapshot = (stream) => {
  if (!stream) return null;
  return new MediaStream(stream.getTracks());
};

export const useGroupCall = ({
  socket,
  currentConversation,
  currentUser,
  getUserId
}) => {
  const [callPhase, setCallPhase] = useState(CALL_PHASE.idle);
  const [activeCall, setActiveCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const pendingIceCandidatesRef = useRef(new Map());
  const aloneTimeoutRef = useRef(null);
  const localStreamRef = useRef(null);
  const activeCallRef = useRef(null);
  const remoteParticipantsRef = useRef([]);

  const selfUserId = String(getUserId?.(currentUser) || currentUser?.id || "");

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    remoteParticipantsRef.current = remoteParticipants;
  }, [remoteParticipants]);

  const conversationParticipants = useMemo(() => {
    const members = Array.isArray(currentConversation?.members)
      ? currentConversation.members
      : [];

    return members
      .map((member) => ({
        userId: getParticipantId(member),
        name: getParticipantName(member),
        avatar: member?.avatar || member?.profile_picture || "",
        status: "invited"
      }))
      .filter((member) => member.userId && member.userId !== selfUserId)
      .slice(0, MAX_GROUP_PARTICIPANTS - 1);
  }, [currentConversation, selfUserId]);

  const participantDirectory = useMemo(() => {
    return new Map(
      conversationParticipants.map((participant) => [participant.userId, participant])
    );
  }, [conversationParticipants]);

  const resetAloneTimer = useCallback(() => {
    if (aloneTimeoutRef.current) {
      clearTimeout(aloneTimeoutRef.current);
      aloneTimeoutRef.current = null;
    }
  }, []);

  const updateRemoteParticipant = useCallback((userId, updater) => {
    if (!userId) return;

    setRemoteParticipants((prev) => {
      const index = prev.findIndex((participant) => participant.userId === userId);
      if (index === -1) {
        const created = normalizeRemoteParticipant(
          typeof updater === "function" ? updater({ userId }) : updater
        );
        return [...prev, created];
      }

      const current = prev[index];
      const updated = normalizeRemoteParticipant(
        typeof updater === "function" ? updater(current) : updater
      );
      const next = [...prev];
      next[index] = {
        ...current,
        ...updated
      };
      return next;
    });
  }, []);

  const getJoinedRemoteParticipantIds = useCallback(() => {
    return remoteParticipantsRef.current
      .filter((participant) =>
        ["joining", "connecting", "connected", "reconnecting"].includes(participant.status)
      )
      .map((participant) => participant.userId)
      .filter(Boolean);
  }, []);

  const sendSignal = useCallback(
    ({ targetUserId, type, ...payload }) => {
      if (!socket || !targetUserId || !type) return;

      socket.emit("call_user", {
        ...payload,
        type,
        targetUserId,
        fromUserId: selfUserId
      });
    },
    [selfUserId, socket]
  );

  const flushQueuedIceCandidates = useCallback(async (peerUserId, peerConnection) => {
    const queuedCandidates = pendingIceCandidatesRef.current.get(peerUserId) || [];
    if (queuedCandidates.length === 0) return;

    for (const candidate of queuedCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Failed to flush queued ICE candidate:", error);
      }
    }

    pendingIceCandidatesRef.current.delete(peerUserId);
  }, []);

  const queueIceCandidate = useCallback((peerUserId, candidate) => {
    if (!peerUserId || !candidate) return;

    const queuedCandidates = pendingIceCandidatesRef.current.get(peerUserId) || [];
    queuedCandidates.push(candidate);
    pendingIceCandidatesRef.current.set(peerUserId, queuedCandidates);
  }, []);

  const closePeerConnection = useCallback(
    (userId) => {
      if (!userId) return;

      const peerConnection = peerConnectionsRef.current.get(userId);
      if (peerConnection) {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.close();
        peerConnectionsRef.current.delete(userId);
      }

      pendingIceCandidatesRef.current.delete(userId);

      const remoteStream = remoteStreamsRef.current.get(userId);
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
        remoteStreamsRef.current.delete(userId);
      }

      updateRemoteParticipant(userId, (participant) => ({
        ...participant,
        stream: null,
        status: "left"
      }));
    },
    [updateRemoteParticipant]
  );

  const cleanupCallResources = useCallback(() => {
    resetAloneTimer();

    peerConnectionsRef.current.forEach((_, userId) => {
      closePeerConnection(userId);
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingIceCandidatesRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteParticipants([]);
  }, [closePeerConnection, resetAloneTimer]);

  const endCall = useCallback(
    async ({ notifyPeers = true } = {}) => {
      const currentCallSnapshot = activeCallRef.current;
      if (!currentCallSnapshot) {
        cleanupCallResources();
        setCallPhase(CALL_PHASE.idle);
        return;
      }

      setCallPhase(CALL_PHASE.ending);

      if (notifyPeers) {
        const targetIds = new Set([
          ...(currentCallSnapshot.invitedParticipantIds || []),
          ...getJoinedRemoteParticipantIds()
        ]);

        targetIds.forEach((targetUserId) => {
          sendSignal({
            targetUserId,
            type: SIGNAL_TYPES.leave,
            callId: currentCallSnapshot.id,
            conversationId: currentCallSnapshot.conversationId
          });
        });

        if (socket) {
          socket.emit("end_call", {
            conversationId: currentCallSnapshot.conversationId
          });
        }
      }

      cleanupCallResources();
      setActiveCall(null);
      setCallPhase(CALL_PHASE.idle);
    },
    [cleanupCallResources, getJoinedRemoteParticipantIds, sendSignal, socket]
  );

  const ensureMediaPermissions = useCallback(async (mode = "video") => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error("Trinh duyet nay khong ho tro getUserMedia.");
    }

    setCallPhase(CALL_PHASE.requestingMedia);

    const nextStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      },
      video:
        mode === "audio"
          ? false
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 24, max: 30 }
            }
    });

    localStreamRef.current = nextStream;
    setLocalStream(createStreamSnapshot(nextStream));
    return nextStream;
  }, []);

  const createPeerConnection = useCallback(
    async ({ peerUserId, peerName, callId, conversationId, createOffer = false }) => {
      if (!peerUserId || peerUserId === selfUserId) return null;

      const existingPeer = peerConnectionsRef.current.get(peerUserId);
      if (existingPeer) {
        if (createOffer && existingPeer.signalingState === "stable") {
          const offer = await existingPeer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await existingPeer.setLocalDescription(offer);
          sendSignal({
            targetUserId: peerUserId,
            type: SIGNAL_TYPES.offer,
            callId,
            conversationId,
            sdp: offer
          });
        }

        return existingPeer;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS
      });

      const currentLocalStream = localStreamRef.current;
      if (currentLocalStream) {
        currentLocalStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, currentLocalStream);
        });
      }

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate) return;

        sendSignal({
          targetUserId: peerUserId,
          type: SIGNAL_TYPES.iceCandidate,
          callId,
          conversationId,
          candidate: event.candidate
        });
      };

      peerConnection.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;

        remoteStreamsRef.current.set(peerUserId, stream);
        updateRemoteParticipant(peerUserId, (participant) => ({
          ...participant,
          userId: peerUserId,
          name:
            participant?.name ||
            peerName ||
            participantDirectory.get(peerUserId)?.name ||
            `User ${peerUserId.slice(0, 6)}`,
          stream,
          status: "connected"
        }));
        setCallPhase(CALL_PHASE.active);
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;

        if (state === "connected") {
          updateRemoteParticipant(peerUserId, (participant) => ({
            ...participant,
            status: "connected"
          }));
          setCallPhase(CALL_PHASE.active);
          return;
        }

        if (state === "disconnected") {
          updateRemoteParticipant(peerUserId, (participant) => ({
            ...participant,
            status: "reconnecting"
          }));
          return;
        }

        if (state === "failed" || state === "closed") {
          closePeerConnection(peerUserId);
        }
      };

      peerConnectionsRef.current.set(peerUserId, peerConnection);

      updateRemoteParticipant(peerUserId, (participant) => ({
        ...participant,
        userId: peerUserId,
        name:
          participant?.name ||
          peerName ||
          participantDirectory.get(peerUserId)?.name ||
          `User ${peerUserId.slice(0, 6)}`,
        status: createOffer ? "connecting" : "joining"
      }));

      if (createOffer) {
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerConnection.setLocalDescription(offer);
        sendSignal({
          targetUserId: peerUserId,
          type: SIGNAL_TYPES.offer,
          callId,
          conversationId,
          sdp: offer
        });
      }

      return peerConnection;
    },
    [closePeerConnection, participantDirectory, selfUserId, sendSignal, updateRemoteParticipant]
  );

  const startCall = useCallback(
    async ({ mode = "video", selectedParticipantIds = [] } = {}) => {
      if (!currentConversation?.id) {
        setErrorMessage("Hãy chọn một cuộc trò chuyện trước khi bắt đầu cuộc gọi.");
        return false;
      }

      const normalizedSelectedIds = new Set(
        (Array.isArray(selectedParticipantIds) ? selectedParticipantIds : [])
          .map((participantId) => String(participantId || ""))
          .filter(Boolean)
      );

      const invitedParticipants =
        normalizedSelectedIds.size > 0
          ? conversationParticipants.filter((participant) =>
              normalizedSelectedIds.has(participant.userId)
            )
          : conversationParticipants;

      if (invitedParticipants.length === 0) {
        setErrorMessage("Cuộc gọi cần ít nhất một thành viên khác.");
        return false;
      }

      if (invitedParticipants.length + 1 > MAX_GROUP_PARTICIPANTS) {
        setErrorMessage("MVP hiện tại chỉ hỗ trợ tối đa 10 người trong một cuộc gọi.");
        return false;
      }

      if (!window.isSecureContext && !isLoopbackHost(window.location.hostname)) {
        setErrorMessage("WebRTC cần HTTPS hoặc localhost để truy cập camera và microphone.");
        return false;
      }

      try {
        setErrorMessage("");
        const stream = await ensureMediaPermissions(mode);
        const callId = globalThis.crypto?.randomUUID?.() || `call-${Date.now()}`;
        const startedAt = new Date().toISOString();

        setLocalStream(createStreamSnapshot(stream));
        setRemoteParticipants(invitedParticipants.map(normalizeRemoteParticipant));
        setActiveCall({
          id: callId,
          conversationId: currentConversation.id,
          conversationName:
            currentConversation.groupName || currentConversation.name || "Conversation",
          mode,
          createdBy: selfUserId,
          startedAt,
          invitedParticipantIds: invitedParticipants.map((participant) => participant.userId)
        });
        setCallPhase(CALL_PHASE.ringing);

        invitedParticipants.forEach((participant) => {
          sendSignal({
            targetUserId: participant.userId,
            type: SIGNAL_TYPES.join,
            callId,
            conversationId: currentConversation.id,
            mode,
            startedAt,
            phase: JOIN_PHASE.invite,
            participants: invitedParticipants.map((item) => item.userId),
            conversationName:
              currentConversation.groupName || currentConversation.name || "Conversation"
          });
        });

        return true;
      } catch (error) {
        console.error("Failed to start call:", error);
        cleanupCallResources();
        setActiveCall(null);
        setCallPhase(CALL_PHASE.idle);
        setErrorMessage(
          error?.message || "Không thể bắt đầu cuộc gọi. Hãy kiểm tra quyền camera và microphone."
        );
        return false;
      }
    },
    [
      cleanupCallResources,
      conversationParticipants,
      currentConversation,
      ensureMediaPermissions,
      selfUserId,
      sendSignal
    ]
  );

  const acceptIncomingCall = useCallback(async () => {
    const currentCallSnapshot = activeCallRef.current;
    if (!currentCallSnapshot) return;

    try {
      await ensureMediaPermissions(currentCallSnapshot.mode || "video");
      setCallPhase(CALL_PHASE.connecting);

      updateRemoteParticipant(currentCallSnapshot.createdBy, (participant) => ({
        ...participant,
        userId: currentCallSnapshot.createdBy,
        name:
          participant?.name ||
          participantDirectory.get(currentCallSnapshot.createdBy)?.name ||
          "Caller",
        status: "joining"
      }));

      sendSignal({
        targetUserId: currentCallSnapshot.createdBy,
        type: SIGNAL_TYPES.join,
        callId: currentCallSnapshot.id,
        conversationId: currentCallSnapshot.conversationId,
        phase: JOIN_PHASE.accept
      });
    } catch (error) {
      console.error("Failed to accept call:", error);
      setErrorMessage(
        error?.message || "Không thể tham gia cuộc gọi do lỗi truy cập camera hoặc microphone."
      );
      await endCall({ notifyPeers: false });
    }
  }, [endCall, ensureMediaPermissions, participantDirectory, sendSignal, updateRemoteParticipant]);

  const declineIncomingCall = useCallback(async () => {
    const currentCallSnapshot = activeCallRef.current;
    if (currentCallSnapshot?.createdBy) {
      sendSignal({
        targetUserId: currentCallSnapshot.createdBy,
        type: SIGNAL_TYPES.leave,
        callId: currentCallSnapshot.id,
        conversationId: currentCallSnapshot.conversationId
      });
    }

    await endCall({ notifyPeers: false });
  }, [endCall, sendSignal]);

  const toggleMicrophone = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });

    setLocalStream(createStreamSnapshot(stream));
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });

    setLocalStream(createStreamSnapshot(stream));
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const handleIncomingSignal = async (payload = {}) => {
      if (!payload?.type) return;
      if (!payload?.conversationId || payload.conversationId !== currentConversation?.id) {
        return;
      }

      const fromUserId = String(payload.fromUserId || payload.callerId || "");
      if (!fromUserId || fromUserId === selfUserId) return;

      if (payload.type === SIGNAL_TYPES.join && payload.phase === JOIN_PHASE.invite) {
        const invitedIds = Array.isArray(payload.participants)
          ? payload.participants.map((participantId) => String(participantId || "")).filter(Boolean)
          : [];

        if (invitedIds.length > 0 && !invitedIds.includes(selfUserId)) {
          return;
        }

        setActiveCall({
          id: payload.callId || (globalThis.crypto?.randomUUID?.() || `call-${Date.now()}`),
          conversationId: payload.conversationId,
          conversationName:
            payload.conversationName ||
            currentConversation?.groupName ||
            currentConversation?.name ||
            "Conversation",
          mode: payload.mode || "video",
          createdBy: fromUserId,
          startedAt: payload.startedAt || new Date().toISOString(),
          invitedParticipantIds: invitedIds
        });
        setRemoteParticipants(
          conversationParticipants
            .filter((participant) => invitedIds.length === 0 || invitedIds.includes(participant.userId))
            .map((participant) =>
              normalizeRemoteParticipant({
                ...participant,
                status: participant.userId === fromUserId ? "ringing" : "invited"
              })
            )
        );
        setCallPhase(CALL_PHASE.incoming);
        setErrorMessage("");
        return;
      }

      const currentCallSnapshot = activeCallRef.current;
      if (!currentCallSnapshot || payload.callId !== currentCallSnapshot.id) {
        return;
      }

      if (payload.type === SIGNAL_TYPES.join && payload.phase === JOIN_PHASE.accept) {
        if (selfUserId !== currentCallSnapshot.createdBy) return;

        const existingPeerIds = [selfUserId, ...getJoinedRemoteParticipantIds()].filter(
          (peerUserId) => peerUserId && peerUserId !== fromUserId
        );

        updateRemoteParticipant(fromUserId, (participant) => ({
          ...participant,
          userId: fromUserId,
          name:
            participant?.name ||
            participantDirectory.get(fromUserId)?.name ||
            `User ${fromUserId.slice(0, 6)}`,
          status: "joining"
        }));

        for (const peerUserId of existingPeerIds) {
          const peerName =
            peerUserId === selfUserId
              ? currentUser?.name || "You"
              : participantDirectory.get(peerUserId)?.name || `User ${peerUserId.slice(0, 6)}`;

          sendSignal({
            targetUserId: fromUserId,
            type: SIGNAL_TYPES.join,
            callId: currentCallSnapshot.id,
            conversationId: currentCallSnapshot.conversationId,
            phase: JOIN_PHASE.syncPeer,
            peerUserId,
            peerName,
            shouldCreateOffer: false
          });

          if (peerUserId === selfUserId) {
            await createPeerConnection({
              peerUserId: fromUserId,
              peerName: participantDirectory.get(fromUserId)?.name,
              callId: currentCallSnapshot.id,
              conversationId: currentCallSnapshot.conversationId,
              createOffer: true
            });
            continue;
          }

          sendSignal({
            targetUserId: peerUserId,
            type: SIGNAL_TYPES.join,
            callId: currentCallSnapshot.id,
            conversationId: currentCallSnapshot.conversationId,
            phase: JOIN_PHASE.syncPeer,
            peerUserId: fromUserId,
            peerName: participantDirectory.get(fromUserId)?.name,
            shouldCreateOffer: true
          });
        }

        setCallPhase(CALL_PHASE.connecting);
        return;
      }

      if (payload.type === SIGNAL_TYPES.join && payload.phase === JOIN_PHASE.syncPeer) {
        const peerUserId = String(payload.peerUserId || "");
        if (!peerUserId || peerUserId === selfUserId) return;

        await createPeerConnection({
          peerUserId,
          peerName: payload.peerName,
          callId: currentCallSnapshot.id,
          conversationId: currentCallSnapshot.conversationId,
          createOffer: Boolean(payload.shouldCreateOffer)
        });
        setCallPhase(CALL_PHASE.connecting);
        return;
      }

      if (payload.type === SIGNAL_TYPES.offer) {
        const peerConnection = await createPeerConnection({
          peerUserId: fromUserId,
          peerName: participantDirectory.get(fromUserId)?.name,
          callId: currentCallSnapshot.id,
          conversationId: currentCallSnapshot.conversationId,
          createOffer: false
        });

        if (!peerConnection || !payload.sdp) return;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushQueuedIceCandidates(fromUserId, peerConnection);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        sendSignal({
          targetUserId: fromUserId,
          type: SIGNAL_TYPES.answer,
          callId: currentCallSnapshot.id,
          conversationId: currentCallSnapshot.conversationId,
          sdp: answer
        });
        return;
      }

      if (payload.type === SIGNAL_TYPES.answer) {
        const peerConnection = peerConnectionsRef.current.get(fromUserId);
        if (!peerConnection || !payload.sdp) return;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushQueuedIceCandidates(fromUserId, peerConnection);
        setCallPhase(CALL_PHASE.active);
        return;
      }

      if (payload.type === SIGNAL_TYPES.iceCandidate) {
        const peerConnection = peerConnectionsRef.current.get(fromUserId);
        if (!payload.candidate) return;

        if (!peerConnection || !peerConnection.remoteDescription) {
          queueIceCandidate(fromUserId, payload.candidate);
          return;
        }

        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (error) {
          console.error("Failed to add ICE candidate:", error);
        }
        return;
      }

      if (payload.type === SIGNAL_TYPES.leave) {
        closePeerConnection(fromUserId);
      }
    };

    const handleRoomEnded = (payload = {}) => {
      const currentCallSnapshot = activeCallRef.current;
      if (!currentCallSnapshot) return;

      if (payload?.conversationId && payload.conversationId !== currentCallSnapshot.conversationId) {
        return;
      }

      endCall({ notifyPeers: false });
    };

    socket.on("incoming_call", handleIncomingSignal);
    socket.on("call_ended", handleRoomEnded);

    return () => {
      socket.off("incoming_call", handleIncomingSignal);
      socket.off("call_ended", handleRoomEnded);
    };
  }, [
    closePeerConnection,
    conversationParticipants,
    createPeerConnection,
    currentConversation,
    currentUser?.name,
    endCall,
    flushQueuedIceCandidates,
    getJoinedRemoteParticipantIds,
    participantDirectory,
    queueIceCandidate,
    selfUserId,
    sendSignal,
    socket,
    updateRemoteParticipant
  ]);

  useEffect(() => {
    if (!activeCallRef.current) {
      resetAloneTimer();
      return undefined;
    }

    const connectedCount = remoteParticipants.filter((participant) =>
      ["joining", "connecting", "connected", "reconnecting"].includes(participant.status)
    ).length;

    if (connectedCount > 0 || callPhase === CALL_PHASE.incoming) {
      resetAloneTimer();
      return undefined;
    }

    aloneTimeoutRef.current = window.setTimeout(() => {
      endCall({ notifyPeers: true });
    }, ALONE_TIMEOUT_MS);

    return () => {
      resetAloneTimer();
    };
  }, [callPhase, endCall, remoteParticipants, resetAloneTimer]);

  useEffect(() => {
    return () => {
      cleanupCallResources();
    };
  }, [cleanupCallResources]);

  const isLocalAudioEnabled = Boolean(
    localStream?.getAudioTracks?.().some((track) => track.enabled)
  );
  const isLocalVideoEnabled = Boolean(
    localStream?.getVideoTracks?.().some((track) => track.enabled)
  );

  return {
    activeCall,
    callPhase,
    localStream,
    remoteParticipants,
    errorMessage,
    isLocalAudioEnabled,
    isLocalVideoEnabled,
    canStartCall:
      Boolean(currentConversation?.id) &&
      !currentConversation?.isVirtual &&
      conversationParticipants.length > 0 &&
      conversationParticipants.length < MAX_GROUP_PARTICIPANTS,
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    clearCallError: () => setErrorMessage("")
  };
};
