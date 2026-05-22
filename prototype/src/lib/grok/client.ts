import { GROK_TOOLS } from "./tools";
import { float32ToBase64PCM16, base64PCM16ToFloat32, SAMPLE_RATE, encodeWAV } from "./audio";
import { buildSystemPrompt } from "./prompt";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface VoiceClientConfig {
  ephemeralToken: string;
  nativeLanguage: string;
  targetLanguage: string;
  recentMistakes: { original: string; corrected: string; type: string }[];
  sessionCount: number;
  sessionId: string;
  onStatusChange: (status: ConnectionStatus) => void;
  onUserTranscript: (text: string) => void;
  onEmmaText: (text: string) => void;
  onEmmaTranscription: (text: string) => void;
  onEmmaDone: () => void;
  onEmmaAudio: (float32: Float32Array) => void;
  onCorrection: (original: string, corrected: string, type: string) => void;
  onFunctionCall: (
    name: string,
    args: Record<string, unknown>,
    callId: string
  ) => Promise<string>;
}

export class VoiceClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private earlyAudioBuffer: string[] = [];
  private config: VoiceClientConfig;
  private pendingFunctionCalls: Map<string, { name: string; args: string }> = new Map();
  private emmaTextBuffer = "";
  private emmaAudioChunks: Float32Array[] = [];
  private currentPlaybackSource: AudioBufferSourceNode | null = null;
  private playbackQueue: Float32Array[] = [];
  private isPlaying = false;
  private playbackSampleOffset = 0;

  constructor(config: VoiceClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.config.onStatusChange("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = this.audioContext.createMediaStreamSource(stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const base64 = float32ToBase64PCM16(new Float32Array(input));
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64,
            })
          );
        } else {
          this.earlyAudioBuffer.push(base64);
        }
      };
    } catch (err) {
      this.config.onStatusChange("error");
      throw new Error(
        `Microphone access denied: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    const wsUrl = "wss://api.x.ai/v1/realtime?model=grok-voice-latest";
    this.ws = new WebSocket(wsUrl, [
      `xai-client-secret.${this.config.ephemeralToken}`,
    ]);

    this.ws.onopen = () => {
      this.sendSessionUpdate();

      for (const audio of this.earlyAudioBuffer) {
        this.ws!.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio,
          })
        );
      }
      this.earlyAudioBuffer = [];

      this.config.onStatusChange("connected");
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onerror = () => {
      this.config.onStatusChange("error");
    };

    this.ws.onclose = () => {
      this.config.onStatusChange("disconnected");
    };
  }

  private sendSessionUpdate(): void {
    const instructions = buildSystemPrompt({
      nativeLanguage: this.config.nativeLanguage,
      targetLanguage: this.config.targetLanguage,
      recentMistakes: this.config.recentMistakes,
      sessionCount: this.config.sessionCount,
    });

    this.ws!.send(
      JSON.stringify({
        type: "session.update",
        session: {
          voice: "ara",
          modalities: ["text", "audio"],
          instructions,
          turn_detection: {
            type: "server_vad",
            silence_duration_ms: 1500,
          },
          tools: GROK_TOOLS,
        },
      })
    );
  }

  private async handleMessage(event: Record<string, unknown>): Promise<void> {
    const type = event.type as string;

    switch (type) {
      case "response.output_audio.delta": {
        const delta = event.delta as string;
        const float32 = base64PCM16ToFloat32(delta);
        this.emmaAudioChunks.push(float32);
        this.config.onEmmaAudio(float32);
        break;
      }

      case "response.text.delta":
      case "response.output_text.delta": {
        const delta = (event.delta as string) || (event.text as string) || "";
        this.emmaTextBuffer += delta;
        this.config.onEmmaText(this.emmaTextBuffer);
        break;
      }

      case "response.done": {
        this.transcribeEmmaAudio();
        this.emmaTextBuffer = "";
        this.config.onEmmaDone();
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const transcript = event.transcript as string;
        if (transcript) {
          this.config.onUserTranscript(transcript);
        }
        break;
      }

      case "response.function_call_arguments.done": {
        const callId = event.call_id as string;
        const name = event.name as string;
        const argumentsStr = event.arguments as string;

        try {
          const args = JSON.parse(argumentsStr);
          const result = await this.config.onFunctionCall(name, args, callId);
          this.sendFunctionResult(callId, result);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          this.sendFunctionResult(callId, JSON.stringify({ error: errorMsg }));
        }
        break;
      }
    }
  }

  private sendFunctionResult(callId: string, output: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output,
        },
      })
    );

    this.ws.send(JSON.stringify({ type: "response.create" }));
  }

  private async transcribeEmmaAudio(): Promise<void> {
    const chunks = this.emmaAudioChunks;
    this.emmaAudioChunks = [];

    if (chunks.length === 0) return;

    try {
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const combined = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const wav = encodeWAV(combined, SAMPLE_RATE);
      const formData = new FormData();
      formData.append("file", wav, "emma.wav");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          this.config.onEmmaTranscription(data.text);
        }
      }
    } catch {
      // silently fail — audio already played
    }
  }

  disconnect(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.earlyAudioBuffer = [];
    this.emmaAudioChunks = [];
    this.config.onStatusChange("disconnected");
  }
}
