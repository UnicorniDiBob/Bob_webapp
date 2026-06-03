"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/faqData";

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-2xl divide-y divide-black/5 rounded-2xl border border-black/5 bg-white">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            data-testid={`faq-${i}`}
          >
            <span className="font-medium text-bob-ink">{item.q}</span>
            <svg
              className={`h-5 w-5 shrink-0 text-bob-indigo transition-transform ${
                open === i ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {open === i && (
            <p className="animate-fade-in px-5 pb-5 text-sm leading-relaxed text-bob-ink/65">
              {item.a}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
