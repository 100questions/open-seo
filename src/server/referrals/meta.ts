import { env, waitUntil } from "cloudflare:workers";
import { parseCookies } from "better-auth/cookies";
import { captureServerError } from "@/server/lib/posthog";
import { requestPrivacyChoices } from "@/shared/privacy-choices";

// Meta ad signup attribution (hosted only). Sent only when the visitor's
// advertising (Meta) choice allows it, read here from the privacy cookie,
// location and GPC header, and the pixel on openseo.so left its cookies.
// Deliberately no name or email.

const META_GRAPH_API_URL = "https://graph.facebook.com/v23.0";

/** Must never fail the signup. */
export function captureMetaSignup(request: Request | null | undefined) {
  const pixelId = env.META_PIXEL_ID;
  const accessToken = env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !accessToken || !request) return;
  if (!requestPrivacyChoices(request).advertising) return;

  const headers = request.headers;
  const cookies = parseCookies(headers.get("cookie") ?? "");
  const fbp = cookies.get("_fbp");
  const fbc = cookies.get("_fbc");
  if (!fbp && !fbc) return;

  const event = {
    event_name: "CompleteRegistration",
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    event_source_url: new URL("/sign-up", request.url).href,
    user_data: {
      client_ip_address: headers.get("cf-connecting-ip") ?? undefined,
      client_user_agent: headers.get("user-agent") ?? undefined,
      fbp,
      fbc,
    },
  };

  waitUntil(
    fetch(`${META_GRAPH_API_URL}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event], access_token: accessToken }),
      signal: AbortSignal.timeout(10_000),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Meta signup tracking failed (${response.status})`);
        }
      })
      .catch(async (error: unknown) => {
        console.error("Meta signup tracking failed", { error });
        await captureServerError(error, { source: "meta_signup" });
      }),
  );
}
