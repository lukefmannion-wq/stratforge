const ACCESS_TOKEN_KEY = "access_token";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiOptions extends RequestInit {
  body?: any;
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
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
