"use client";

import { ConnectionStatus } from "@/lib/grok/client";

interface VoiceButtonProps {
  status: ConnectionStatus;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceButton({ status, onStart, onStop }: VoiceButtonProps) {
  const isActive = status === "connected";
  const isConnecting = status === "connecting";
  const isDisconnected = status === "disconnected" || status === "error";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={isActive ? onStop : onStart}
        disabled={isConnecting}
        className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
          isActive
            ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 animate-pulse"
            : isConnecting
            ? "bg-gray-400 cursor-wait"
            : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
        }`}
      >
        {isActive ? (
          <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
            />
          </svg>
        )}
      </button>

      <span className="text-sm text-gray-500">
        {isActive ? "Tap to stop" : isConnecting ? "Connecting..." : "Tap to speak"}
      </span>
    </div>
  );
}
