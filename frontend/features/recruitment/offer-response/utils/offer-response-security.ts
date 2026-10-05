const TOKEN_STORAGE_KEYS = [
  "offer-response-token",
  "recruitment-offer-response",
  "offerToken",
];

/** Guardrail: public offer-response must never persist the raw token client-side. */
export function assertOfferTokenNotPersisted(storage: Pick<Storage, "getItem">) {
  for (const key of TOKEN_STORAGE_KEYS) {
    const value = storage.getItem(key);
    if (value?.trim()) {
      throw new Error(`Offer token persisted in storage key: ${key}`);
    }
  }
}

export function redactTokenFromUrl(url: string) {
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.searchParams.has("token")) {
      parsed.searchParams.set("token", "[REDACTED]");
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return url.replace(/token=[^&]+/gi, "token=[REDACTED]");
  }
}
