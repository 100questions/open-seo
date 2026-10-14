// Optional tracking choices shared by the marketing site (openseo.so) and the
// app (app.openseo.so). Both read one first-party cookie on `.openseo.so`, so a
// choice made on either side applies to both. Necessary cookies (sign-in,
// security, this cookie) are not optional and are not covered here.

export type PrivacyChoices = {
  /** PostHog product analytics in the app: events, errors and masked
   *  session recordings. The website's visit statistics are cookieless and
   *  not covered here. */
  analytics: boolean;
  /** Partner referral attribution (Dub's referral cookie). */
  ads: boolean;
};

const PRIVACY_COOKIE = "openseo_privacy";
const PRIVACY_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

// For visitors from these countries nothing optional runs until they opt in.
// Everywhere else optional tracking is on until the visitor opts out. EEA
// (EU + Iceland, Liechtenstein, Norway), UK and Switzerland. The second line
// is EU regions that report their own code (French overseas regions, Åland),
// then Gibraltar and the Crown Dependencies, which follow GDPR-style rules.
const OPT_IN_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
  "SE", "IS", "LI", "NO", "GB", "CH",
  "RE", "GP", "MQ", "GF", "YT", "MF", "AX", "GI", "JE", "GG", "IM",
]); // prettier-ignore

/** `country` is Cloudflare's CF-IPCountry. Unknown or anonymized (XX, T1)
 *  locations get the opt-in treatment. */
export function requiresOptIn(country: string | null | undefined): boolean {
  if (!country || country.length !== 2) return true;
  if (country === "XX" || country === "T1") return true;
  return OPT_IN_COUNTRIES.has(country.toUpperCase());
}

export function defaultPrivacyChoices(optIn: boolean): PrivacyChoices {
  return { analytics: !optIn, ads: !optIn };
}

/** Saved choices from a Cookie header or `document.cookie`, or null when the
 *  visitor hasn't chosen yet (or the cookie is unreadable). */
export function readPrivacyCookie(
  cookieHeader: string | null | undefined,
): PrivacyChoices | null {
  const raw = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PRIVACY_COOKIE}=`))
    ?.slice(PRIVACY_COOKIE.length + 1);
  // Format: "a1.d0" — analytics, ads.
  const match = /^a([01])\.d([01])$/.exec(raw ?? "");
  if (!match) return null;
  return { analytics: match[1] === "1", ads: match[2] === "1" };
}

/** Choices that apply right now. Global Privacy Control always turns off
 *  advertising and referral tracking, whatever was saved. */
export function effectivePrivacyChoices(args: {
  saved: PrivacyChoices | null;
  optIn: boolean;
  globalPrivacyControl: boolean;
}): PrivacyChoices {
  const choices = args.saved ?? defaultPrivacyChoices(args.optIn);
  return args.globalPrivacyControl ? { ...choices, ads: false } : choices;
}

// ---- Browser helpers ----

export function hasGlobalPrivacyControl(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Reflect.get(navigator, "globalPrivacyControl") === true
  );
}

function cookieDomainAttribute(): string {
  const host = location.hostname;
  return host === "openseo.so" || host.endsWith(".openseo.so")
    ? "; Domain=openseo.so"
    : "";
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}${cookieDomainAttribute()}`;
}

const flag = (value: boolean) => (value ? "1" : "0");

export function savePrivacyChoices(choices: PrivacyChoices) {
  writeCookie(
    PRIVACY_COOKIE,
    `a${flag(choices.analytics)}.d${flag(choices.ads)}`,
    PRIVACY_COOKIE_MAX_AGE_SECONDS,
  );
  // Withdrawing referral permission removes Dub's cookies so a later signup
  // isn't attributed to the partner. Sales of a customer attributed at signup
  // are still reported from the server.
  if (!choices.ads) {
    for (const name of ["dub_id", "dub_partner_data"]) writeCookie(name, "", 0);
  }
  window.dispatchEvent(new Event(PRIVACY_CHOICES_CHANGED_EVENT));
}

export const PRIVACY_CHOICES_CHANGED_EVENT = "openseo:privacy-choices-changed";
