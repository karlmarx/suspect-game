interface WordGridProps {
  words: string[];
  targetWord?: string | null;
  selected?: string | null;
  onSelect?: (word: string) => void;
  interactive?: boolean;
}

export function WordGrid({
  words,
  targetWord = null,
  selected = null,
  onSelect,
  interactive = false,
}: WordGridProps) {
  return (
    <div
      className="mx-auto grid grid-cols-4 gap-2"
      style={{ maxWidth: 460 }}
    >
      {words.map((w) => {
        const isTarget = w === targetWord;
        const isSelected = w === selected;
        const bg = isSelected
          ? "rgba(244,114,182,0.15)"
          : isTarget
            ? "rgba(56,189,248,0.08)"
            : "#1e1e2e";
        const border = isSelected
          ? "#f472b6"
          : isTarget
            ? "rgba(56,189,248,0.35)"
            : "rgba(51,65,85,0.27)";
        const color = isTarget ? "#38bdf8" : "#e2e8f0";
        return (
          <button
            key={w}
            type="button"
            onClick={() => interactive && onSelect?.(w)}
            disabled={!interactive}
            className="relative font-mono uppercase tracking-wider transition-all"
            style={{
              background: bg,
              border: `1.5px solid ${border}`,
              borderRadius: 8,
              padding: "12px 6px",
              fontSize: 13,
              fontWeight: 600,
              color,
              cursor: interactive ? "pointer" : "default",
            }}
          >
            {w}
            {isTarget && (
              <span
                className="absolute"
                style={{
                  bottom: 4,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#38bdf8",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
