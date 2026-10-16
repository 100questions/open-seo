import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { AgentList } from "./AgentList";
import { AgentSetupPanel, AGENT_SETUP_DESCRIPTION } from "./AgentSetupPanel";
import { getAgentSetupPrompt } from "./agentSetupPrompt";
import { captureClientEvent } from "@/client/lib/posthog";
import { WizardFooter } from "@/client/features/onboarding/WizardFooter";
import { Button } from "@/client/components/ui/button";

/** Last onboarding step. Onboarding finishes when the user clicks Go to
 *  dashboard, or when their agent connects over MCP (the server marks it). */
export function AgentSetup({
  onFinish,
  onBack,
}: {
  onFinish: () => void;
  onBack: () => void;
}) {
  const prompt = getAgentSetupPrompt(window.location.origin);
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your agent
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          {AGENT_SETUP_DESCRIPTION}
        </p>
        <AgentList />
      </div>
      <AgentSetupPanel
        prompt={prompt}
        copyVariant={copied ? "outline" : "default"}
        onCopy={() => {
          setCopied(true);
          captureClientEvent("onboarding:setup_prompt_copy");
        }}
      >
        {copied ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Paste it into your agent and approve the connection.
          </p>
        ) : null}
      </AgentSetupPanel>
      <div className="mt-7 border-t border-border pt-5">
        <WizardFooter
          className="mt-0"
          onBack={onBack}
          continueAction={
            <Button
              type="button"
              variant={copied ? "default" : "ghost"}
              className={
                copied
                  ? "font-semibold"
                  : "h-8 gap-2 px-3 text-xs font-semibold"
              }
              onClick={onFinish}
            >
              Go to dashboard <ArrowRight className="size-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
}
