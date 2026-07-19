// API: cura del catalogo prenotazione diretta per un subservice.
// Solo admin. subservices non ha policy di scrittura (solo lettura pubblica),
// quindi l'aggiornamento passa dal service-role client dopo il controllo ruolo.
// PATCH /api/admin/subservices/[id]
// Body: { instant_book_eligible?, default_rate_unit?, booking_fields? }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const RATE_UNITS = ["hour", "m2", "job", "session"] as const;
const FIELD_TYPES = ["number", "select", "bool", "text"] as const;

type RateUnit = (typeof RATE_UNITS)[number];

interface BookingFieldInput {
  key?: unknown;
  label?: unknown;
  type?: unknown;
  unit?: unknown;
  required?: unknown;
  is_billable_unit?: unknown;
  options?: unknown;
  help?: unknown;
}

// Valida e normalizza booking_fields. Ritorna [normalizzati, errore].
function normalizeBookingFields(
  raw: unknown
): [Record<string, unknown>[] | null, string | null] {
  if (!Array.isArray(raw)) return [null, "booking_fields deve essere un array."];

  const out: Record<string, unknown>[] = [];
  const seenKeys = new Set<string>();
  let billableCount = 0;

  for (const item of raw as BookingFieldInput[]) {
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const type = String(item.type);

    if (!key) return [null, "Ogni campo deve avere una chiave (key)."];
    if (!/^[a-z0-9_]+$/.test(key))
      return [null, `Chiave non valida: "${key}" (usa minuscole, numeri, underscore).`];
    if (seenKeys.has(key)) return [null, `Chiave duplicata: "${key}".`];
    seenKeys.add(key);
    if (!label) return [null, `Il campo "${key}" deve avere un'etichetta.`];
    if (!FIELD_TYPES.includes(type as (typeof FIELD_TYPES)[number]))
      return [null, `Tipo non valido per "${key}": ${type}.`];

    const isBillable = item.is_billable_unit === true;
    if (isBillable) billableCount += 1;

    let options: string[] | undefined;
    if (type === "select") {
      if (!Array.isArray(item.options) || item.options.length === 0)
        return [null, `Il campo select "${key}" deve avere delle opzioni.`];
      options = (item.options as unknown[]).map((o) => String(o));
    }

    out.push({
      key,
      label,
      type,
      ...(typeof item.unit === "string" && item.unit.trim()
        ? { unit: item.unit.trim() }
        : {}),
      required: item.required === true,
      is_billable_unit: isBillable,
      ...(options ? { options } : {}),
      ...(typeof item.help === "string" && item.help.trim()
        ? { help: item.help.trim() }
        : {}),
    });
  }

  if (out.length > 0 && billableCount !== 1)
    return [
      null,
      `Serve esattamente un campo con is_billable_unit = true (trovati: ${billableCount}).`,
    ];

  return [out, null];
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (userRow?.role !== "admin") {
    return NextResponse.json(
      { error: "Solo l'admin può modificare il catalogo" },
      { status: 403 }
    );
  }

  let body: {
    instant_book_eligible?: unknown;
    default_rate_unit?: unknown;
    booking_fields?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.instant_book_eligible !== undefined) {
    if (typeof body.instant_book_eligible !== "boolean")
      return NextResponse.json(
        { error: "instant_book_eligible deve essere booleano." },
        { status: 400 }
      );
    patch.instant_book_eligible = body.instant_book_eligible;
  }

  if (body.default_rate_unit !== undefined) {
    const u = body.default_rate_unit;
    if (u !== null && !RATE_UNITS.includes(u as RateUnit))
      return NextResponse.json(
        { error: "default_rate_unit non valido." },
        { status: 400 }
      );
    patch.default_rate_unit = u;
  }

  if (body.booking_fields !== undefined) {
    const [fields, err] = normalizeBookingFields(body.booking_fields);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    patch.booking_fields = fields;
  }

  // Coerenza: se resta idoneo con campi, serve un campo fatturabile.
  const willBeEligible =
    patch.instant_book_eligible === true ||
    (patch.instant_book_eligible === undefined && body.booking_fields !== undefined);
  if (
    willBeEligible &&
    Array.isArray(patch.booking_fields) &&
    (patch.booking_fields as unknown[]).length === 0
  ) {
    return NextResponse.json(
      { error: "Un servizio idoneo deve avere almeno un campo di prenotazione." },
      { status: 400 }
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nessuna modifica." }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Configurazione server mancante." },
      { status: 500 }
    );
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );

  const { error } = await adminClient
    .from("subservices")
    .update(patch)
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
