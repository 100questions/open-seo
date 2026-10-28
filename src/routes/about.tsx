import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/client/features/legal/LegalPage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "OpenSEO – SEO tool for your websites" },
      {
        name: "description",
        content:
          "OpenSEO helps you research keywords, track rankings, audit sites and see Google Search Console and Analytics data in one place.",
      },
    ],
  }),
  component: AboutPage,
});

// Public home page linked from the Google OAuth consent screen of this
// self-hosted installation; it must stay reachable without signing in.
function AboutPage() {
  return (
    <LegalPage title="OpenSEO" showLastUpdated={false}>
      <p className="text-base">
        OpenSEO is an SEO tool that helps you understand and improve how your
        websites perform in Google Search.
      </p>

      <h2>What OpenSEO does</h2>
      <ul>
        <li>Research keywords and see search volume and difficulty.</li>
        <li>Track where your pages rank for the keywords you care about.</li>
        <li>Audit your site for technical SEO problems.</li>
        <li>Review backlinks and compare your site with competitors.</li>
        <li>Ask an AI assistant questions about your SEO data.</li>
      </ul>

      <h2>Why OpenSEO asks for access to your Google account</h2>
      <p>
        When you choose to connect them, OpenSEO requests read-only access to
        Google Search Console and Google Analytics. It uses that access only to
        show you the clicks, impressions, search queries and traffic for the
        sites you connect, inside your own OpenSEO workspace. OpenSEO never
        changes your Google data. Read more in the{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Get started</h2>
      <p>
        <Link to="/sign-in">Sign in to OpenSEO</Link> ·{" "}
        <Link to="/privacy">Privacy Policy</Link> ·{" "}
        <Link to="/terms">Terms of Service</Link>
      </p>
    </LegalPage>
  );
}
