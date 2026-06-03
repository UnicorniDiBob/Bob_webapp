"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useUnread } from "@/components/UnreadProvider";
import {
  getConversations,
  getMessages,
  markConversationRead,
  sendMessage,
} from "@/lib/messages";
import type { ChatMessage, ConversationSummary } from "@/lib/supabase/types";

function fmtTime(d: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("it-IT", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MessaggiPage() {
  return (
    <Suspense
      fallback={
        <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
          Carico i messaggi…
        </div>
      }
    >
      <MessaggiInner />
    </Suspense>
  );
}

function MessaggiInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, role, loading } = useAuth();
  const { refresh: refreshUnread } = useUnread();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(
    params.get("r") ?? null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const myType: "customer" | "professional" =
    role === "professional" ? "professional" : "customer";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Carica le conversazioni.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoadingConvs(true);
      const convs = await getConversations(user.id, role);
      if (!active) return;
      setConversations(convs);
      // se nessuna conversazione attiva, seleziona la prima
      setActiveId((cur) => cur ?? convs[0]?.requestId ?? null);
      setLoadingConvs(false);
    })();
    return () => {
      active = false;
    };
  }, [user, role]);

  const loadThread = useCallback(async (rid: string) => {
    setLoadingMsgs(true);
    const m = await getMessages(rid);
    setMessages(m);
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadThread(activeId);
    // segna come letti i messaggi ricevuti in questa conversazione
    (async () => {
      await markConversationRead(activeId, myType);
      await refreshUnread();
    })();
  }, [activeId, loadThread, myType, refreshUnread]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || !user || !activeId || sending) return;
    setSending(true);
    setDraft("");
    // ottimistico
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      senderType: myType,
      message: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    const { error } = await sendMessage(activeId, user.id, myType, text);
    if (error) {
      // ripristina in caso di errore
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(text);
    } else {
      await loadThread(activeId);
      // aggiorna anteprima nella lista
      setConversations((cs) =>
        cs.map((c) =>
          c.requestId === activeId
            ? { ...c, lastMessage: text, lastAt: new Date().toISOString() }
            : c
        )
      );
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="container-bob py-16 text-center text-sm text-bob-ink/50">
        Carico i messaggi…
      </div>
    );
  }

  const active = conversations.find((c) => c.requestId === activeId) ?? null;

  return (
    <div className="container-bob py-8">
      <header className="mb-5">
        <span className="section-eyebrow">Messaggi</span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-bob-ink">
          Le tue conversazioni
        </h1>
        <p className="mt-1 text-sm text-bob-ink/60">
          {myType === "professional"
            ? "Rispondi ai clienti che ti hanno contattato."
            : "Continua a parlare con i professionisti che hai contattato."}
        </p>
      </header>

      {loadingConvs ? (
        <div className="card h-64 animate-pulse bg-black/[0.03]" />
      ) : conversations.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bob-indigo-50 text-2xl">
            💬
          </div>
          <h3 className="font-semibold text-bob-ink">Nessuna conversazione</h3>
          <p className="max-w-sm text-sm text-bob-ink/60">
            {myType === "professional"
              ? "Quando un cliente ti contatta, la conversazione comparirà qui."
              : "Parla con Bob per trovare un professionista e iniziare una conversazione."}
          </p>
          {myType !== "professional" && (
            <Link href="/" className="btn-primary mt-1 px-5 py-2.5">
              Parla con Bob
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          {/* lista conversazioni */}
          <aside className="card max-h-[600px] divide-y divide-black/5 overflow-y-auto p-0">
            {conversations.map((c) => {
              const isActive = c.requestId === activeId;
              return (
                <button
                  key={c.requestId}
                  onClick={() => setActiveId(c.requestId)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition ${
                    isActive ? "bg-bob-indigo-50" : "hover:bg-black/[0.02]"
                  }`}
                  data-testid={`conv-${c.requestId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-bob-ink">
                      {c.counterpartName}
                    </span>
                    <span className="shrink-0 text-[10px] text-bob-ink/40">
                      {fmtTime(c.lastAt).split(",")[0]}
                    </span>
                  </div>
                  <span className="truncate text-xs text-bob-indigo">
                    {c.serviceName}
                    {c.cityName ? ` · ${c.cityName}` : ""}
                  </span>
                  {c.lastMessage && (
                    <span className="truncate text-xs text-bob-ink/55">
                      {c.lastMessage}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* thread */}
          <section className="card flex max-h-[600px] min-h-[400px] flex-col p-0">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-black/5 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-bob-ink">
                      {active.counterpartName}
                    </p>
                    <p className="truncate text-xs text-bob-ink/55">
                      {active.serviceName}
                      {active.cityName ? ` · ${active.cityName}` : ""}
                    </p>
                  </div>
                </div>

                <div
                  ref={threadRef}
                  className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4"
                >
                  {loadingMsgs ? (
                    <p className="text-center text-sm text-bob-ink/40">Carico…</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-bob-ink/40">
                      Nessun messaggio ancora. Scrivi il primo.
                    </p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderType === myType;
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                              mine
                                ? "rounded-br-sm bg-bob-indigo text-white"
                                : "rounded-bl-sm bg-bob-indigo-50 text-bob-ink"
                            }`}
                          >
                            <p className="whitespace-pre-line">{m.message}</p>
                            <p
                              className={`mt-1 text-[10px] ${
                                mine ? "text-white/60" : "text-bob-ink/40"
                              }`}
                            >
                              {fmtTime(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex gap-2 border-t border-black/5 px-4 py-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !sending && handleSend()
                    }
                    placeholder="Scrivi un messaggio…"
                    className="input-bob py-2.5"
                    data-testid="input-message"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="btn-primary py-2.5"
                    data-testid="button-send-message"
                  >
                    Invia
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-bob-ink/40">
                Seleziona una conversazione
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
