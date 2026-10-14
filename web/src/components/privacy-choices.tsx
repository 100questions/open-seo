import * as React from "react";
import {
  effectivePrivacyChoices,
  hasGlobalPrivacyControl,
  readPrivacyCookie,
  savePrivacyChoices,
  type PrivacyChoices as Choices,
} from "../../../src/shared/privacy-choices";

// The footer's "Your privacy choices" link dispatches this to open the dialog.
const OPEN_PRIVACY_CHOICES_EVENT = "openseo:open-privacy-choices";
const PLAUSIBLE_IGNORE = "plausible_ignore";

// Plausible counts visits without cookies for everyone (the dialog offers its
// opt-out). The only consent-based tracking here is Dub's referral cookie on
// partner links: loaded where allowed, asked about where opt-in is required.
// The footer's dialog also holds the app's analytics choice (one shared cookie).
export function PrivacyChoices() {
  const [saved, setSaved] = React.useState<Choices | null>(null);
  const [optIn, setOptIn] = React.useState<boolean | null>(null);
  const [view, setView] = React.useState<"none" | "partner" | "dialog">("none");

  React.useEffect(() => {
    const savedChoices = readPrivacyCookie(document.cookie);
    setSaved(savedChoices);
    if (isPartnerVisit() && !hasGlobalPrivacyControl()) {
      if (savedChoices) {
        if (savedChoices.ads) loadReferralAttribution();
      } else {
        void fetchOptIn().then((required) => {
          setOptIn(required);
          if (required) setView("partner");
          else loadReferralAttribution();
        });
      }
    }

    const open = () => setView("dialog");
    window.addEventListener(OPEN_PRIVACY_CHOICES_EVENT, open);
    return () => window.removeEventListener(OPEN_PRIVACY_CHOICES_EVENT, open);
  }, []);

  // The dialog shows location-based defaults to visitors who haven't chosen.
  React.useEffect(() => {
    if (view === "dialog" && saved === null && optIn === null) {
      void fetchOptIn().then(setOptIn);
    }
  }, [view, saved, optIn]);

  const choices =
    saved || optIn !== null
      ? effectivePrivacyChoices({
          saved,
          optIn: optIn ?? false,
          globalPrivacyControl: hasGlobalPrivacyControl(),
        })
      : null;

  function save(next: Choices) {
    // A loaded referral script can't be unloaded; a reload stops it.
    const stopReferrals =
      !next.ads && document.querySelector("script[data-openseo-dub]") !== null;
    savePrivacyChoices(next);
    setSaved(next);
    setView("none");
    if (next.ads) loadReferralAttribution();
    if (stopReferrals) location.reload();
  }

  if (!choices || view === "none") return null;

  if (view === "partner") {
    return (
      <Panel className="max-w-sm">
        <p>
          You came from a partner&apos;s link. Can we keep a 90-day cookie (Dub)
          so they get credit if you sign up?
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <PanelButton onClick={() => save({ ...choices, ads: false })}>
            No thanks
          </PanelButton>
          <PanelButton onClick={() => save({ ...choices, ads: true })}>
            Allow
          </PanelButton>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="max-w-md">
      <ChoicesForm
        initial={choices}
        onSave={save}
        onCancel={() => setView("none")}
      />
    </Panel>
  );
}

function ChoicesForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Choices;
  onSave: (choices: Choices) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [countVisits, setCountVisits] = React.useState(
    () => localStorage.getItem(PLAUSIBLE_IGNORE) !== "true",
  );
  const gpc = hasGlobalPrivacyControl();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // Plausible's own opt-out: its script skips tracking while this is set.
        if (countVisits) localStorage.removeItem(PLAUSIBLE_IGNORE);
        else localStorage.setItem(PLAUSIBLE_IGNORE, "true");
        onSave(draft);
      }}
    >
      <p className="font-semibold text-neutral-900">Your privacy choices</p>
      <div className="mt-3 space-y-3">
        <ChoiceRow
          label="Visit counts"
          description="Anonymous, without cookies (Plausible)."
          checked={countVisits}
          onChange={setCountVisits}
        />
        <ChoiceRow
          label="Product analytics"
          description="Usage analytics and session replays in the app, with all text hidden (PostHog)."
          checked={draft.analytics}
          onChange={(analytics) => setDraft({ ...draft, analytics })}
        />
        <ChoiceRow
          label="Partner referrals"
          description={
            gpc
              ? "Off because your browser sends Global Privacy Control."
              : "A 90-day cookie that credits the partner who sent you (Dub)."
          }
          checked={draft.ads && !gpc}
          disabled={gpc}
          onChange={(ads) => setDraft({ ...draft, ads })}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <PanelButton onClick={onCancel}>Cancel</PanelButton>
        <PanelButton type="submit" primary>
          Save
        </PanelButton>
      </div>
    </form>
  );
}

function ChoiceRow(props: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      <span>
        <span className="font-medium text-neutral-900">{props.label}</span>
        <span className="block text-neutral-600">{props.description}</span>
      </span>
    </label>
  );
}

// Bottom left on wider screens, clear of the page's centre column and the
// Discord button; full width on phones.
function Panel(props: { className: string; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-label="Privacy choices"
      className={`fixed inset-x-4 bottom-4 z-50 rounded-lg border border-neutral-300 bg-white p-4 text-sm text-neutral-700 shadow-lg sm:right-auto ${props.className}`}
    >
      {props.children}
    </div>
  );
}

// The partner prompt's two answers share one style, so declining is as easy
// as agreeing. The dialog's Save is only slightly stronger.
function PanelButton(props: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  primary?: boolean;
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      className={
        props.primary
          ? "min-h-9 rounded-md border border-neutral-300 bg-neutral-100 px-3 font-semibold text-neutral-900 hover:bg-neutral-200"
          : "min-h-9 rounded-md border border-neutral-300 px-3 font-medium text-neutral-900 hover:bg-neutral-100"
      }
    >
      {props.children}
    </button>
  );
}

export function PrivacyChoicesLink() {
  return (
    <button
      type="button"
      className="text-left"
      onClick={() =>
        window.dispatchEvent(new Event(OPEN_PRIVACY_CHOICES_EVENT))
      }
    >
      Your privacy choices
    </button>
  );
}

const isPartnerVisit = () => {
  const params = new URLSearchParams(location.search);
  return params.has("dub_id") || params.has("via");
};

// Opt-in is required in the EEA, UK, Switzerland and unknown locations
// (Cloudflare's CF-IPCountry, read by /api/privacy-region). The page is
// prerendered, so the browser asks. A failed lookup counts as opt-in.
async function fetchOptIn(): Promise<boolean> {
  try {
    const data: unknown = await (await fetch("/api/privacy-region")).json();
    return !(data instanceof Object && Reflect.get(data, "optIn") === false);
  } catch {
    return true;
  }
}

// Dub partner links land here with ?dub_id= (and ?via=). Dub's script stores
// the click id as a `dub_id` cookie on `.openseo.so` so the app at
// app.openseo.so can attribute the signup. Only those visits need it.
function loadReferralAttribution() {
  if (!isPartnerVisit()) return;
  if (document.querySelector("script[data-openseo-dub]")) return;
  const script = document.createElement("script");
  script.src = "https://www.dubcdn.com/analytics/script.js";
  script.dataset.openseoDub = "";
  script.dataset.domains = JSON.stringify({ refer: "links.openseo.so" });
  script.dataset.cookieOptions = JSON.stringify({ domain: ".openseo.so" });
  document.head.appendChild(script);
}
