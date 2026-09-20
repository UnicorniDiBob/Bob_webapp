"use client";

import { useState } from "react";
import type { QuoteField } from "@/lib/supabase/types";
import type { FieldMeta } from "@/lib/bob";

// Stadio B/C della scheda lavoro (QUOTE_INTAKE_SPEC §5): non un form, una
// conferma. Bob mostra i campi che ha già valorizzato (stadio B, "conferma,
// non chiedere") e poi, dietro un meter onesto, fino a tre campi in più
// (stadio C, sempre saltabile). "Non lo so" è una risposta di prima classe:
// un campo lasciato incerto resta assente da scope, non diventa un numero.

export type Scope = Record<string, string | number | boolean>;

interface SchedaLavoroProps {
  subtaskName: string;
  quoteFields: QuoteField[];
  initialScope: Scope;
  initialFieldMeta: Record<string, FieldMeta>;
  onConfirm: (scope: Scope, fieldMeta: Record<string, FieldMeta>) => void;
}

function fieldVisible(field: QuoteField, scope: Scope): boolean {
  if (!field.ask_if) return true;
  return Object.entries(field.ask_if).every(([k, v]) => scope[k] === v);
}

export function SchedaLavoro({
  subtaskName,
  quoteFields,
  initialScope,
  initialFieldMeta,
  onConfirm,
}: SchedaLavoroProps) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [fieldMeta, setFieldMeta] = useState<Record<string, FieldMeta>>(
    initialFieldMeta
  );
  const [unknownKeys, setUnknownKeys] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<"confirm" | "precision">("confirm");
  const [precisionOpen, setPrecisionOpen] = useState(false);

  function isGuess(key: string): boolean {
    return scope[key] !== undefined && fieldMeta[key]?.source !== "option_click";
  }

  function setValue(
    key: string,
    value: string | number | boolean,
    confidence: FieldMeta["confidence"] = "high"
  ) {
    setScope((s) => ({ ...s, [key]: value }));
    setFieldMeta((m) => ({ ...m, [key]: { confidence, source: "option_click" } }));
    setUnknownKeys((u) => {
      if (!u.has(key)) return u;
      const n = new Set(u);
      n.delete(key);
      return n;
    });
  }

  function markUnknown(key: string) {
    setScope((s) => {
      if (!(key in s)) return s;
      const n = { ...s };
      delete n[key];
      return n;
    });
    setUnknownKeys((u) => new Set(u).add(key));
  }

  // Stadio B: obbligatori (§1, layer 0-2) + qualunque opzionale che Bob ha
  // già ipotizzato. Stadio C: il resto, fino a tre — la spec vieta più di
  // sei campi in tutto, quindi qui non serve un secondo tetto.
  const visibleFields = quoteFields.filter((f) => fieldVisible(f, scope));
  const requiredFields = visibleFields.filter((f) => f.required);
  const knownOptionalFields = visibleFields.filter(
    (f) => !f.required && scope[f.key] !== undefined
  );
  const stageBFields = [...requiredFields, ...knownOptionalFields];
  const stageBKeys = new Set(stageBFields.map((f) => f.key));
  const stageCFields = visibleFields
    .filter((f) => !stageBKeys.has(f.key))
    .slice(0, 3);

  const trackedFields = [...stageBFields, ...stageCFields];
  const filledCount = trackedFields.filter(
    (f) => scope[f.key] !== undefined
  ).length;
  const precisionPercent =
    trackedFields.length > 0
      ? Math.round((filledCount / trackedFields.length) * 100)
      : 100;

  function finish() {
    onConfirm(scope, fieldMeta);
  }

  function confirmStageB() {
    if (stageCFields.length === 0) {
      finish();
      return;
    }
    setStage("precision");
  }

  return (
    <div
      className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm"
      data-testid="scheda-lavoro"
    >
      <p className="text-2xs font-semibold uppercase tracking-wide text-bob-ink/65">
        Scheda lavoro — {subtaskName}
      </p>
      <p className="mt-1 text-xs text-bob-ink/70">
        Controlla quello che ho capito: tocca un campo per correggerlo.
      </p>

      {stageBFields.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {stageBFields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={scope[f.key]}
              isGuess={isGuess(f.key)}
              isUnknown={unknownKeys.has(f.key)}
              onChange={(v, confidence) => setValue(f.key, v, confidence)}
              onUnknown={() => markUnknown(f.key)}
            />
          ))}
        </div>
      )}

      {stage === "confirm" && (
        <button
          onClick={confirmStageB}
          className="btn-primary mt-3 w-full py-2.5 text-sm"
          data-testid="scheda-confirm"
        >
          Confermo, va bene così
        </button>
      )}

      {stage === "precision" && (
        <div className="mt-3 border-t border-black/5 pt-3">
          <button
            onClick={() => setPrecisionOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl bg-bob-indigo-50 px-3 py-2 text-left text-xs font-medium text-bob-indigo"
            data-testid="scheda-precision-toggle"
          >
            <span>Preventivo preciso al {precisionPercent}%</span>
            <span aria-hidden="true">{precisionOpen ? "–" : "+"}</span>
          </button>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bob-indigo-50">
            <div
              className="h-full rounded-full bg-bob-indigo transition-all"
              style={{ width: `${precisionPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-2xs text-bob-ink/65">
            Più dettagli dai, meno sopralluoghi servono e più stretto è il
            prezzo. Puoi anche saltare.
          </p>

          {precisionOpen && (
            <div className="mt-3 flex flex-col gap-3">
              {stageCFields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  value={scope[f.key]}
                  isGuess={false}
                  isUnknown={unknownKeys.has(f.key)}
                  onChange={(v, confidence) => setValue(f.key, v, confidence)}
                  onUnknown={() => markUnknown(f.key)}
                />
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={finish}
              className="btn-secondary flex-1 py-2.5 text-xs"
              data-testid="scheda-skip"
            >
              Salta, ho fretta
            </button>
            <button
              onClick={finish}
              className="btn-primary flex-1 py-2.5 text-xs"
              data-testid="scheda-continue"
            >
              Continua
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  value,
  isGuess,
  isUnknown,
  onChange,
  onUnknown,
}: {
  field: QuoteField;
  value: string | number | boolean | undefined;
  isGuess: boolean;
  isUnknown: boolean;
  onChange: (
    value: string | number | boolean,
    confidence?: FieldMeta["confidence"]
  ) => void;
  onUnknown: () => void;
}) {
  const [showProxy, setShowProxy] = useState(false);
  const proxy = field.proxy;

  return (
    <div data-testid={`scheda-field-${field.key}`}>
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-bob-ink">{field.label}</p>
        {isGuess && (
          <span
            className="rounded-full bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-amber-700"
            title="Bob ha dedotto questo valore: correggilo se non va bene"
          >
            ipotesi di Bob
          </span>
        )}
      </div>

      {field.type === "select" && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(field.options ?? []).map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`chip ${
                value === opt
                  ? "bg-bob-indigo text-white"
                  : "hover:bg-bob-indigo-100"
              }`}
              data-testid={`scheda-option-${field.key}-${opt}`}
            >
              {opt}
            </button>
          ))}
          {field.unknown_ok && (
            <button
              onClick={onUnknown}
              className={`chip text-bob-ink/65 ${
                isUnknown ? "bg-bob-indigo-50" : "hover:bg-bob-indigo-100"
              }`}
              data-testid={`scheda-unknown-${field.key}`}
            >
              Non lo so
            </button>
          )}
        </div>
      )}

      {field.type === "bool" && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            onClick={() => onChange(true)}
            className={`chip ${
              value === true
                ? "bg-bob-indigo text-white"
                : "hover:bg-bob-indigo-100"
            }`}
            data-testid={`scheda-bool-${field.key}-si`}
          >
            Sì
          </button>
          <button
            onClick={() => onChange(false)}
            className={`chip ${
              value === false
                ? "bg-bob-indigo text-white"
                : "hover:bg-bob-indigo-100"
            }`}
            data-testid={`scheda-bool-${field.key}-no`}
          >
            No
          </button>
          {field.unknown_ok && (
            <button
              onClick={onUnknown}
              className={`chip text-bob-ink/65 ${
                isUnknown ? "bg-bob-indigo-50" : "hover:bg-bob-indigo-100"
              }`}
              data-testid={`scheda-unknown-${field.key}`}
            >
              Non so
            </button>
          )}
        </div>
      )}

      {field.type === "number" && (
        <div className="mt-1.5">
          {showProxy && proxy ? (
            <div className="flex flex-wrap gap-1.5">
              {proxy.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    const derived = proxy.derive[opt];
                    if (typeof derived === "number") onChange(derived, "medium");
                  }}
                  className="chip hover:bg-bob-indigo-100"
                  data-testid={`scheda-proxy-${field.key}-${opt}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                value={typeof value === "number" ? value : ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (e.target.value !== "" && Number.isFinite(n)) onChange(n);
                }}
                className="w-24 rounded-xl border border-black/10 px-3 py-1.5 text-sm"
                data-testid={`scheda-number-${field.key}`}
              />
              {field.unit && (
                <span className="text-xs text-bob-ink/65">{field.unit}</span>
              )}
              {proxy && (
                <button
                  onClick={() => setShowProxy(true)}
                  className="text-xs text-bob-indigo underline"
                  data-testid={`scheda-proxy-toggle-${field.key}`}
                >
                  {proxy.label}
                </button>
              )}
              {!proxy && field.unknown_ok && (
                <button
                  onClick={onUnknown}
                  className="text-xs text-bob-indigo underline"
                  data-testid={`scheda-unknown-${field.key}`}
                >
                  Non lo so
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {field.type === "text" && (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => {
              if (e.target.value.trim()) onChange(e.target.value);
            }}
            className="input-bob flex-1 py-1.5 text-sm"
            data-testid={`scheda-text-${field.key}`}
          />
          {field.unknown_ok && (
            <button
              onClick={onUnknown}
              className="shrink-0 text-xs text-bob-indigo underline"
              data-testid={`scheda-unknown-${field.key}`}
            >
              Non lo so
            </button>
          )}
        </div>
      )}

      {isUnknown && field.photo_prompt && (
        <p className="mt-1 flex items-start gap-1 text-2xs text-bob-ink/65">
          <span aria-hidden="true">📷</span>
          <span>{field.photo_prompt}</span>
        </p>
      )}
    </div>
  );
}
