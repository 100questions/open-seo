import { describe, expect, it } from "vitest";
import {
  effectivePrivacyChoices,
  readPrivacyCookie,
  requiresOptIn,
} from "./privacy-choices";

describe("privacy choices", () => {
  it("needs opt-in for EEA/UK/Swiss and unknown locations only", () => {
    expect(requiresOptIn("DE")).toBe(true);
    expect(requiresOptIn("GB")).toBe(true);
    expect(requiresOptIn(null)).toBe(true);
    expect(requiresOptIn("XX")).toBe(true);
    expect(requiresOptIn("T1")).toBe(true);
    expect(requiresOptIn("US")).toBe(false);
  });

  it("keeps optional tracking off until an opt-in visitor chooses", () => {
    expect(
      effectivePrivacyChoices({
        saved: null,
        optIn: true,
        globalPrivacyControl: false,
      }),
    ).toEqual({ analytics: false, ads: false });
  });

  it("lets Global Privacy Control override a saved advertising choice", () => {
    const saved = readPrivacyCookie("other=1; openseo_privacy=a1.d1");
    expect(
      effectivePrivacyChoices({
        saved,
        optIn: false,
        globalPrivacyControl: true,
      }),
    ).toEqual({ analytics: true, ads: false });
  });
});
