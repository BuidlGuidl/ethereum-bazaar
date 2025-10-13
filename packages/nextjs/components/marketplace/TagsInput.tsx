"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TagsInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
};

export const TagsInput = ({ value, onChange, placeholder, className }: TagsInputProps) => {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const normalized = useMemo(() => new Set(value.map(v => v.toLowerCase())), [value]);

  const commitDraftTokens = useCallback(
    (text: string) => {
      const tokens = text
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => t.toLowerCase());
      if (!tokens.length) return;
      const nextSet = new Set<string>([...normalized]);
      for (const t of tokens) nextSet.add(t);
      onChange(Array.from(nextSet));
      setDraft("");
    },
    [normalized, onChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const next = value.filter(t => t.toLowerCase() !== tag.toLowerCase());
      onChange(next);
    },
    [onChange, value],
  );

  // Always keep scroll at the far right so typing stays at the visible edge
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [draft, value.length]);

  return (
    <div
      ref={containerRef}
      className={`input input-bordered w-full min-h-12 flex items-center flex-nowrap whitespace-nowrap gap-2 overflow-x-auto focus-within:outline-none ${className || ""}`}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map(tag => (
        <span key={tag} className="badge badge-ghost gap-1 shrink-0">
          {tag}
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            aria-label={`Remove ${tag}`}
            onClick={e => {
              e.stopPropagation();
              removeTag(tag);
            }}
          >
            ✕
          </button>
        </span>
      ))}
      {/* Draft appears like a badge while typing */}
      {draft ? <span className="badge badge-outline opacity-80 shrink-0">{draft}</span> : null}
      <input
        ref={inputRef}
        className="flex-1 w-px min-w-[1px] outline-none bg-transparent shrink-0"
        placeholder={value.length || draft ? undefined : placeholder}
        value={draft}
        style={{ caretColor: "var(--bc)" }}
        // Hide the input's text while draft is shown to avoid duplicate text, but keep caret visible
        onChange={e => {
          const text = e.target.value;
          if (text.includes(",")) {
            commitDraftTokens(text);
            return;
          }
          setDraft(text);
        }}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraftTokens(draft);
          } else if (e.key === "Backspace" && draft.length === 0 && value.length > 0) {
            e.preventDefault();
            removeTag(value[value.length - 1]);
          }
        }}
        onBlur={() => commitDraftTokens(draft)}
      />
      {/* Visually hide the input text by overlaying styles via a utility class when draft exists */}
      <style jsx>{`
        input[value]:not([value=""]) {
          ${"/* Only when there is draft text */"}
          color: transparent;
        }
        input::placeholder {
          color: inherit;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
};
