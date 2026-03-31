const ACCESS_TOKEN_KEY = "access_token";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiOptions extends RequestInit {
  body?: any;
  responseType?: "json" | "text";
  onUpgradeRequired?: (message: string) => void;
}

let upgradeRequiredCallback: ((message: string) => void) | null = null;

export function registerUpgradeRequiredCallback(callback: (message: string) => void) {
  upgradeRequiredCallback = callback;
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

  const { responseType = "json", onUpgradeRequired, ...fetchOptions } = options;
  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...fetchOptions,
    headers,
    body,
  });

  const text = await response.text();
  const data = responseType === "text" ? text as unknown as T : text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (responseType === "json" ? (data as any)?.detail || (data as any)?.message : text) || "Request failed";
    if (response.status === 403) {
      (onUpgradeRequired || upgradeRequiredCallback)?.(message);
    }
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
  pipeline_stage?: string;
  deal_value?: number | null;
  expected_close_date?: string | null;
  created_at: string;
  outreach_count?: number;
}

export interface LeadImportResponse {
  imported: number;
  processed: number;
}

export interface PipelineLead extends Lead {
  pipeline_stage: string;
  deal_value?: number | null;
  expected_close_date?: string | null;
  proposal_count?: number;
}

export interface PipelineEvent {
  id: number;
  lead_id: number;
  event_type: string;
  from_stage?: string | null;
  to_stage?: string | null;
  note?: string | null;
  created_at: string;
  company_name?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
}

export interface PipelineMetrics {
  total_leads: number;
  leads_by_stage: Record<string, number>;
  lead_to_call_rate: number;
  call_to_close_rate: number;
  total_pipeline_value: number;
  closed_won_value: number;
  avg_deal_value: number;
  outreach_response_rate: number;
}

export interface BillingSubscription {
  subscription_tier: string;
  subscription_status: string;
  subscription_current_period_end?: string | null;
  is_free_plan: boolean;
}

export interface BillingCheckoutRequest {
  tier: string;
  success_url?: string;
  cancel_url?: string;
}

export interface BillingPortalResponse {
  url: string;
}

export interface BillingCheckoutResponse {
  url: string;
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
  company_name?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
}

export interface ProposalPhase {
  phase_name: string;
  description: string;
  deliverables: string[];
  acceptance_criteria?: string[] | null;
}

export interface PricingLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Proposal {
  id: number;
  lead_id: number;
  version: number;
  proposal_type: string;
  title: string;
  executive_summary: string;
  problem_statement: string;
  proposed_approach: ProposalPhase[];
  timeline: string;
  pricing_table: PricingLineItem[];
  total_price: number;
  currency: string;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
}

export interface ProposalGenerateRequest {
  lead_id: number;
  proposal_type: string;
  scope_notes: string;
  timeline_preference: string;
  rate_type: string;
  rate_amount: number;
  currency?: string;
}

export interface ProposalUpdateRequest {
  title?: string;
  executive_summary?: string;
  problem_statement?: string;
  proposed_approach?: ProposalPhase[];
  timeline?: string;
  pricing_table?: PricingLineItem[];
  total_price?: number;
  currency?: string;
  status?: string;
  notes?: string;
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

export async function generateProposal(payload: ProposalGenerateRequest) {
  return apiFetch<Proposal>("/proposals/generate", {
    method: "POST",
    body: payload,
  });
}

export async function getProposals(lead_id?: number) {
  const query = lead_id ? `?lead_id=${encodeURIComponent(lead_id)}` : "";
  return apiFetch<Proposal[]>(`/proposals${query}`, {
    method: "GET",
  });
}

export async function getProposal(id: number) {
  return apiFetch<Proposal>(`/proposals/${id}`, {
    method: "GET",
  });
}

export async function updateProposal(id: number, payload: ProposalUpdateRequest) {
  return apiFetch<Proposal>(`/proposals/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteProposal(id: number) {
  return apiFetch<{ detail: string }>(`/proposals/${id}`, {
    method: "DELETE",
  });
}

export async function duplicateProposal(id: number) {
  return apiFetch<Proposal>(`/proposals/${id}/duplicate`, {
    method: "POST",
  });
}

export async function markProposalSent(id: number) {
  return apiFetch<Proposal>(`/proposals/${id}/mark-sent`, {
    method: "POST",
  });
}

export async function exportProposalHtml(id: number) {
  return apiFetch<string>(`/proposals/${id}/export-html`, {
    method: "GET",
    responseType: "text",
  });
}

export async function getPipeline() {
  return apiFetch<Record<string, PipelineLead[]>>("/pipeline", {
    method: "GET",
  });
}

export async function updatePipelineStage(id: number, new_stage: string) {
  return apiFetch<PipelineLead>(`/pipeline/${id}/stage`, {
    method: "PUT",
    body: { new_stage },
  });
}

export async function updatePipelineDeal(
  id: number,
  payload: Partial<{
    deal_value: number | null;
    expected_close_date: string | null;
  }>,
) {
  return apiFetch<PipelineLead>(`/pipeline/${id}/deal`, {
    method: "PUT",
    body: payload,
  });
}

export async function getPipelineMetrics() {
  return apiFetch<PipelineMetrics>("/pipeline/metrics", {
    method: "GET",
  });
}

export async function getBillingSubscription() {
  return apiFetch<BillingSubscription>("/billing/subscription", {
    method: "GET",
  });
}

export async function createCheckoutSession(payload: BillingCheckoutRequest) {
  return apiFetch<BillingCheckoutResponse>("/billing/create-checkout-session", {
    method: "POST",
    body: payload,
  });
}

export async function createPortalSession() {
  return apiFetch<BillingPortalResponse>("/billing/create-portal-session", {
    method: "POST",
  });
}

export async function getPipelineActivity(lead_id: number) {
  return apiFetch<PipelineEvent[]>(`/pipeline/${lead_id}/activity`, {
    method: "GET",
  });
}

export async function getRecentPipelineActivity() {
  return apiFetch<PipelineEvent[]>("/pipeline/activity/recent", {
    method: "GET",
  });
}

export async function addPipelineNote(lead_id: number, note: string) {
  return apiFetch<PipelineEvent>(`/pipeline/${lead_id}/note`, {
    method: "POST",
    body: { note },
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
