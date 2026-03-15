import { supabase } from "@psd/shared/lib/supabaseClient";

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function fetchWithAdminAuth(input, init = {}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error("Could not verify admin session.");
  }

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error("Missing authorization token.");
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function fetchJson(input, init = {}) {
  const response = await fetch(input, init);
  const body = await parseJsonResponse(response);
  return { response, body };
}

export async function fetchJsonWithAdminAuth(input, init = {}) {
  const response = await fetchWithAdminAuth(input, init);
  const body = await parseJsonResponse(response);
  return { response, body };
}
