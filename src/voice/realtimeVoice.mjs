
const INPUT_TRANSCRIPT_DELTA =
  "conversation.item.input_audio_transcription.delta";
const INPUT_TRANSCRIPT_DONE =
  "conversation.item.input_audio_transcription.completed";
const OUTPUT_TRANSCRIPT_DELTA =
  "response.output_audio_transcript.delta";
const OUTPUT_TRANSCRIPT_DONE =
  "response.output_audio_transcript.done";


export function newVoiceId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto
      .randomUUID()
      .replaceAll("-", "")}`;
  }
  return (
    `${prefix}_${Date.now()}_` +
    Math.random().toString(16).slice(2)
  );
}


export function normalizeProviderEvent(raw) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  return raw;
}


export function buildCanonicalAudioResponse({
  content,
  turnId,
  assistantContentSha256,
}) {
  if (!content || !turnId || !assistantContentSha256) {
    throw new Error("VOICE_CANONICAL_RESPONSE_INVALID");
  }
  return {
    type: "response.create",
    response: {
      conversation: "none",
      output_modalities: ["audio"],
      metadata: {
        orkio_turn_id: turnId,
        assistant_content_sha256: assistantContentSha256,
      },
      instructions:
        "Leia exatamente o texto canônico a seguir, sem adicionar, " +
        "remover, traduzir ou parafrasear. Preserve a língua, números " +
        "e pontuação. Texto canônico:\n\n" +
        content,
    },
  };
}


function defaultSnapshot() {
  return {
    phase: "idle",
    active: false,
    muted: false,
    reconnecting: false,
    sessionId: null,
    sessionGeneration: null,
    sourceConnectionId: null,
    providerCallId: null,
    resumeToken: null,
    resumeTokenExpiresAt: null,
    partialTranscript: "",
    lastUserTranscript: "",
    assistantTranscript: "",
    lastCanonicalText: "",
    speaking: false,
    error: null,
  };
}


export class RealtimeVoiceController {
  constructor({
    api,
    onState,
    onCanonicalTurn,
    onHistoryRefresh,
    mediaDevices = globalThis.navigator?.mediaDevices,
    RTCPeerConnectionImpl = globalThis.RTCPeerConnection,
    AudioImpl = globalThis.Audio,
    reconnectDelayMs = 900,
    maxReconnectAttempts = 3,
  }) {
    if (!api) throw new Error("VOICE_API_REQUIRED");
    this.api = api;
    this.onState = onState ?? (() => {});
    this.onCanonicalTurn = onCanonicalTurn ?? (() => {});
    this.onHistoryRefresh = onHistoryRefresh ?? (() => {});
    this.mediaDevices = mediaDevices;
    this.RTCPeerConnectionImpl = RTCPeerConnectionImpl;
    this.AudioImpl = AudioImpl;
    this.reconnectDelayMs = reconnectDelayMs;
    this.maxReconnectAttempts = maxReconnectAttempts;

    this.state = defaultSnapshot();
    this.pc = null;
    this.dataChannel = null;
    this.localStream = null;
    this.remoteAudio = null;
    this.pendingCanonicalTurns = [];
    this.responseToTurn = new Map();
    this.outputTranscripts = new Map();
    this.reportedResponses = new Set();
    this.lastReceivedCanonicalSequence = 0;
    this.reconnectAttempts = 0;
    this.explicitClose = false;
  }

  snapshot() {
    return { ...this.state };
  }

  _set(patch) {
    this.state = { ...this.state, ...patch };
    this.onState(this.snapshot());
  }

  _assertBrowserSupport() {
    if (!this.mediaDevices?.getUserMedia) {
      throw new Error("VOICE_MICROPHONE_UNSUPPORTED");
    }
    if (!this.RTCPeerConnectionImpl) {
      throw new Error("VOICE_WEBRTC_UNSUPPORTED");
    }
  }

  async start({ threadId, consentGranted = true }) {
    if (this.state.active) return this.snapshot();
    if (!threadId) throw new Error("VOICE_THREAD_REQUIRED");
    this._assertBrowserSupport();
    this.explicitClose = false;
    this.reconnectAttempts = 0;
    this._set({
      phase: "requesting_microphone",
      active: false,
      error: null,
      partialTranscript: "",
      assistantTranscript: "",
    });

    try {
      this.localStream = await this.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const session = await this.api.createVoiceSession({
        thread_id: threadId,
        requested_agent: "Orkio",
        interaction_mode: "single",
        consent_granted: consentGranted,
      });
      this._set({
        sessionId: session.session_id,
        sessionGeneration: session.session_generation,
        phase: "connecting",
      });
      await this._connectMedia();
      return this.snapshot();
    } catch (error) {
      await this._releaseLocalMedia();
      this._set({
        phase: "error",
        active: false,
        error: {
          code: error.code ?? error.message ?? "VOICE_START_FAILED",
          message:
            error.message ??
            "Não foi possível iniciar a chamada por voz.",
        },
      });
      throw error;
    }
  }

  async _connectMedia() {
    const sourceConnectionId = newVoiceId("voice_connection");
    const pc = new this.RTCPeerConnectionImpl();
    this.pc = pc;
    this._set({ sourceConnectionId });

    this.remoteAudio = this.AudioImpl ? new this.AudioImpl() : null;
    if (this.remoteAudio) {
      this.remoteAudio.autoplay = true;
      this.remoteAudio.playsInline = true;
    }

    pc.ontrack = (event) => {
      if (this.remoteAudio) {
        const MediaStreamImpl = globalThis.MediaStream;
        const fallbackStream = MediaStreamImpl
          ? new MediaStreamImpl([event.track])
          : null;
        this.remoteAudio.srcObject =
          event.streams?.[0] ?? fallbackStream;
        const play = this.remoteAudio.play?.();
        play?.catch?.(() => undefined);
      }
    };

    for (const track of this.localStream?.getAudioTracks?.() ?? []) {
      pc.addTrack(track, this.localStream);
    }

    const channel = pc.createDataChannel("orkio-events", {
      ordered: true,
    });
    this.dataChannel = channel;
    channel.onmessage = (event) => {
      this._handleProviderEvent(event.data).catch((error) => {
        this._set({
          error: {
            code: error.code ?? "VOICE_EVENT_FAILED",
            message: error.message,
          },
        });
      });
    };
    channel.onopen = () => {
      this._set({
        phase: "listening",
        active: true,
        reconnecting: false,
      });
    };
    channel.onclose = () => {
      if (!this.explicitClose && this.state.active) {
        this._scheduleReconnect();
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        this._set({
          phase: "listening",
          active: true,
          reconnecting: false,
        });
      }
      if (
        ["failed", "disconnected"].includes(state) &&
        !this.explicitClose
      ) {
        this._scheduleReconnect();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const answer = await this.api.createVoiceCall(
      this.state.sessionId,
      {
        sdp: offer.sdp,
        source_connection_id: sourceConnectionId,
        expected_session_generation:
          this.state.sessionGeneration,
      },
    );
    await pc.setRemoteDescription({
      type: "answer",
      sdp: answer.sdp,
    });
    this._set({
      providerCallId: answer.provider_call_id,
      sessionGeneration:
        answer.session.session_generation,
      resumeToken: answer.resume_token,
      resumeTokenExpiresAt: answer.resume_token_expires_at,
    });
  }

  async _scheduleReconnect() {
    if (
      this.state.reconnecting ||
      this.explicitClose ||
      !this.state.sessionId
    ) {
      return;
    }
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._set({
        phase: "error",
        reconnecting: false,
        error: {
          code: "VOICE_RECONNECT_LIMIT_REACHED",
          message: "A chamada não pôde ser reconectada.",
        },
      });
      return;
    }
    this.reconnectAttempts += 1;
    this._set({
      phase: "reconnecting",
      reconnecting: true,
    });
    await new Promise((resolve) =>
      setTimeout(resolve, this.reconnectDelayMs),
    );
    try {
      await this._closePeerOnly();
      const sourceConnectionId = newVoiceId(
        "voice_connection",
      );
      const resumed = await this.api.resumeVoiceSession(
        this.state.sessionId,
        {
          resume_token: this.state.resumeToken,
          expected_session_generation:
            this.state.sessionGeneration,
          source_connection_id: sourceConnectionId,
          last_received_canonical_sequence:
            this.lastReceivedCanonicalSequence,
        },
      );
      this._set({
        sessionGeneration:
          resumed.session.session_generation,
        sourceConnectionId,
        resumeToken: resumed.resume_token,
        resumeTokenExpiresAt:
          resumed.resume_token_expires_at,
      });
      for (const event of resumed.events ?? []) {
        this.lastReceivedCanonicalSequence = Math.max(
          this.lastReceivedCanonicalSequence,
          event.canonical_sequence ?? 0,
        );
      }
      await this._connectMedia();
    } catch (error) {
      this._set({ reconnecting: false });
      await this._scheduleReconnect();
    }
  }

  _sendProviderEvent(event) {
    if (this.dataChannel?.readyState !== "open") {
      throw new Error("VOICE_DATA_CHANNEL_NOT_OPEN");
    }
    this.dataChannel.send(JSON.stringify(event));
  }

  async _handleProviderEvent(raw) {
    const event = normalizeProviderEvent(raw);
    if (!event?.type) return;

    if (event.type === "input_audio_buffer.speech_started") {
      this._set({
        phase: "listening",
        partialTranscript: "",
      });
      if (this.state.speaking) {
        await this.interrupt();
      }
      return;
    }

    if (event.type === INPUT_TRANSCRIPT_DELTA) {
      this._set({
        partialTranscript:
          (this.state.partialTranscript ?? "") +
          (event.delta ?? ""),
      });
      return;
    }

    if (event.type === INPUT_TRANSCRIPT_DONE) {
      const transcript = (
        event.transcript ??
        this.state.partialTranscript ??
        ""
      ).trim();
      if (!transcript) return;
      const transcriptId =
        event.item_id ??
        event.id ??
        newVoiceId("transcript");
      this._set({
        phase: "processing",
        partialTranscript: "",
        lastUserTranscript: transcript,
      });
      const result = await this.api.completeVoiceTurn(
        this.state.sessionId,
        {
          transcript_id: transcriptId,
          transcript,
          client_event_id:
            event.event_id ??
            event.id ??
            transcriptId,
          session_generation:
            this.state.sessionGeneration,
        },
      );
      this.pendingCanonicalTurns.push(result);
      this._set({
        lastCanonicalText: result.response.content,
      });
      this.onCanonicalTurn(result);
      await this.onHistoryRefresh();
      this._sendProviderEvent(
        buildCanonicalAudioResponse({
          content: result.response.content,
          turnId: result.turn.turn_id,
          assistantContentSha256:
            result.assistant_content_sha256,
        }),
      );
      return;
    }

    if (event.type === "response.created") {
      const responseId = event.response?.id ?? event.response_id;
      const pending = this.pendingCanonicalTurns.shift();
      if (responseId && pending) {
        this.responseToTurn.set(responseId, pending);
        this.outputTranscripts.set(responseId, "");
        this._set({
          speaking: true,
          phase: "speaking",
          assistantTranscript: "",
        });
        await this._reportAudio(pending, {
          providerEventId:
            event.event_id ?? event.id ?? `${responseId}:started`,
          responseId,
          transcript: "",
          audioStatus: "speaking",
        });
      }
      return;
    }

    if (event.type === OUTPUT_TRANSCRIPT_DELTA) {
      const responseId = event.response_id;
      if (!responseId) return;
      const value =
        (this.outputTranscripts.get(responseId) ?? "") +
        (event.delta ?? "");
      this.outputTranscripts.set(responseId, value);
      this._set({ assistantTranscript: value });
      return;
    }

    if (
      event.type === OUTPUT_TRANSCRIPT_DONE ||
      event.type === "response.done"
    ) {
      const responseId =
        event.response_id ?? event.response?.id;
      if (!responseId || this.reportedResponses.has(responseId)) {
        return;
      }
      const turn = this.responseToTurn.get(responseId);
      if (!turn) return;
      const transcript =
        event.transcript ??
        this.outputTranscripts.get(responseId) ??
        "";
      this.reportedResponses.add(responseId);
      await this._reportAudio(turn, {
        providerEventId:
          event.event_id ?? event.id ?? `${responseId}:done`,
        responseId,
        transcript,
        audioStatus: "completed",
      });
      this._set({
        speaking: false,
        phase: "listening",
        assistantTranscript: transcript,
      });
      return;
    }

    if (event.type === "error") {
      const error = new Error(
        event.error?.message ??
        "O provedor realtime retornou uma falha.",
      );
      error.code =
        event.error?.code ?? "REALTIME_PROVIDER_ERROR";
      throw error;
    }
  }

  async _reportAudio(
    turnResult,
    {
      providerEventId,
      responseId,
      transcript,
      audioStatus,
    },
  ) {
    return this.api.reportVoiceAudio(
      this.state.sessionId,
      turnResult.turn.turn_id,
      {
        provider_event_id: providerEventId,
        session_generation:
          this.state.sessionGeneration,
        spoken_transcript: transcript,
        audio_status: audioStatus,
        response_id: responseId,
      },
    );
  }

  async interrupt() {
    if (!this.state.speaking) return;
    try {
      this._sendProviderEvent({ type: "response.cancel" });
    } catch {
      // The provider may already have closed the response.
    }
    const responseIds = [...this.responseToTurn.keys()];
    const responseId = responseIds.at(-1);
    const turn = responseId
      ? this.responseToTurn.get(responseId)
      : null;
    if (turn) {
      this.reportedResponses.add(responseId);
      const transcript =
        this.outputTranscripts.get(responseId) ?? "";
      await this._reportAudio(turn, {
        providerEventId: newVoiceId("provider_interrupt"),
        responseId,
        transcript,
        audioStatus: "interrupted",
      }).catch(() => undefined);
    }
    this.remoteAudio?.pause?.();
    this._set({
      speaking: false,
      phase: "listening",
    });
  }

  setMuted(muted) {
    for (const track of this.localStream?.getAudioTracks?.() ?? []) {
      track.enabled = !muted;
    }
    this._set({ muted: Boolean(muted) });
  }

  async _closePeerOnly() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // no-op
      }
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // no-op
      }
    }
    if (this.remoteAudio) {
      try {
        this.remoteAudio.pause?.();
        this.remoteAudio.srcObject = null;
      } catch {
        // no-op
      }
    }
    this.dataChannel = null;
    this.pc = null;
    this.remoteAudio = null;
  }

  async _releaseLocalMedia() {
    for (const track of this.localStream?.getTracks?.() ?? []) {
      try {
        track.stop();
      } catch {
        // no-op
      }
    }
    this.localStream = null;
  }

  async end(closeReason = "user_end") {
    if (!this.state.sessionId) {
      await this._closePeerOnly();
      await this._releaseLocalMedia();
      this._set(defaultSnapshot());
      return;
    }
    this.explicitClose = true;
    this._set({ phase: "closing" });
    await this.interrupt().catch(() => undefined);
    await this._closePeerOnly();
    await this._releaseLocalMedia();

    try {
      await this.api.closeVoiceSession(
        this.state.sessionId,
        {
          close_reason: closeReason,
          microphone_released: true,
          player_released: true,
          expected_session_generation:
            this.state.sessionGeneration,
        },
      );
      await this.onHistoryRefresh();
      this._set({
        ...defaultSnapshot(),
        phase: "closed",
      });
    } catch (error) {
      this._set({
        active: false,
        speaking: false,
        reconnecting: false,
        phase: "error",
        error: {
          code: error.code ?? "VOICE_CLOSE_FAILED",
          message: error.message,
        },
      });
      throw error;
    }
  }
}
