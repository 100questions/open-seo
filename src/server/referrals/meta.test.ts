import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureMetaSignup } from "./meta";

vi.mock("cloudflare:workers", () => ({
  env: { META_PIXEL_ID: "123", META_CONVERSIONS_API_TOKEN: "token" },
  waitUntil: (promise: Promise<unknown>) => promise,
}));
vi.mock("@/server/lib/posthog", () => ({ captureServerError: vi.fn() }));

const fetchMock = vi.fn();

function signupRequest(headers: Record<string, string>) {
  return new Request("https://app.openseo.so/api/auth/sign-up/email", {
    headers: { cookie: "_fbp=fb.1.1.1", ...headers },
  });
}

describe("captureMetaSignup", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends nothing to Meta without advertising permission", () => {
    // An EU visitor who hasn't opted in, and a US visitor sending GPC. The
    // full set of region and saved-choice cases is in privacy-choices.test.ts.
    captureMetaSignup(signupRequest({ "cf-ipcountry": "DE" }));
    captureMetaSignup(signupRequest({ "cf-ipcountry": "US", "sec-gpc": "1" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the signup once advertising is allowed", () => {
    // EU visitor who opted in to advertising but not partner referrals.
    captureMetaSignup(
      signupRequest({
        "cf-ipcountry": "DE",
        cookie: "_fbp=fb.1.1.1; openseo_privacy=a0.d0.m1",
      }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
