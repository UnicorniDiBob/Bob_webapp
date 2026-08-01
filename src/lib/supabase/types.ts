// Tipi del database BOB — allineati allo schema Supabase (progetto bijgitnulucdzluqjxrx).

import type { VerificationLevel, VatReviewState } from "@/lib/vat";

export type CityStatus = "active" | "coming_soon";
export type VerificationStatus = "unverified" | "pending" | "verified";
export type UserRole = "customer" | "professional" | "admin" | "cs";
export type SubscriptionTier = "free" | "pro" | "business";
export type MacroRegion = "nord" | "centro" | "sud";

// Prenotazione diretta (instant booking) — vedi docs/Bob_Instant_Booking_Spec.md
export type RateUnit = "hour" | "m2" | "job" | "session";

// Etichette IT per unità di tariffa (billable unit).
export const RATE_UNIT_LABELS: Record<RateUnit, string> = {
  hour: "ora",
  m2: "m²",
  job: "intervento",
  session: "sessione",
};

// Finestra minima di cancellazione imposta dalla piattaforma (mirror del trigger DB).
export const MIN_CANCELLATION_WINDOW_HOURS = 24;

// Un campo del modulo di prenotazione, definito per subservice (catalogo).
// Esattamente un campo per job ha is_billable_unit = true.
export interface BookingField {
  key: string;
  label: string;
  type: "number" | "select" | "bool" | "text";
  unit?: string;
  required: boolean;
  is_billable_unit: boolean;
  options?: string[];
  help?: string;
}

// Limiti foto portfolio per tier (null = illimitato). Fonte di verità: trigger DB.
export const PORTFOLIO_LIMITS: Record<SubscriptionTier, number | null> = {
  free: 0,
  pro: 1,
  business: null,
};
export type RequestStatus =
  | "draft"
  | "sent"
  | "quote_request"
  | "matched"
  | "closed";
export type Urgency = "bassa" | "media" | "alta";

export interface City {
  id: string;
  name: string;
  slug: string;
  status: CityStatus;
  province: string | null;
  region: string | null;
  macro_region: MacroRegion | null;
  created_at: string | null;
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string | null;
  // Concordanza grammaticale (migration 035): il nome del servizio finisce
  // dentro frasi nostre, e "un pulizie" non è italiano. Vedi src/lib/italian.ts.
  gender: "m" | "f";
  is_plural: boolean;
  takes_article: boolean;
}

export interface Subservice {
  id: string;
  service_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string | null;
  // Prenotazione diretta (migration 028/029)
  instant_book_eligible: boolean;
  booking_fields: BookingField[];
  default_rate_unit: RateUnit | null;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  about: string | null;
  created_at: string | null;
}

// Dati sensibili del profilo (migration 027): tabella separata con RLS
// stretta — solo il proprietario e lo staff possono leggerla. Mai esporre
// questi campi su superfici pubbliche.
export interface ProfilePrivate {
  user_id: string;
  date_of_birth: string | null;
  terms_accepted_at: string | null;
  created_at: string | null;
}

export interface Professional {
  id: string;
  user_id: string;
  city_id: string;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  verification_status: VerificationStatus;
  response_time_label: string | null;
  subscription_tier: SubscriptionTier;
  created_at: string | null;
}

export interface PortfolioItem {
  id: string;
  professional_id: string;
  title: string;
  description: string | null;
  image_url: string;
  created_at: string | null;
}

export interface ProfessionalService {
  id: string;
  professional_id: string;
  service_id: string;
  subservice_id: string | null;
  min_price: number | null;
  max_price: number | null;
  price_note: string | null;
  city_id: string;
  // Prenotazione diretta (migration 028)
  instant_book_enabled: boolean;
  rate_amount: number | null;
  rate_unit: RateUnit | null;
  min_units: number | null;
  slot_duration_min: number | null;
  cancellation_window_hours: number | null;
}

export interface Rating {
  id: string;
  professional_id: string;
  customer_id: string;
  score: number;
  comment: string | null;
  created_at: string | null;
}

export interface RequestRow {
  id: string;
  customer_id: string;
  city_id: string;
  service_id: string;
  subservice_id: string | null;
  status: RequestStatus;
  problem_description: string | null;
  urgency: Urgency | null;
  availability_note: string | null;
  budget_min: number | null;
  budget_max: number | null;
  created_at: string | null;
}

// Forma aggregata usata in UI: professionista + profilo + servizio + prezzi + rating.
export interface ProfessionalCard {
  id: string;
  fullName: string;
  headline: string | null;
  bio: string | null;
  yearsExperience: number | null;
  verificationStatus: VerificationStatus;
  /** Livello del blocco 10 già "abbassato" per il pubblico (vedi publicVerificationLevel). */
  verificationLevel: VerificationLevel;
  /** Data del riscontro che ha prodotto il livello: si mostra sempre col badge. */
  verifiedAt: string | null;
  responseTimeLabel: string | null;
  city: { name: string; slug: string };
  serviceName: string | null;
  serviceSlug: string | null;
  // Nome articolato come complemento oggetto ("un idraulico", "delle pulizie").
  serviceWithArticle: string | null;
  // Nome retto da "di", per "ho bisogno ___" ("di un idraulico", "di pulizie"):
  // dopo "di" il partitivo si fonde. Derivati in data.ts, vedi src/lib/italian.ts.
  serviceNeedPhrase: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  priceNote: string | null;
  avgRating: number | null;
  nRatings: number;
}

// ----- Verifica dei professionisti (blocco 10, migration 029 + 034) -----
// La riga completa la vede solo il professionista stesso e lo staff (RLS):
// contiene la partita IVA, che per una ditta individuale è dato personale.
export interface ProfessionalVerification {
  professional_id: string;
  level: VerificationLevel;
  vat_number: string | null;
  vat_checked_at: string | null;
  vat_active: boolean | null;
  vat_holder_name: string | null;
  vat_check_source: string | null;
  documents_checked_at: string | null;
  documents_note: string | null;
  vat_review_state: VatReviewState | null;
  vat_review_note: string | null;
  vat_reviewed_at: string | null;
  updated_at: string;
}

// ----- Messaggi e appuntamenti (aggiunti per dashboard pro e conversazioni) -----

export type AppointmentStatus =
  | "proposed"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "declined";

export interface Appointment {
  id: string;
  professional_id: string;
  request_id: string | null;
  customer_name: string;
  title: string | null;
  starts_at: string;
  duration_minutes: number;
  price: number | null;
  status: AppointmentStatus;
  // chi ha proposto (023): 'professional' o 'customer'
  proposed_by: "professional" | "customer";
  notes: string | null;
  created_at: string | null;
  // colonne aggiunte da 028_instant_booking: opzionali perché non tutte le
  // query le selezionano (es. CustomerHome usa una select ristretta).
  customer_id?: string | null;
  professional_service_id?: string | null;
  booking_answers?: Record<string, unknown> | null;
  source?: "pro" | "direct";
  // Luogo del lavoro (031): snapshot, non una FK a customer_addresses.
  location_address?: string | null;
  location_city?: string | null;
  location_notes?: string | null;
}

export interface ConversationSummary {
  requestId: string;
  // (022) una conversazione = coppia richiesta-professionista
  professionalId: string | null;
  serviceName: string | null;
  cityName: string | null;
  // nome dell'altra parte (per il cliente = nome pro; per il pro = nome cliente)
  counterpartName: string;
  lastMessage: string | null;
  lastAt: string | null;
  status: string;
}

// (033) un messaggio può essere una proposta di appuntamento collegata a una
// riga di appointments: la chat ci attacca i tasti approva/rifiuta/modifica.
export type ChatMessageKind = "text" | "appointment_proposal";

export interface ChatMessage {
  id: string;
  senderType: "customer" | "professional";
  message: string;
  createdAt: string | null;
  kind: ChatMessageKind;
  appointmentId: string | null;
}
