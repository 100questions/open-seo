import { Button } from "@/client/components/ui/button";
import {
  updatePrivacyChoices,
  usePrivacyChoices,
} from "@/client/components/PrivacyChoices";
import { WizardFooter } from "@/client/features/onboarding/WizardFooter";

/** Last onboarding step on the hosted app: one yes-or-no question about usage
 *  analytics, with equal buttons. Either answer finishes onboarding. Until it
 *  is answered, the region default applies (on in the US, off in the EU). */
export function AnalyticsOnboardingStep({
  onBack,
  onFinish,
}: {
  onBack: () => void;
  onFinish: () => void;
}) {
  const choices = usePrivacyChoices();
  const answer = (analytics: boolean) => {
    if (choices) void updatePrivacyChoices({ ...choices, analytics }, true);
    onFinish();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Help make OpenSEO better
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Share usage analytics and session replays to help improve OpenSEO. See
          our{" "}
          <a
            href="https://openseo.so/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
      <WizardFooter
        onBack={onBack}
        continueAction={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => answer(false)}>
              No thanks
            </Button>
            <Button variant="outline" onClick={() => answer(true)}>
              Share analytics
            </Button>
          </div>
        }
      />
    </div>
  );
}
