// Tipi del database BOB — allineati allo schema Supabase (progetto bijgitnulucdzluqjxrx).

export type CityStatus = "active" | "coming_soon";
export type VerificationStatus = "unverified" | "pending" | "verified";
export type UserRole = "customer" | "professional" | "admin" | "cs";
export type SubscriptionTier = "free" | "pro" | "business";

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
  created_at: string | null;
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string | null;
}

export interface Subservice {
  id: string;
  service_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string | null;
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
  responseTimeLabel: string | null;
  city: { name: string; slug: string };
  serviceName: string | null;
  serviceSlug: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  priceNote: string | null;
  avgRating: number | null;
  nRatings: number;
}

// ----- Messaggi e appuntamenti (aggiunti per dashboard pro e conversazioni) -----

export type AppointmentStatus = "confirmed" | "completed" | "cancelled";

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
  notes: string | null;
  created_at: string | null;
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

export interface ChatMessage {
  id: string;
  senderType: "customer" | "professional";
  message: string;
  createdAt: string | null;
}
