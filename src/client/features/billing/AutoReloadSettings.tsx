import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/client/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/client/components/ui/input-group";
import {
  AutoReloadNotice,
  UpdateCardButton,
} from "@/client/features/billing/AutoReloadNotice";
import { billingAccountQueryOptions } from "@/client/features/billing/billingAccountQuery";
import { parseUsdAmount } from "@/client/features/billing/HostedBillingContentUtils";
import { useCreditBalance } from "@/client/features/billing/useCreditBalance";
import {
  getErrorCode,
  getStandardErrorMessage,
} from "@/client/lib/error-messages";
import { queryClient } from "@/client/tanstack-db";
import { setAutoReload } from "@/serverFunctions/billing";
import {
  AUTO_RELOAD_DEFAULTS,
  AUTO_RELOAD_MAX_MONTHLY_USD,
  AUTO_RELOAD_THRESHOLD_USD,
  isAutoReloadBudgetSpent,
  TOP_UP_MAX_USD,
  TOP_UP_MIN_USD,
  type AutoReloadSettings as AutoReloadValues,
} from "@/shared/billing";

type AutoReload = NonNullable<
  ReturnType<typeof useCreditBalance>["autoReload"]
>;

/**
 * The auto-reload section of the Buy credits card. Off: the two amounts and
 * one button to turn it on. On: a status line, the amounts with Save, and
 * Turn off, which acts at once. Turning on can charge the first reload right
 * away (the server buys it before enabling); the button says so. A spent
 * budget shows a notice with a one-click raise. Owner-only at the call site,
 * as the server enforces.
 */
export function AutoReloadSettings() {
  const {
    topUpRemaining,
    refillDate,
    autoReload: saved,
    autoReloadState,
    autoReloadPrimesOnEnable: chargesNow,
  } = useCreditBalance();
  // The saved control while it is on; null when off or never set up.
  const on = saved?.enabled ? saved : null;

  const [fields, setFields] = useState<Record<keyof AutoReloadValues, string>>({
    amountUsd: String(saved?.amountUsd ?? AUTO_RELOAD_DEFAULTS.amountUsd),
    monthlyLimitUsd: String(
      saved?.monthlyLimitUsd ?? AUTO_RELOAD_DEFAULTS.monthlyLimitUsd,
    ),
  });

  const amount = parseUsdAmount(fields.amountUsd, {
    fallback: saved?.amountUsd ?? AUTO_RELOAD_DEFAULTS.amountUsd,
  });
  const budget = parseUsdAmount(fields.monthlyLimitUsd, {
    min: amount.parsed,
    max: AUTO_RELOAD_MAX_MONTHLY_USD,
    fallback: saved?.monthlyLimitUsd ?? AUTO_RELOAD_DEFAULTS.monthlyLimitUsd,
  });
  const values: AutoReloadValues = {
    amountUsd: amount.parsed,
    monthlyLimitUsd: budget.parsed,
  };
  const isValid = amount.isValid && budget.isValid;
  const isDirty =
    !on ||
    on.amountUsd !== values.amountUsd ||
    on.monthlyLimitUsd !== values.monthlyLimitUsd;
  // The server decides whether saving buys the first reload now (also the
  // retry after a failed one), and the page shows that same decision. A
  // retry is worth submitting with nothing changed.
  const budgetUnderSpend = isBudgetUnderSpend(saved, values.monthlyLimitUsd);
  const canSubmit = isValid && !budgetUnderSpend && (isDirty || chargesNow);
  const hint = hintCopy({
    saved,
    on,
    values,
    isValid,
    chargesNow,
    topUpRemaining,
  });

  const mutation = useMutation({
    mutationFn: (
      input: { enabled: false } | ({ enabled: true } & AutoReloadValues),
    ) => setAutoReload({ data: input }),
    // Errors show inline, with the portal when the card is the problem.
    meta: { errorToast: false },
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({
        queryKey: billingAccountQueryOptions().queryKey,
      });
      toast.success(input.enabled ? "Auto-reload is on" : "Auto-reload is off");
    },
  });
  const saving = mutation.isPending && Boolean(mutation.variables?.enabled);
  const turningOff = mutation.isPending && !saving;

  const save = (next: AutoReloadValues) => {
    setFields({
      amountUsd: String(next.amountUsd),
      monthlyLimitUsd: String(next.monthlyLimitUsd),
    });
    mutation.mutate({ enabled: true, ...next });
  };

  const saveLabel = chargesNow
    ? `${on ? "Retry" : "Turn on"} and buy $${values.amountUsd} now`
    : on
      ? "Save changes"
      : "Turn on auto-reload";

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Auto-reload</p>
        <p className="text-xs text-muted-foreground">
          When your top-up credits drop to ${AUTO_RELOAD_THRESHOLD_USD} or less,
          we charge your card for more, up to a monthly budget you set.
        </p>
      </div>

      {on ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">On</span> &middot; $
          {on.spentUsd.toFixed(2)} of ${on.monthlyLimitUsd} spent this month
          {refillDate ? `, resets ${refillDate}` : ""}
        </p>
      ) : null}

      {saved ? (
        <AutoReloadNotice
          saved={saved}
          state={autoReloadState}
          canRetry={chargesNow}
          resetDate={refillDate}
          // The raise is the plain save; when saving would charge the card,
          // the main button says so and is the way to do it.
          onRaise={
            on && !chargesNow
              ? (monthlyLimitUsd) =>
                  save({ amountUsd: on.amountUsd, monthlyLimitUsd })
              : undefined
          }
          pending={mutation.isPending}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <AmountField
          id="auto-reload-amount"
          label="Add each time"
          value={fields.amountUsd}
          error={
            amount.isValid
              ? undefined
              : `Enter between $${TOP_UP_MIN_USD}–$${TOP_UP_MAX_USD}.`
          }
          onChange={(value) =>
            setFields((prev) => ({ ...prev, amountUsd: value }))
          }
        />
        <AmountField
          id="auto-reload-budget"
          label="Monthly budget"
          value={fields.monthlyLimitUsd}
          error={
            budget.isValid
              ? undefined
              : `Enter between $${amount.parsed}–$${AUTO_RELOAD_MAX_MONTHLY_USD}.`
          }
          description="The most you spend on top-up credits a month, including ones you buy yourself."
          onChange={(value) =>
            setFields((prev) => ({ ...prev, monthlyLimitUsd: value }))
          }
        />
      </div>

      {hint ? <p className="text-xs text-amber-600">{hint}</p> : null}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          pending={saving}
          disabled={mutation.isPending || !canSubmit}
          onClick={() => save(values)}
        >
          {saveLabel}
        </Button>
        {on ? (
          <Button
            variant="ghost"
            pending={turningOff}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ enabled: false })}
          >
            Turn off
          </Button>
        ) : null}
      </div>

      {mutation.isError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {getStandardErrorMessage(
              mutation.error,
              "We couldn't save auto-reload. Please try again.",
            )}
          </p>
          {getErrorCode(mutation.error) === "PAYMENT_METHOD_REQUIRED" ? (
            <UpdateCardButton />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Autumn keeps the cycle's top-up spend while auto-reload is off, so a
// budget the spend already reaches pauses the credits at once, and a turn-on
// that buys now would buy credits that cannot be used. The server refuses
// it; the page says so first.
function isBudgetUnderSpend(saved: AutoReload | null, monthlyLimitUsd: number) {
  return (
    saved !== null &&
    saved.spentUsd > 0 &&
    isAutoReloadBudgetSpent(saved.spentUsd, monthlyLimitUsd)
  );
}

/** The amber line under the fields: a budget the spend has reached (unless
 *  the notice above already says it), else what saving charges now. */
function hintCopy({
  saved,
  on,
  values,
  isValid,
  chargesNow,
  topUpRemaining,
}: {
  saved: AutoReload | null;
  on: AutoReload | null;
  values: AutoReloadValues;
  isValid: boolean;
  chargesNow: boolean;
  topUpRemaining: number;
}) {
  if (
    saved &&
    isBudgetUnderSpend(saved, values.monthlyLimitUsd) &&
    (!on || values.monthlyLimitUsd !== on.monthlyLimitUsd)
  ) {
    return `You've already spent $${saved.spentUsd.toFixed(2)} on top-up credits this month. Set a budget of at least $${Math.ceil(saved.spentUsd + AUTO_RELOAD_THRESHOLD_USD)} to keep going.`;
  }
  if (!chargesNow || !isValid) return null;
  if (on) {
    return `Retrying charges your card $${values.amountUsd} now.`;
  }
  if (topUpRemaining > 0) {
    return `Your top-up credits are already at $${topUpRemaining.toFixed(2)}, so turning this on buys $${values.amountUsd} now.`;
  }
  return `You have no top-up credits yet, so turning this on buys $${values.amountUsd} now. They're used after your monthly credits run out.`;
}

function AmountField({
  id,
  label,
  value,
  error,
  description,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | undefined;
  description?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id} className="text-xs">
        {label}
      </FieldLabel>
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput
          id={id}
          type="number"
          step={1}
          inputMode="numeric"
          aria-invalid={error !== undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputGroup>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : description ? (
        <FieldDescription className="text-xs">{description}</FieldDescription>
      ) : null}
    </Field>
  );
}
