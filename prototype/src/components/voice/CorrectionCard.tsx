"use client";

interface CorrectionCardProps {
  original: string;
  corrected: string;
  type: string;
}

export function CorrectionCard({ original, corrected, type }: CorrectionCardProps) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-600">
        {type}
      </div>

      <div className="mb-2">
        <span className="text-sm text-gray-500">You: </span>
        <span className="text-sm text-gray-400 line-through">{original}</span>
      </div>

      <div className="mb-3">
        <span className="text-sm text-gray-500">Correct: </span>
        <span className="text-sm font-medium text-gray-900">{corrected}</span>
      </div>
    </div>
  );
}
