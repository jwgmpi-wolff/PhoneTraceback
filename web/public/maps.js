const PROVIDERS = new Set(["google", "bing"]);
const TRAVEL_MODES = new Set(["driving", "walking", "transit"]);

function requireValue(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function buildMapSearchUrl(provider, location) {
  if (!PROVIDERS.has(provider)) throw new Error("Select a supported map provider.");
  const query = encodeURIComponent(requireValue(location, "Location"));

  return provider === "google"
    ? `https://www.google.com/maps/search/?api=1&query=${query}`
    : `https://www.bing.com/maps?q=${query}`;
}

export function buildDirectionsUrl(provider, origin, destination, travelMode) {
  if (!PROVIDERS.has(provider)) throw new Error("Select a supported map provider.");
  if (!TRAVEL_MODES.has(travelMode)) throw new Error("Select a supported travel mode.");

  const encodedOrigin = encodeURIComponent(requireValue(origin, "Point A"));
  const encodedDestination = encodeURIComponent(requireValue(destination, "Point B"));
  if (provider === "google") {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=${travelMode}`;
  }

  const bingModes = { driving: "D", walking: "W", transit: "T" };
  return `https://www.bing.com/maps?rtp=adr.${encodedOrigin}~adr.${encodedDestination}&mode=${bingModes[travelMode]}`;
}
