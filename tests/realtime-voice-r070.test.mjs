
import assert from "node:assert/strict";
import test from "node:test";

import {
  RealtimeVoiceController,
  buildCanonicalAudioResponse,
  normalizeProviderEvent,
} from "../src/voice/realtimeVoice.mjs";


test("canonical response requests audio without changing ORKIO text", () => {
  const event = buildCanonicalAudioResponse({
    content: "Efatà 777.",
    turnId: "voice_turn_1",
    assistantContentSha256: "a".repeat(64),
  });
  assert.equal(event.type, "response.create");
  assert.equal(event.response.conversation, "none");
  assert.deepEqual(event.response.output_modalities, ["audio"]);
  assert.equal(
    event.response.metadata.orkio_turn_id,
    "voice_turn_1",
  );
  assert.match(event.response.instructions, /Efatà 777\.$/);
  assert.match(
    event.response.instructions,
    /sem adicionar, remover, traduzir ou parafrasear/,
  );
});


test("provider event parser rejects malformed input", () => {
  assert.equal(normalizeProviderEvent("{invalid"), null);
  assert.equal(normalizeProviderEvent(null), null);
  assert.deepEqual(
    normalizeProviderEvent('{"type":"response.created"}'),
    { type: "response.created" },
  );
});


test("cross-provider canonical turn is sent to backend before TTS", async () => {
  const calls = [];
  const api = {
    completeVoiceTurn: async (sessionId, payload) => {
      calls.push(["turn", sessionId, payload]);
      return {
        turn: { turn_id: "voice_turn_1" },
        response: { content: "Resposta canônica." },
        assistant_content_sha256: "b".repeat(64),
        tts_input_sha256: "b".repeat(64),
      };
    },
  };
  const sent = [];
  const controller = new RealtimeVoiceController({
    api,
    mediaDevices: {},
    RTCPeerConnectionImpl: class {},
    onHistoryRefresh: async () => calls.push(["refresh"]),
  });
  controller.state = {
    ...controller.state,
    active: true,
    sessionId: "voice_session_1",
    sessionGeneration: 2,
  };
  controller.dataChannel = {
    readyState: "open",
    send: (value) => sent.push(JSON.parse(value)),
  };

  await controller._handleProviderEvent(
    JSON.stringify({
      type:
        "conversation.item.input_audio_transcription.completed",
      event_id: "provider_evt_1",
      item_id: "transcript_1",
      transcript: "Pergunta final.",
    }),
  );

  assert.equal(calls[0][0], "turn");
  assert.equal(calls[0][1], "voice_session_1");
  assert.equal(calls[0][2].session_generation, 2);
  assert.equal(calls[1][0], "refresh");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "response.create");
  assert.match(
    sent[0].response.instructions,
    /Resposta canônica\.$/,
  );
});


test("end releases microphone tracks before terminal close", async () => {
  const order = [];
  const track = {
    enabled: true,
    stop: () => order.push("track.stop"),
  };
  const api = {
    closeVoiceSession: async (sessionId, payload) => {
      order.push("api.close");
      assert.equal(sessionId, "voice_session_1");
      assert.equal(payload.microphone_released, true);
      assert.equal(payload.player_released, true);
      return { status: "closed" };
    },
  };
  const controller = new RealtimeVoiceController({
    api,
    mediaDevices: {},
    RTCPeerConnectionImpl: class {},
  });
  controller.state = {
    ...controller.state,
    active: true,
    sessionId: "voice_session_1",
    sessionGeneration: 1,
  };
  controller.localStream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  };
  controller.dataChannel = {
    readyState: "closed",
    close: () => order.push("channel.close"),
  };
  controller.pc = {
    close: () => order.push("pc.close"),
  };

  await controller.end("user_end");

  assert.ok(order.indexOf("track.stop") < order.indexOf("api.close"));
  assert.equal(controller.state.phase, "closed");
  assert.equal(controller.localStream, null);
});


test("mute changes only local microphone track state", () => {
  const track = { enabled: true };
  const controller = new RealtimeVoiceController({
    api: {},
    mediaDevices: {},
    RTCPeerConnectionImpl: class {},
  });
  controller.localStream = {
    getAudioTracks: () => [track],
  };
  controller.setMuted(true);
  assert.equal(track.enabled, false);
  assert.equal(controller.state.muted, true);
  controller.setMuted(false);
  assert.equal(track.enabled, true);
});


test("reconnect sends and rotates the generation-bound resume token", async () => {
  const calls = [];
  const controller = new RealtimeVoiceController({
    api: {
      resumeVoiceSession: async (sessionId, payload) => {
        calls.push([sessionId, payload]);
        return {
          session: {
            session_id: sessionId,
            session_generation: 2,
          },
          events: [],
          resume_token: "rotated-resume-token",
          resume_token_expires_at: "2026-08-04T18:00:00Z",
        };
      },
    },
    mediaDevices: {},
    RTCPeerConnectionImpl: class {},
    reconnectDelayMs: 0,
    maxReconnectAttempts: 1,
  });
  controller.state = {
    ...controller.state,
    active: true,
    sessionId: "voice_session_1",
    sessionGeneration: 1,
    resumeToken: "initial-resume-token",
  };
  controller._closePeerOnly = async () => undefined;
  controller._connectMedia = async () => undefined;

  await controller._scheduleReconnect();

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "voice_session_1");
  assert.equal(
    calls[0][1].resume_token,
    "initial-resume-token",
  );
  assert.equal(
    calls[0][1].expected_session_generation,
    1,
  );
  assert.equal(controller.state.sessionGeneration, 2);
  assert.equal(
    controller.state.resumeToken,
    "rotated-resume-token",
  );
});


test("barge-in marks the provider response as terminally reported", async () => {
  const reports = [];
  const controller = new RealtimeVoiceController({
    api: {
      reportVoiceAudio: async (...args) => {
        reports.push(args);
        return {};
      },
    },
    mediaDevices: {},
    RTCPeerConnectionImpl: class {},
  });
  controller.state = {
    ...controller.state,
    active: true,
    speaking: true,
    sessionId: "voice_session_1",
    sessionGeneration: 1,
  };
  controller.dataChannel = {
    readyState: "open",
    send: () => undefined,
  };
  controller.responseToTurn.set("response_1", {
    turn: { turn_id: "voice_turn_1" },
  });
  controller.outputTranscripts.set("response_1", "Parcial");

  await controller.interrupt();

  assert.equal(
    controller.reportedResponses.has("response_1"),
    true,
  );
  assert.equal(reports.length, 1);
  assert.equal(reports[0][2].audio_status, "interrupted");
});
