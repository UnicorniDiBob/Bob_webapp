"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, MapPin } from "lucide-react";
import type { City, Service, ProfessionalCard } from "@/lib/supabase/types";
import { EMPTY_BRIEF } from "@/lib/bob";
import type {
  BobMessage,
  BriefUrgency,
  JobBrief,
  Severity,
} from "@/lib/bob";
import {
  BUDGET_OPTIONS,
  URGENCY_OPTIONS,
  SEVERITY_LABELS,
} from "@/lib/matching";
import { Stars, PriceTag, VerificationLevelBadge } from "./ui";
import { RequestDialog } from "./RequestDialog";
import { QuoteDialog } from "./QuoteDialog";
import { CityWaitlistForm } from "./CityWaitlistForm";
import { useAuth } from "./AuthProvider";
import { withArticle, afterDi } from "@/lib/italian";
import { zonesForCity } from "@/lib/zones";
import { createClient } from "@/lib/supabase/client";

type Step =
  | "intent"
  | "chat" // conversazione intelligente con Bob
  | "city"
  | "waitlist" // città non attiva: offriamo l'avviso email invece di dirottare su Milano
  | "zone" // quartiere: la posizione grossolana che il pro vede prima di essere scelto (mig 045)
  | "cap" // ripiego del passo zona: cinque cifre invece di un nome (mig 046)
  | "urgency"
  | "budget"
  | "results";

interface Msg {
  from: "bob" | "user";
  text: string;
  // anteprima (data URL) della foto allegata a questo messaggio
  imageUrl?: string;
}

interface PendingPhoto {
  base64: string;
  mediaType: string;
  preview: string;
}

interface SubtaskOption {
  slug: string;
  name: string;
}

// Indirizzo salvato nell'account cliente (customer_addresses, migration 020).
interface SavedAddress {
  id: string;
  label: string;
  address_line: string;
  city_slug: string | null;
  is_default: boolean;
}

interface Collected {
  serviceSlug?: string | null;
  serviceName?: string;
  severity?: Severity | null;
  summary?: string | null;
  citySlug?: string;
  cityName?: string;
  urgency?: Severity;
  // budget opzionale
  budgetLabel?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  maxPrice?: number;
  // true = l'utente vuole preventivi (nessun budget definito)
  wantsQuotes?: boolean;
  // indirizzo salvato scelto dal cliente: NON entra nel messaggio (41.1),
  // va in request_addresses e si apre solo dopo l'appuntamento confermato
  address?: string;
  // quartiere scelto dal cliente: volutamente grossolano, è quello che i
  // professionisti invitati vedono prima di essere scelti (mig 045)
  zoneSlug?: string;
  // ripiego quando nessun quartiere viene riconosciuto (mig 046)
  postalCode?: string;
}


// ----- persistenza del draft chat -----
// Tutto lo stato della chat vive in React: senza persistenza, un refresh o
// il giro di login (Accedi o registrati → /login → ritorno) azzerava il
// brief appena costruito. Salviamo i campi serializzabili in localStorage
// e li ripristiniamo al mount; "Ricomincia" pulisce anche il draft.
const DRAFT_KEY = "bob-chat-draft-v1";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // dopo 24h il problema è probabilmente superato

// ----- [F2] saluto personalizzato dalla memoria cliente -----
// Il saluto "Bentornato! L'ultima volta cercavi..." ha senso solo se la ricerca
// è davvero recente: un problema di casa si risolve in fretta, quindi dopo 24h
// la memoria non è più un contesto utile ma rumore. Inoltre l'effect gira a
// ogni mount con step === "intent": senza un flag di sessione il saluto
// ricompariva a ogni login e a ogni refresh della home.
const MEMORY_GREETING_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_GREETING_SHOWN_KEY = "bob-memory-greeting-shown-v1";

interface ChatDraft {
  savedAt: number;
  step: Step;
  messages: Msg[];
  brief: JobBrief;
  collected: Collected;
  subtaskOptions: SubtaskOption[];
  results: ProfessionalCard[];
  selectedIds: string[];
  waitlistCity: { slug: string; name: string } | null;
  briefId?: string | null;
}

export function BobChat({
  cities,
  services,
  compact = false,
}: {
  cities: City[];
  services: Service[];
  compact?: boolean;
}) {
  const [step, setStep] = useState<Step>("intent");
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "bob",
      text: "Ciao, sono Bob. Ti aiuto a trovare un servizio o vuoi offrirne uno?",
    },
  ]);
  const [brief, setBrief] = useState<JobBrief>(EMPTY_BRIEF);
  const [subtaskOptions, setSubtaskOptions] = useState<SubtaskOption[]>([]);
  const [editingSubtask, setEditingSubtask] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [capInput, setCapInput] = useState("");
  const [capError, setCapError] = useState<string | null>(null);
  const [waitlistCity, setWaitlistCity] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const { user, role } = useAuth();
  // [F2] Memoria cliente: evita di salutare due volte nella stessa sessione.
  const [memoryChecked, setMemoryChecked] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  // Id del brief salvato: viaggia con la richiesta così il pro riceve
  // il contesto raccolto da Bob (foto incluse).
  const [briefId, setBriefId] = useState<string | null>(null);
  const [collected, setCollected] = useState<Collected>({});
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<ProfessionalCard[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [requestFor, setRequestFor] = useState<ProfessionalCard | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, results, step, thinking]);

  // Ripristina il draft al mount (solo client, evita mismatch di hydration).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as ChatDraft;
      if (!draft?.savedAt || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (draft.step === "intent" || (draft.messages?.length ?? 0) < 2) return;
      setStep(draft.step);
      setMessages(draft.messages);
      setBrief(draft.brief);
      setCollected(draft.collected ?? {});
      setSubtaskOptions(draft.subtaskOptions ?? []);
      setResults(draft.results ?? []);
      setSelected(new Set(draft.selectedIds ?? []));
      setWaitlistCity(draft.waitlistCity ?? null);
      setBriefId(draft.briefId ?? null);
    } catch {
      // draft corrotto o storage inaccessibile: si riparte da zero
    }
  }, []);

  // [F2] Memoria cliente (customer_memory è già in DB e ha un'API dedicata,
  // ma finora nessun componente la usava): se non c'è un draft da riprendere
  // e il cliente è loggato, Bob personalizza il saluto con l'ultima ricerca.
  // Due limiti espliciti: la memoria scade dopo MEMORY_GREETING_TTL_MS e il
  // saluto si mostra una volta sola per sessione del browser.
  useEffect(() => {
    if (memoryChecked || !user || role !== "customer") return;
    if (step !== "intent" || messages.length > 1) {
      setMemoryChecked(true);
      return;
    }
    // Chiave per utente: se in una stessa scheda si alternano due account, il
    // flag del primo non deve zittire il saluto del secondo.
    const shownKey = `${MEMORY_GREETING_SHOWN_KEY}:${user.id}`;
    // Controllo prima della fetch: se il saluto è già stato dato in questa
    // sessione non serve nemmeno leggere i dati personali dalla memoria.
    try {
      if (window.sessionStorage.getItem(shownKey)) {
        setMemoryChecked(true);
        return;
      }
    } catch {
      // sessionStorage negato (Safari in privata, storage pieno): si prosegue,
      // al massimo il saluto si ripete come prima.
    }
    setMemoryChecked(true);
    (async () => {
      try {
        const res = await fetch("/api/memory");
        const { memory } = await res.json();
        if (!memory?.last_service_slug) return;
        // Memoria stantia: meglio il saluto neutro che un contesto sbagliato.
        const updatedAt = memory.updated_at ? Date.parse(memory.updated_at) : NaN;
        if (
          Number.isNaN(updatedAt) ||
          Date.now() - updatedAt > MEMORY_GREETING_TTL_MS
        ) {
          return;
        }
        const svc = services.find((s) => s.slug === memory.last_service_slug);
        if (!svc) return;
        const city = cities.find((c) => c.slug === memory.last_city_slug);
        bobSay(
          `Bentornato! L'ultima volta cercavi ${withArticle(svc)}${
            city ? ` a ${city.name}` : ""
          }. Ti serve di nuovo, o hai un problema diverso? Raccontami pure.`
        );
        try {
          window.sessionStorage.setItem(shownKey, "1");
        } catch {
          // vedi sopra: il flag è un'ottimizzazione, non una precondizione
        }
      } catch {
        // memoria non disponibile: il saluto standard basta
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryChecked, user, role, step, messages.length]);

  // Indirizzi salvati nell'account: proposti come scorciatoia al passo città.
  useEffect(() => {
    if (!user || role !== "customer") {
      setSavedAddresses([]);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("customer_addresses")
        .select("id,label,address_line,city_slug,is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      setSavedAddresses((data as SavedAddress[]) ?? []);
    })();
  }, [user, role]);

  // Salva il draft a ogni cambiamento rilevante.
  useEffect(() => {
    if (step === "intent") return;
    try {
      const draft: ChatDraft = {
        savedAt: Date.now(),
        step,
        // le anteprime foto sono data-URL pesanti: restano fuori dal draft
        messages: messages.map(({ from, text }) => ({ from, text })),
        brief,
        collected,
        subtaskOptions,
        results,
        selectedIds: Array.from(selected),
        waitlistCity,
        briefId,
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // quota piena o storage negato: la chat funziona comunque
    }
  }, [step, messages, brief, collected, subtaskOptions, results, selected, waitlistCity, briefId]);

  function bobSay(text: string) {
    setMessages((m) => [...m, { from: "bob", text }]);
  }
  function userSay(text: string, imageUrl?: string) {
    setMessages((m) => [...m, { from: "user", text, imageUrl }]);
  }

  // Costruisce la cronologia in formato neutro per l'API (solo testo:
  // l'eventuale foto viaggia solo sul messaggio corrente).
  function historyFor(extraUser: string, photo: PendingPhoto | null): BobMessage[] {
    const base: BobMessage[] = messages.map((m) => ({
      role: m.from,
      content: m.imageUrl ? `${m.text} (ho allegato una foto)` : m.text,
    }));
    base.push({
      role: "user",
      content: extraUser,
      ...(photo
        ? { imageBase64: photo.base64, imageMediaType: photo.mediaType }
        : {}),
    });
    return base;
  }

  // Ridimensiona e ri-codifica la foto in JPEG via canvas:
  // il re-encoding elimina anche i metadati EXIF (incluso il GPS).
  async function handlePhotoFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("img"));
        img.src = url;
      });
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setPendingPhoto({
        base64: dataUrl.split(",")[1] ?? "",
        mediaType: "image/jpeg",
        preview: dataUrl,
      });
    } catch {
      // foto non leggibile: ignora
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ----- conversazione intelligente con Bob -----
  async function sendToBob(text: string) {
    const clean = text.trim();
    if ((!clean && !pendingPhoto) || thinking) return;
    const photo = pendingPhoto;
    const content = clean || "Ecco una foto del problema.";
    userSay(content, photo?.preview);
    setInput("");
    setPendingPhoto(null);
    setThinking(true);

    try {
      const res = await fetch("/api/bob/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyFor(content, photo),
          brief,
        }),
      });
      const data = await res.json();
      const b: JobBrief = data.brief ?? brief;
      setBrief(b);
      if (Array.isArray(data.subtaskOptions)) {
        setSubtaskOptions(data.subtaskOptions as SubtaskOption[]);
      }

      const svc = b.serviceSlug
        ? services.find((s) => s.slug === b.serviceSlug)
        : undefined;
      setCollected((c) => ({
        ...c,
        serviceSlug: b.serviceSlug,
        serviceName: svc?.name,
        severity: b.severity,
        summary: b.summary,
      }));

      bobSay(data.reply ?? "Raccontami meglio cosa ti serve.");

      if (data.next === "city") {
        setStep("city");
      } else {
        setStep("chat");
      }
    } catch {
      bobSay(
        "Ho avuto un intoppo nel ragionare. Riprova a scrivermi cosa ti serve."
      );
      setStep("chat");
    } finally {
      setThinking(false);
    }
  }

  // Correzioni one-tap dalla recap card (source: option_click).
  function correctSubtask(opt: SubtaskOption) {
    setBrief((b) => ({
      ...b,
      subtaskSlug: opt.slug,
      fieldMeta: {
        ...b.fieldMeta,
        subtaskSlug: { confidence: "high", source: "option_click" },
      },
    }));
    setEditingSubtask(false);
  }

  function correctSeverity(sev: Severity) {
    setBrief((b) => ({
      ...b,
      severity: sev,
      fieldMeta: {
        ...b.fieldMeta,
        severity: { confidence: "high", source: "option_click" },
      },
    }));
    setCollected((c) => ({ ...c, severity: sev }));
  }

  // L'homepage parla ai clienti: chi offre un servizio ha la sua porta
  // dedicata (link sotto l'input → /per-i-professionisti).
  function pickIntent() {
    userSay("Sto cercando un servizio");
    bobSay(
      "Perfetto. Raccontami cosa succede con parole tue: più dettagli mi dai, meglio capisco di cosa hai bisogno. Oppure scegli un servizio qui sotto."
    );
    setStep("chat");
  }

  // L'utente sceglie un servizio dai chip: saltiamo direttamente alla città.
  function pickService(slug: string, name: string) {
    userSay(name);
    setBrief((b) => ({
      ...b,
      serviceSlug: slug,
      fieldMeta: {
        ...b.fieldMeta,
        serviceSlug: { confidence: "high", source: "option_click" },
      },
    }));
    setCollected((c) => ({ ...c, serviceSlug: slug, serviceName: name }));
    bobSay(`Ottimo, ${name.toLowerCase()}. In che città ti serve?`);
    setStep("city");
  }

  function pickCity(slug: string, name: string, active: boolean) {
    userSay(name);
    if (!active) {
      // Niente dirottamento silenzioso su Milano: offriamo l'avviso email
      // (la waitlist esiste già per /citta/[slug]) e, in alternativa
      // esplicita, i professionisti di Milano.
      setWaitlistCity({ slug, name });
      bobSay(
        `${name} è in arrivo: non ho ancora professionisti attivi lì. Lasciami la tua email e ti avviso appena apro a ${name}. Oppure, se il problema non aspetta, continua con i professionisti di Milano.`
      );
      setStep("waitlist");
      return;
    }
    setBrief((b) => ({ ...b, citySlug: slug }));
    setCollected((c) => ({ ...c, citySlug: slug, cityName: name }));
    askZoneOrUrgency(slug);
  }

  // Il quartiere serve al professionista per valutare la trasferta senza sapere
  // via e civico (mig 045). È facoltativo e per ora esiste solo su Milano: dove
  // non c'è un elenco si tira dritto, la chat non deve inventare passaggi.
  function askZoneOrUrgency(citySlug: string) {
    if (zonesForCity(citySlug).length > 0) {
      bobSay(
        "In che zona? Serve al professionista per capire la distanza — l'indirizzo esatto glielo dai solo dopo, quando scegli lui."
      );
      setStep("zone");
      return;
    }
    bobSay("Quando ti servirebbe?");
    setStep("urgency");
  }

  function pickZone(slug: string, label: string) {
    userSay(label);
    setCollected((c) => ({ ...c, zoneSlug: slug }));
    bobSay("Quando ti servirebbe?");
    setStep("urgency");
  }

  // Il ripiego non è "niente": è il CAP. Se il cliente non riconosce i nomi dei
  // quartieri, cinque cifre danno al professionista la stessa grana e le sanno
  // tutti. Restare senza è comunque possibile — la posizione non è obbligatoria.
  function askCap() {
    userSay("Non conosco la zona");
    bobSay("Nessun problema: mi dici il CAP? Bastano le cinque cifre.");
    setStep("cap");
  }

  function submitCap() {
    const cap = capInput.trim();
    if (!/^[0-9]{5}$/.test(cap)) {
      setCapError("Il CAP è di cinque cifre, per esempio 20159.");
      return;
    }
    setCapError(null);
    userSay(cap);
    setCollected((c) => ({ ...c, postalCode: cap }));
    bobSay("Quando ti servirebbe?");
    setStep("urgency");
  }

  function skipLocation() {
    userSay("Preferisco non dirlo");
    bobSay(
      "Va bene, il professionista vedrà solo la città. Quando ti servirebbe?"
    );
    setStep("urgency");
  }

  // Scorciatoia dal passo città: un indirizzo salvato porta con sé la città
  // e finisce nel messaggio al professionista.
  function pickSavedAddress(a: SavedAddress) {
    const city = cities.find((c) => c.slug === a.city_slug);
    userSay(`${a.label} — ${a.address_line}${city ? `, ${city.name}` : ""}`);
    setCollected((c) => ({ ...c, address: a.address_line }));
    if (!city) {
      bobSay("Per questo indirizzo non ho una città: dimmi tu dove.");
      return; // resta sul passo città
    }
    if (city.status !== "active") {
      setWaitlistCity({ slug: city.slug, name: city.name });
      bobSay(
        `${city.name} è in arrivo: non ho ancora professionisti attivi lì. Lasciami la tua email e ti avviso appena apro a ${city.name}. Oppure, se il problema non aspetta, continua con i professionisti di Milano.`
      );
      setStep("waitlist");
      return;
    }
    setBrief((b) => ({ ...b, citySlug: city.slug }));
    setCollected((c) => ({
      ...c,
      address: a.address_line,
      citySlug: city.slug,
      cityName: city.name,
    }));
    askZoneOrUrgency(city.slug);
  }

  // Alternativa esplicita dalla waitlist: prosegue il flusso su Milano.
  function continueWithMilano() {
    userSay("Continua con Milano");
    setBrief((b) => ({ ...b, citySlug: "milano" }));
    setCollected((c) => ({ ...c, citySlug: "milano", cityName: "Milano" }));
    bobSay("Va bene, ti mostro i professionisti di Milano. Quando ti servirebbe?");
    setStep("urgency");
  }

  function pickUrgency(label: string, value: Severity, briefValue: BriefUrgency) {
    userSay(label);
    setBrief((b) => ({ ...b, urgency: briefValue }));
    setCollected((c) => ({ ...c, urgency: value }));
    bobSay(
      "Hai già un budget in mente? Se ce l'hai dimmelo, così filtro i professionisti adatti. Altrimenti nessun problema: posso chiedere dei preventivi per te."
    );
    setStep("budget");
  }

  // [F2] Aggiorna la memoria cliente a fine ricerca (best-effort).
  async function saveMemory(next: Collected) {
    if (!user || role !== "customer" || !next.serviceSlug) return;
    try {
      const res = await fetch("/api/memory");
      const { memory } = await res.json();
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastServiceSlug: next.serviceSlug,
          lastCitySlug: next.citySlug ?? null,
          lastBudgetLabel: next.budgetLabel ?? null,
          preferredUrgency: next.urgency ?? null,
          searchCount: (memory?.search_count ?? 0) + 1,
        }),
      });
    } catch {
      // best-effort: la ricerca non dipende dalla memoria
    }
  }

  // Trasparenza del match: una riga che spiega perché il professionista
  // è proposto (primo passo verso il ranking spiegabile, workstream #11).
  function whyThisPro(p: ProfessionalCard): string {
    const reasons: string[] = [];
    if (p.verificationStatus === "verified") reasons.push("profilo verificato");
    if (p.nRatings > 0 && (p.avgRating ?? 0) >= 4.5)
      reasons.push(`recensioni ottime (${p.avgRating})`);
    if (collected.maxPrice && p.maxPrice && p.maxPrice <= collected.maxPrice)
      reasons.push("nel tuo budget");
    if (p.responseTimeLabel) reasons.push(p.responseTimeLabel.toLowerCase());
    return reasons.length
      ? `Perché te lo propongo: ${reasons.slice(0, 3).join(" · ")}`
      : "";
  }

  async function runSearch(next: Collected) {
    setCollected(next);
    saveMemory(next);
    setStep("results");
    setSelected(new Set());
    setLoadingResults(true);

    // Salva il job brief completato (best-effort, non blocca la ricerca).
    const finalBrief: JobBrief = {
      ...brief,
      citySlug: next.citySlug ?? brief.citySlug,
      budgetMin: next.budgetMin ?? null,
      budgetMax: next.budgetMax ?? null,
      budgetFlexible: next.wantsQuotes ?? false,
    };
    setBrief(finalBrief);
    fetch("/api/bob/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: finalBrief }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.id) setBriefId(d.id as string);
      })
      .catch(() => {});

    const params = new URLSearchParams();
    if (next.citySlug) params.set("city", next.citySlug);
    if (next.serviceSlug) params.set("service", next.serviceSlug);
    if (next.maxPrice) params.set("maxPrice", String(next.maxPrice));

    try {
      const res = await fetch(`/api/match?${params.toString()}`);
      const json = await res.json();
      const pros = (json.professionals ?? []) as ProfessionalCard[];
      setResults(pros);
      if (pros.length === 0) {
        bobSay(
          "Non ho ancora un professionista che combaci con questi criteri. Puoi sfogliare tutti i professionisti disponibili qui sotto."
        );
      } else if (next.wantsQuotes) {
        bobSay(
          `Ho trovato ${pros.length} ${
            pros.length === 1 ? "professionista adatto" : "professionisti adatti"
          }. Seleziona quelli che ti interessano e chiedo io un preventivo a ciascuno: confronti i prezzi con calma.`
        );
      } else {
        bobSay(
          `Ecco ${pros.length} ${
            pros.length === 1 ? "professionista" : "professionisti"
          } nel tuo budget. Apri un profilo per i dettagli, oppure invia subito un messaggio: te lo preparo io.`
        );
      }
    } catch {
      bobSay("Ho avuto un problema a recuperare i professionisti. Riprova tra poco.");
    } finally {
      setLoadingResults(false);
    }
  }

  function pickBudget(opt: (typeof BUDGET_OPTIONS)[number]) {
    userSay(opt.label);
    runSearch({
      ...collected,
      budgetLabel: opt.label,
      budgetMin: opt.min,
      budgetMax: opt.max,
      maxPrice: opt.maxPrice,
      wantsQuotes: false,
    });
  }

  function pickNoBudget() {
    userSay("Non ho un budget, chiedi tu dei preventivi");
    runSearch({
      ...collected,
      budgetLabel: undefined,
      budgetMin: null,
      budgetMax: null,
      maxPrice: undefined,
      wantsQuotes: true,
    });
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function restart() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // storage negato: ignora
    }
    setStep("intent");
    setBrief(EMPTY_BRIEF);
    setSubtaskOptions([]);
    setEditingSubtask(false);
    setPendingPhoto(null);
    setWaitlistCity(null);
    setBriefId(null);
    setCollected({});
    setResults([]);
    setSelected(new Set());
    setMessages([
      {
        from: "bob",
        text: "Ricominciamo. Ti aiuto a trovare un servizio o vuoi offrirne uno?",
      },
    ]);
  }

  const selectedPros = results.filter((p) => selected.has(p.id));

  // Il servizio dal catalogo porta genere e numero: serve per l'articolo
  // ("delle pulizie", non "un pulizie"). Se manca, si ripiega sul solo nome.
  const prefillService = collected.serviceSlug
    ? services.find((s) => s.slug === collected.serviceSlug)
    : undefined;
  const prefillNeedPhrase = prefillService
    ? afterDi(prefillService)
    : collected.serviceName
      ? `di ${collected.serviceName.toLowerCase()}`
      : undefined;

  const bobPrefill = collected.serviceName
    ? `Ciao, ho bisogno ${prefillNeedPhrase} a ${
        collected.cityName ?? "Milano"
      }.${collected.summary ? ` ${collected.summary}.` : ""}${
        collected.budgetLabel
          ? ` Il mio budget indicativo è ${collected.budgetLabel}.`
          : ""
      } Sei disponibile?`
    : "";
  // (41.1) L'indirizzo NON entra nel messaggio: cinque professionisti leggevano
  // via e civico prima che il cliente ne scegliesse uno. Viaggia separato e la
  // migrazione 044 lo apre solo a chi ha un appuntamento confermato.

  return (
    <div
      className={`card overflow-hidden ${compact ? "" : "shadow-card-hover"}`}
      data-testid="bob-chat"
    >
      {/* intestazione chat */}
      <div className="flex items-center gap-3 border-b border-black/5 bg-bob-indigo px-5 py-3.5 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg font-black">
          B
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Bob</p>
          <p className="text-xs text-white/70">Il tuo concierge dei servizi</p>
        </div>
        {step !== "intent" && (
          <button
            onClick={restart}
            className="ml-auto rounded-lg px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/10"
            data-testid="button-restart"
          >
            Ricomincia
          </button>
        )}
      </div>

      {/* corpo */}
      <div
        ref={scrollRef}
        className="flex max-h-[460px] min-h-[280px] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] animate-fade-up whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
                m.from === "user"
                  ? "rounded-br-sm bg-bob-indigo text-white"
                  : "rounded-bl-sm bg-bob-indigo-50 text-bob-ink"
              }`}
            >
              {m.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imageUrl}
                  alt="Foto del problema"
                  className="mb-2 max-h-40 rounded-xl object-cover"
                />
              )}
              {m.text}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-bob-indigo-50 px-4 py-3 text-sm text-bob-ink/60">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-bob-indigo/50 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-bob-indigo/50 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-bob-indigo/50" />
              </span>
            </div>
          </div>
        )}

        {/* recap card: cosa Bob ha capito, correggibile con un tap */}
        {step !== "intent" && step !== "chat" && brief.serviceSlug && (
          <div
            className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm"
            data-testid="brief-recap"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bob-ink/40">
              Ecco cosa ho capito
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {collected.serviceName && (
                <span className="chip bg-bob-indigo-50 text-bob-indigo">
                  {collected.serviceName}
                </span>
              )}
              {brief.subtaskSlug && !editingSubtask && (
                <button
                  onClick={() =>
                    subtaskOptions.length > 0 && setEditingSubtask(true)
                  }
                  className="chip bg-bob-indigo-50 text-bob-indigo hover:bg-bob-indigo-100"
                  data-testid="chip-subtask"
                  title="Tocca per correggere"
                >
                  {subtaskOptions.find((o) => o.slug === brief.subtaskSlug)
                    ?.name ?? brief.subtaskSlug}
                  {subtaskOptions.length > 0 && (
                    <span className="ml-1 text-bob-indigo/50">✎</span>
                  )}
                </button>
              )}
              {collected.cityName && (
                <span className="chip bg-bob-indigo-50 text-bob-indigo">
                  {collected.cityName}
                </span>
              )}
            </div>
            {editingSubtask && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {subtaskOptions.map((o) => (
                  <button
                    key={o.slug}
                    onClick={() => correctSubtask(o)}
                    className={`chip ${
                      o.slug === brief.subtaskSlug
                        ? "bg-bob-indigo text-white"
                        : "hover:bg-bob-indigo-100"
                    }`}
                    data-testid={`chip-subtask-${o.slug}`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["alta", "media", "bassa"] as Severity[]).map((sev) => (
                <button
                  key={sev}
                  onClick={() => correctSeverity(sev)}
                  className={`chip text-xs ${
                    brief.severity === sev
                      ? "bg-bob-indigo text-white"
                      : "text-bob-ink/50 hover:bg-bob-indigo-100"
                  }`}
                  data-testid={`chip-severity-${sev}`}
                >
                  {SEVERITY_LABELS[sev]}
                </button>
              ))}
            </div>
            {brief.photos.length > 0 && brief.photos[0].aiCaption && (
              <p className="mt-2 flex items-start gap-1 text-xs text-bob-ink/50">
                <Camera className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{brief.photos[0].aiCaption}</span>
              </p>
            )}
          </div>
        )}

        {/* città non attiva: waitlist inline al posto del dirottamento */}
        {step === "waitlist" && waitlistCity && (
          <div
            className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm"
            data-testid="chat-waitlist"
          >
            <CityWaitlistForm
              citySlug={waitlistCity.slug}
              cityName={waitlistCity.name}
            />
          </div>
        )}

        {/* risultati professionisti dentro la chat */}
        {step === "results" && results.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1">
            {results.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border bg-white p-3.5 shadow-sm transition-colors ${
                    collected.wantsQuotes && isSelected
                      ? "border-bob-indigo ring-1 ring-bob-indigo"
                      : "border-black/5"
                  }`}
                  data-testid={`chat-result-${p.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {collected.wantsQuotes && (
                        <button
                          onClick={() => toggleSelect(p.id)}
                          aria-label={isSelected ? "Deseleziona" : "Seleziona"}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isSelected
                              ? "border-bob-indigo bg-bob-indigo text-white"
                              : "border-black/20 bg-white"
                          }`}
                          data-testid={`select-pro-${p.id}`}
                        >
                          {isSelected && (
                            <svg
                              className="h-3.5 w-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-bob-ink">
                          {p.fullName}
                        </p>
                        <p className="truncate text-xs text-bob-ink/60">
                          {p.headline}
                        </p>
                      </div>
                    </div>
                    <PriceTag min={p.minPrice} max={p.maxPrice} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Stars value={p.avgRating} count={p.nRatings} />
                    <VerificationLevelBadge
                      level={p.verificationLevel}
                      verifiedAt={p.verifiedAt}
                      compact
                    />
                  </div>
                  {whyThisPro(p) && (
                    <p className="mt-1.5 text-[11px] text-bob-ink/45">
                      {whyThisPro(p)}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/professionisti/${p.id}`}
                      className="btn-secondary flex-1 py-2 text-xs"
                    >
                      Vedi profilo
                    </Link>
                    {collected.wantsQuotes ? (
                      <button
                        onClick={() => toggleSelect(p.id)}
                        className={`flex-1 py-2 text-xs ${
                          isSelected ? "btn-secondary" : "btn-primary"
                        }`}
                        data-testid={`button-toggle-${p.id}`}
                      >
                        {isSelected ? "Selezionato ✓" : "Aggiungi al preventivo"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setRequestFor(p)}
                        className="btn-primary flex-1 py-2 text-xs"
                        data-testid={`button-contact-${p.id}`}
                      >
                        Invia messaggio
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === "results" && !loadingResults && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-bob-indigo/30 bg-bob-indigo-50/50 p-4 text-center">
            <p className="text-xs text-bob-ink/60">
              Sfoglia tutti i{" "}
              <Link href="/professionisti" className="underline">
                professionisti disponibili
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      {/* area input / scelte rapide */}
      <div className="border-t border-black/5 bg-white px-4 py-3.5 sm:px-5">
        {step === "intent" && (
          <div className="space-y-2.5">
            {/* La promessa dell'hero è "Raccontami il problema": l'input di
                testo è disponibile da subito. Scrivere implica l'intento
                cliente, quindi si entra direttamente nella conversazione. */}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !thinking && sendToBob(input)
                }
                placeholder="Es. perde il rubinetto della cucina…"
                className="input-bob py-2.5"
                disabled={thinking}
                data-testid="input-intent-problem"
              />
              <button
                onClick={() => sendToBob(input)}
                className="btn-primary py-2.5"
                disabled={thinking || !input.trim()}
                data-testid="button-intent-send"
              >
                Invia
              </button>
            </div>
            <button
              onClick={() => pickIntent()}
              className="btn-secondary w-full py-2.5"
              data-testid="button-intent-client"
            >
              Scegli tu il servizio
            </button>
            <p className="text-center text-xs text-bob-ink/45">
              Sei un professionista?{" "}
              <Link
                href="/per-i-professionisti"
                className="font-medium text-bob-indigo hover:underline"
                data-testid="link-intent-pro"
              >
                Scopri come funziona per chi lavora →
              </Link>
            </p>
          </div>
        )}

        {step === "chat" && (
          <div className="space-y-3">
            {pendingPhoto && (
              <div className="flex items-center gap-2 rounded-xl bg-bob-indigo-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingPhoto.preview}
                  alt="Anteprima foto"
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <p className="flex-1 text-xs text-bob-ink/60">
                  Foto pronta: aggiungi due parole o invia direttamente.
                </p>
                <button
                  onClick={() => setPendingPhoto(null)}
                  className="rounded-lg px-2 py-1 text-xs text-bob-ink/50 hover:bg-white"
                  aria-label="Rimuovi foto"
                  data-testid="button-remove-photo"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoFile(f);
                  e.target.value = "";
                }}
                data-testid="input-photo"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary shrink-0 px-3 py-2.5"
                disabled={thinking}
                aria-label="Allega una foto del problema"
                title="Allega una foto del problema"
                data-testid="button-photo"
              >
                <Camera className="h-5 w-5" aria-hidden="true" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !thinking && sendToBob(input)
                }
                placeholder="Es. esce acqua dal soffitto del bagno…"
                className="input-bob py-2.5"
                disabled={thinking}
                data-testid="input-problem"
              />
              <button
                onClick={() => sendToBob(input)}
                className="btn-primary py-2.5"
                disabled={thinking || (!input.trim() && !pendingPhoto)}
                data-testid="button-send"
              >
                Invia
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {services.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickService(s.slug, s.name)}
                  className="chip hover:bg-bob-indigo-100"
                  disabled={thinking}
                  data-testid={`chip-service-${s.slug}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "city" && (
          <div className="space-y-2">
            {savedAddresses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {savedAddresses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => pickSavedAddress(a)}
                    className="chip inline-flex items-center gap-1 hover:bg-bob-indigo-100"
                    title={a.address_line}
                    data-testid={`chip-address-${a.id}`}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {a.label}
                    {a.is_default ? " ✓" : ""}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickCity(c.slug, c.name, c.status === "active")}
                  className="btn-secondary flex-1 py-2.5"
                  data-testid={`button-city-${c.slug}`}
                >
                  {c.name}
                  {c.status !== "active" && (
                    <span className="ml-1 text-[10px] text-bob-ink/40">soon</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "waitlist" && (
          <button
            onClick={continueWithMilano}
            className="btn-secondary w-full py-2.5"
            data-testid="button-continue-milano"
          >
            Continua con i professionisti di Milano →
          </button>
        )}

        {step === "zone" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {zonesForCity(collected.citySlug).map((z) => (
                <button
                  key={z.slug}
                  onClick={() => pickZone(z.slug, z.label)}
                  className="chip hover:bg-bob-indigo-100"
                  data-testid={`chip-zone-${z.slug}`}
                >
                  {z.label}
                </button>
              ))}
            </div>
            <button
              onClick={askCap}
              className="text-xs text-slate-500 underline hover:text-bob-indigo"
              data-testid="chip-zone-skip"
            >
              Non conosco la zona
            </button>
          </div>
        )}

        {step === "cap" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={capInput}
                onChange={(e) => setCapInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCap();
                }}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="20159"
                aria-label="CAP"
                className="w-28 rounded-xl border border-black/10 px-3 py-2 text-sm"
                data-testid="input-cap"
              />
              <button
                onClick={submitCap}
                className="btn-primary text-sm"
                data-testid="btn-cap"
              >
                Continua
              </button>
              <button
                onClick={skipLocation}
                className="text-xs text-slate-500 underline hover:text-bob-indigo"
                data-testid="chip-cap-skip"
              >
                Preferisco non dirlo
              </button>
            </div>
            {capError && (
              <p className="text-xs text-red-600" role="alert">
                {capError}
              </p>
            )}
          </div>
        )}

        {step === "urgency" && (
          <div className="grid grid-cols-2 gap-2">
            {URGENCY_OPTIONS.map((u) => (
              <button
                key={u.label}
                onClick={() => pickUrgency(u.label, u.value, u.brief)}
                className="btn-secondary py-2.5 text-sm"
                data-testid={`button-urgency-${u.label}`}
              >
                {u.label}
              </button>
            ))}
          </div>
        )}

        {step === "budget" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {BUDGET_OPTIONS.map((b) => (
                <button
                  key={b.label}
                  onClick={() => pickBudget(b)}
                  className="chip hover:bg-bob-indigo-100"
                  data-testid={`button-budget-${b.label}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <button
              onClick={pickNoBudget}
              className="btn-primary w-full py-2.5 text-sm"
              data-testid="button-no-budget"
            >
              Non ho un budget · chiedi preventivi
            </button>
          </div>
        )}

        {step === "results" && (
          <div className="space-y-2">
            {collected.wantsQuotes && results.length > 0 && (
              <button
                onClick={() => setQuoteOpen(true)}
                disabled={selectedPros.length === 0}
                className="btn-primary w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="button-request-quotes"
              >
                {selectedPros.length === 0
                  ? "Seleziona almeno un professionista"
                  : `Chiedi un preventivo a ${selectedPros.length} ${
                      selectedPros.length === 1
                        ? "professionista"
                        : "professionisti"
                    }`}
              </button>
            )}
            <Link
              href="/professionisti"
              className="btn-ghost w-full justify-center"
            >
              Vedi tutti i professionisti →
            </Link>
          </div>
        )}
      </div>

      {/* invio messaggio singolo (modalità budget) */}
      {requestFor && (
        <RequestDialog
          professional={requestFor}
          prefilledMessage={bobPrefill}
          context={{
            citySlug: collected.citySlug,
            serviceSlug: collected.serviceSlug ?? undefined,
            problem: collected.summary ?? undefined,
            urgency: collected.urgency,
            budgetMin: collected.budgetMin ?? null,
            budgetMax: collected.budgetMax ?? null,
            briefId,
          }}
          onClose={() => setRequestFor(null)}
        />
      )}

      {/* invio richieste di preventivo multiple (modalità senza budget) */}
      {quoteOpen && (
        <QuoteDialog
          professionals={selectedPros}
          context={{
            citySlug: collected.citySlug,
            cityName: collected.cityName,
            serviceSlug: collected.serviceSlug ?? undefined,
            serviceName: collected.serviceName,
            serviceNeedPhrase: prefillNeedPhrase,
            problem: collected.summary || undefined,
            urgency: collected.urgency,
            briefId,
            // (41.1) fuori dalla prosa, dentro request_addresses
            address: collected.address ?? null,
            // (045/046) posizione grossolana, visibile ai pro prima della scelta
            zoneSlug: collected.zoneSlug ?? null,
            postalCode: collected.postalCode ?? null,
          }}
          onClose={() => setQuoteOpen(false)}
        />
      )}
    </div>
  );
}
