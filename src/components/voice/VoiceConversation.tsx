"use client";

import { useCallback, useRef, useState } from "react";
import { VoiceClient, ConnectionStatus } from "@/lib/grok/client";
import { VoiceButton } from "./VoiceButton";
import { TranscriptPanel, TranscriptEntry } from "./TranscriptPanel";
import { isKnownFunction } from "@/lib/grok/tools";

interface VoiceConversationProps {
  nativeLanguage: string;
  targetLanguage: string;
  recentMistakes: { original: string; corrected: string; type: string }[];
  sessionCount: number;
}

export function VoiceConversation({
  nativeLanguage,
  targetLanguage,
  recentMistakes,
  sessionCount,
}: VoiceConversationProps) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [isEmmaSpeaking, setIsEmmaSpeaking] = useState(false);
  const clientRef = useRef<VoiceClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentEmmaTextRef = useRef("");

  const handleFunctionCall = useCallback(
    async (
      name: string,
      args: Record<string, unknown>,
      _callId: string
    ): Promise<string> => {
      if (!isKnownFunction(name)) {
        return JSON.stringify({ error: `Unknown function: ${name}` });
      }

      try {
        switch (name) {
          case "save_mistake": {
            const res = await fetch("/api/memory", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            });
            const data = await res.json();
            return JSON.stringify(data);
          }

          case "get_user_history": {
            const limit = (args.limit as number) || 10;
            const res = await fetch(`/api/memory?limit=${limit}&targetLanguage=${targetLanguage}`);
            const data = await res.json();
            return JSON.stringify(data);
          }

          case "generate_exercise": {
            const res = await fetch("/api/exercises", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...args, targetLanguage }),
            });
            const data = await res.json();
            return JSON.stringify(data);
          }

          case "save_progress": {
            const res = await fetch("/api/progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            });
            const data = await res.json();
            return JSON.stringify(data);
          }

          default:
            return JSON.stringify({ error: "Unhandled function" });
        }
      } catch (err) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : "Request failed",
        });
      }
    },
    [targetLanguage]
  );

  const playNextChunk = useCallback(() => {
    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsEmmaSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    const chunk = playbackQueueRef.current.shift()!;
    const ctx = audioContextRef.current!;

    const buffer = ctx.createBuffer(1, chunk.length, 24000);
    buffer.getChannelData(0).set(chunk);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      playNextChunk();
    };
    source.start();
  }, []);

  const handleEmmaAudio = useCallback((float32: Float32Array) => {
    setIsEmmaSpeaking(true);

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    playbackQueueRef.current.push(float32);

    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  const handleStart = useCallback(async () => {
    try {
      const tokenRes = await fetch("/api/session", { method: "POST" });
      if (!tokenRes.ok) {
        console.error("Failed to get ephemeral token");
        return;
      }
      const tokenData = await tokenRes.json();
      const ephemeralToken = tokenData.client_secret?.value;
      if (!ephemeralToken) {
        console.error("No token in response");
        return;
      }

      const client = new VoiceClient({
        ephemeralToken,
        nativeLanguage,
        targetLanguage,
        recentMistakes,
        sessionCount,
        sessionId: "",
        onStatusChange: setStatus,
        onUserTranscript: (text) => {
          setEntries((prev) => [
            ...prev,
            {
              id: `user-${Date.now()}`,
              role: "user",
              text,
            },
          ]);
        },
        onEmmaText: (text) => {
          currentEmmaTextRef.current = text;
        },
        onEmmaAudio: handleEmmaAudio,
        onCorrection: (original, corrected, type) => {
          setEntries((prev) => {
            const lastEmma = [...prev]
              .reverse()
              .find((e) => e.role === "emma");
            if (lastEmma) {
              return prev.map((e) =>
                e.id === lastEmma.id
                  ? { ...e, correction: { original, corrected, type } }
                  : e
              );
            }
            return prev;
          });
        },
        onFunctionCall: handleFunctionCall,
      });

      clientRef.current = client;
      await client.connect();
    } catch (err) {
      console.error("Failed to start session:", err);
      setStatus("error");
    }
  }, [nativeLanguage, targetLanguage, recentMistakes, sessionCount, handleEmmaAudio, handleFunctionCall]);

  const handleStop = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsEmmaSpeaking(false);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <TranscriptPanel entries={entries} isEmmaSpeaking={isEmmaSpeaking && entries.length > 0} />
      </div>

      <div className="flex items-center justify-center gap-8 border-t border-gray-100 bg-white px-4 py-6">
        <VoiceButton status={status} onStart={handleStart} onStop={handleStop} />
      </div>
    </div>
  );
}
