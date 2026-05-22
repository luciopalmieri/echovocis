"use client";

import { CorrectionCard } from "./CorrectionCard";

export interface TranscriptEntry {
  id: string;
  role: "user" | "emma";
  text: string;
  correction?: {
    original: string;
    corrected: string;
    type: string;
  };
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  isEmmaSpeaking: boolean;
}

export function TranscriptPanel({ entries, isEmmaSpeaking }: TranscriptPanelProps) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
      {entries.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <p className="text-sm">Start speaking to see the transcript here</p>
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id}>
          {entry.role === "user" ? (
            <div className="rounded-lg bg-gray-50 px-4 py-2">
              <span className="text-xs font-medium text-gray-400">You</span>
              <p className="text-sm text-gray-700">{entry.text}</p>
            </div>
          ) : (
            <div>
              <div className="rounded-lg bg-white border border-gray-100 px-4 py-2">
                <span className="text-xs font-medium text-blue-500">Emma</span>
                <p className="text-sm text-gray-900">{entry.text}</p>
              </div>
              {entry.correction && (
                <div className="mt-2">
                  <CorrectionCard
                    original={entry.correction.original}
                    corrected={entry.correction.corrected}
                    type={entry.correction.type}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {isEmmaSpeaking && (
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-xs text-gray-400">Emma is speaking</span>
        </div>
      )}
    </div>
  );
}
