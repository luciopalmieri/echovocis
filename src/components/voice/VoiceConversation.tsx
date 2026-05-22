"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const playNextChunkRef = useRef<() => void>(() => {});

  useEffect(() => {
    playNextChunkRef.current = () => {
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
        playNextChunkRef.current();
      };
      source.start();
    };
  });

  const playNextChunk = useCallback(() => {
    playNextChunkRef.current();
  }, []);

  const handleFunctionCall = useCallback(
    async (
      name: string,
      args: Record<string, unknown>,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _callId: string
    ): Promise<string> => {
      if (!isKnownFunction(name)) {
        return JSON.stringify({ error: `Unknown function: ${name}` });
      }

      try {
        switch (name) {
          case "save_mistake": {
            const payload = { ...args, sessionId: sessionIdRef.current || undefined };
            const res = await fetch("/api/memory", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
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
    setError(null);
    setIsLoadingToken(true);
    try {
      let tokenRes: Response;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        tokenRes = await fetch("/api/session", { method: "POST" });
        if (tokenRes.ok) break;
        retries++;
        if (retries >= maxRetries) {
          setError("Failed to connect. Please try again.");
          setIsLoadingToken(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
      }

      const tokenData = await tokenRes!.json();
      const ephemeralToken = tokenData.value;
      const sessionId = tokenData.sessionId;
      if (!ephemeralToken) {
        setError("Invalid session token.");
        setIsLoadingToken(false);
        return;
      }

      sessionIdRef.current = sessionId || null;

      const client = new VoiceClient({
        ephemeralToken,
        nativeLanguage,
        targetLanguage,
        recentMistakes,
        sessionCount,
        sessionId: sessionId || "",
        onStatusChange: (s) => {
          setStatus(s);
          setIsLoadingToken(false);
          if (s === "error") {
            setError("Connection lost. Tap to reconnect.");
          }
        },
        onUserTranscript: (text) => {
          setEntries((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: "user", text },
          ]);
        },
        onEmmaText: (text) => {
          currentEmmaTextRef.current = text;
        },
        onEmmaAudio: handleEmmaAudio,
        onCorrection: (original, corrected, type) => {
          setEntries((prev) => {
            const lastEmma = [...prev].reverse().find((e) => e.role === "emma");
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
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoadingToken(false);
    }
  }, [nativeLanguage, targetLanguage, recentMistakes, sessionCount, handleEmmaAudio, handleFunctionCall]);

  const handleStop = useCallback(() => {
    const currentSessionId = sessionIdRef.current;
    clientRef.current?.disconnect();
    clientRef.current = null;
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsEmmaSpeaking(false);

    if (currentSessionId) {
      fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId }),
      }).catch(() => {});
      sessionIdRef.current = null;
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <TranscriptPanel entries={entries} isEmmaSpeaking={isEmmaSpeaking && entries.length > 0} />
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-8 border-t border-gray-100 bg-white px-4 py-6">
        <VoiceButton
          status={isLoadingToken ? "connecting" : status}
          onStart={handleStart}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
