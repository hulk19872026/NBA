"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl mb-6">🏀</div>
      <h2 className="font-display text-3xl font-bold text-white mb-3">
        Something went wrong
      </h2>
      <p className="text-slate-400 text-sm mb-6 max-w-md">
        {error?.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="btn-primary px-6 py-2.5 text-sm font-medium"
      >
        Try Again
      </button>
    </div>
  );
}
