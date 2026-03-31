const ACCESS_TOKEN_KEY = "access_token";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiOptions extends RequestInit {
  body?: any;
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body = options.body;
  if (body !== undefined && !(typeof FormData !== "undefined" && body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers,
    body,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.detail || data?.message || "Request failed";
    throw new Error(message);
  }

  return data;
}

export interface AuthPayload {
  email: string;
  password: string;
}

export interface ExpertisePayload {
  resume_text: string;
  past_projects: string;
  target_industries: string;
  key_outcomes: string;
}

export interface ConsultantProfile {
  service_offerings: string[];
  ideal_client_profile: Record<string, string>;
  value_proposition: string;
  created_at: string;
}

export async function signup(payload: AuthPayload) {
  return apiFetch<{ access_token: string; token_type: string }>("/auth/signup", {
    method: "POST",
    body: payload,
  });
}

export async function login(payload: AuthPayload) {
  return apiFetch<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export async function generateExpertise(payload: ExpertisePayload) {
  return apiFetch<ConsultantProfile>("/expertise/generate", {
    method: "POST",
    body: payload,
  });
}

export async function getProfile() {
  return apiFetch<ConsultantProfile>("/expertise/profile", {
    method: "GET",
  });
}

export async function updateProfile(payload: Partial<ConsultantProfile>) {
  return apiFetch<ConsultantProfile>("/expertise/profile", {
    method: "PUT",
    body: payload,
  });
}

export interface LeadCreate {
  company_name: string;
  company_website?: string;
  contact_name?: string;
  contact_role?: string;
  notes?: string;
}

export interface Lead {
  id: number;
  company_name: string;
  company_website?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  notes?: string | null;
  fit_score?: string | null;
  signal_justification?: string | null;
  enrichment_data?: Record<string, any> | null;
  status: string;
  created_at: string;
  outreach_count?: number;
}

export interface LeadImportResponse {
  imported: number;
  processed: number;
}

export interface OutreachMessage {
  id: number;
  lead_id: number;
  message_type: string;
  subject_line?: string | null;
  body: string;
  status: string;
  generated_at: string;
  sent_at?: string | null;
  notes?: string | null;
}

export interface OutreachGenerateRequest {
  lead_id: number;
  message_type: string;
}

export async function generateOutreach(payload: OutreachGenerateRequest) {
  return apiFetch<OutreachMessage>("/outreach/generate", {
    method: "POST",
    body: payload,
  });
}

export async function generateOutreachSequence(lead_id: number) {
  return apiFetch<OutreachMessage[]>("/outreach/generate-sequence", {
    method: "POST",
    body: { lead_id },
  });
}

export async function getOutreachMessages(lead_id?: number) {
  const query = lead_id ? `?lead_id=${encodeURIComponent(lead_id)}` : "";
  return apiFetch<OutreachMessage[]>(`/outreach${query}`, {
    method: "GET",
  });
}

export async function getOutreachMessage(id: number) {
  return apiFetch<OutreachMessage>(`/outreach/${id}`, {
    method: "GET",
  });
}

export async function updateOutreachMessage(id: number, payload: Partial<Pick<OutreachMessage, 'subject_line' | 'body' | 'status' | 'notes'>>) {
  return apiFetch<OutreachMessage>(`/outreach/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteOutreachMessage(id: number) {
  return apiFetch<{ detail: string }>(`/outreach/${id}`, {
    method: "DELETE",
  });
}

export async function markOutreachSent(id: number) {
  return apiFetch<OutreachMessage>(`/outreach/${id}/mark-sent`, {
    method: "POST",
  });
}

export async function getLeads() {
  return apiFetch<Lead[]>("/leads", {
    method: "GET",
  });
}

export async function getLead(id: number) {
  return apiFetch<Lead>(`/leads/${id}`, {
    method: "GET",
  });
}

export async function createLead(payload: LeadCreate) {
  return apiFetch<Lead>("/leads", {
    method: "POST",
    body: payload,
  });
}

export async function updateLead(id: number, payload: Partial<LeadCreate & { status?: string }>) {
  return apiFetch<Lead>(`/leads/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteLead(id: number) {
  return apiFetch<{ detail: string }>(`/leads/${id}`, {
    method: "DELETE",
  });
}

export async function importLeads(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<LeadImportResponse>("/leads/import", {
    method: "POST",
    body: formData,
  });
}

export async function reanalyzeLead(id: number) {
  return apiFetch<Lead>(`/leads/${id}`, {
    method: "POST",
    body: { re_analyze: true },
  });
}

export function saveToken(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

export function getToken() {
  return typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function clearToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}
