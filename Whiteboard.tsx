"use client";

type Line = { type: string; content: string };

export default function Whiteboard({ lines }: { lines: Line[] }) {
  if (!lines || lines.length === 0) {
    return (
      <div className="h-full grid place-items-center text-brand-400 text-sm">
        The smart board will appear here as your AI teacher explains.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto space-y-2 p-1">
      {lines.map((l, i) =>
        l.type === "heading" ? (
          <h4 key={i} className="text-lg font-bold text-brand-900 border-b border-brand-100 pb-1">
            {l.content}
          </h4>
        ) : (
          <p key={i} className="text-brand-800 text-sm bg-brand-50/60 rounded-lg px-3 py-2">
            {l.content}
          </p>
        )
      )}
    </div>
  );
}
