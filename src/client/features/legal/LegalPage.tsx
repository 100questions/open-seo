import { Link } from "@tanstack/react-router";

// The operator of this self-hosted installation, named on the Google OAuth
// consent screen. Google requires the privacy policy and terms linked there to
// live on the installation's own authorized domain.
export const LEGAL_CONTACT_EMAIL = "benhviendonghovietnam@gmail.com";
const LEGAL_LAST_UPDATED = "October 28, 2026";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-[100dvh] overflow-y-auto bg-background px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed [&_p_a]:underline [&_p_a]:underline-offset-2 [&_h2]:pt-4 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <Link to="/" className="inline-flex items-center gap-2">
          <img
            src="/transparent-logo.png"
            alt="OpenSEO"
            className="size-8 rounded-lg"
          />
          <span className="font-semibold">OpenSEO</span>
        </Link>
        <h1 className="pt-4 text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">
          Last updated: {LEGAL_LAST_UPDATED}
        </p>
        {children}
        <p className="pt-4 text-muted-foreground">
          Questions:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        </p>
      </article>
    </div>
  );
}
