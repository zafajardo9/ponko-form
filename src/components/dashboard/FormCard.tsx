import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "../ui/Badge";

interface FormCardProps {
  form: {
    id: number;
    title: string;
    status: "draft" | "published";
    description: string | null;
    updatedAt: Date | string;
  };
  onDelete: (id: number) => void;
}

export function FormCard({ form, onDelete }: FormCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  const updatedAt = new Date(form.updatedAt);
  const timeAgo = formatTimeAgo(updatedAt);

  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-[#e6dfd8] bg-[#efe9de] p-6 transition-shadow hover:shadow-sm">
      {/* Three-dot actions icon — top-right corner */}
      <div className="absolute right-2 top-2">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413] transition-colors"
          aria-label="Actions"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-lg border border-[#e6dfd8] bg-white shadow-lg"
          >
            <div className="flex flex-col py-1">
              {/* Edit */}
              <Link
                to="/forms/$formId/edit"
                params={{ formId: String(form.id) }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#141413] hover:bg-[#f5f0e8] transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <span className="w-5 text-center text-xs text-[#cc785c]">
                  ◆
                </span>
                Edit
              </Link>

              {/* Divider */}
              <div className="mx-3 my-1 border-t border-[#e6dfd8]" />

              {/* Delete */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(form.id);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[#c64545] hover:bg-[#fbeaea] transition-colors"
              >
                <span className="w-5 text-center text-xs">✕</span>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-3 pr-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium text-[#141413]">
            {form.title}
          </h3>
          {form.description && (
            <p className="mt-1 line-clamp-2 text-sm text-[#6c6a64]">
              {form.description}
            </p>
          )}
        </div>
        <Badge variant={form.status}>{form.status}</Badge>
      </div>

      {/* Meta row: timestamp */}
      <div className="flex items-center gap-2 text-xs text-[#8e8b82]">
        <span>Updated {timeAgo}</span>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
