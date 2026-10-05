function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be supplied through the environment.`);
  }
  return value;
}

export function requireGuideCredential(name) {
  return required(name);
}

export function requireGuideBaseUrl() {
  const value = required("GUIDE_BASE_URL");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("GUIDE_BASE_URL must be an absolute HTTP(S) URL.");
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("GUIDE_BASE_URL must use HTTP or HTTPS.");
  }

  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const stagingHosts = (process.env.GUIDE_ALLOWED_STAGING_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!local && !stagingHosts.includes(host)) {
    throw new Error(
      "Refusing capture outside local or an explicitly allowed staging host. Set GUIDE_ALLOWED_STAGING_HOSTS for the staging host.",
    );
  }
  return url.origin;
}
