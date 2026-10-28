import { createFileRoute } from "@tanstack/react-router";
import {
  LEGAL_CONTACT_EMAIL,
  LegalPage,
} from "@/client/features/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy – OpenSEO" }] }),
  component: PrivacyPage,
});

// Public page linked from the Google OAuth consent screen of this self-hosted
// installation; it must stay reachable without signing in.
function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This installation of OpenSEO, an open-source SEO tool, is operated
        privately. This policy explains what data it collects, how it uses that
        data, and the choices you have.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          Account data: your name, email address and password hash, or the basic
          profile Google shares when you sign in with Google.
        </li>
        <li>
          Workspace data: the projects, keywords, sites and settings you add.
        </li>
        <li>
          Google data you choose to connect: read-only access to your Google
          Search Console and Google Analytics data.
        </li>
      </ul>

      <h2>How we use Google user data</h2>
      <p>
        OpenSEO uses Search Console and Analytics data only to show you reports,
        insights and answers about the sites you connect. We store the OAuth
        tokens needed to keep the connection working. We do not sell this data,
        use it for advertising, or use it to train AI models.
      </p>
      <p>
        OpenSEO&apos;s use and transfer of information received from Google APIs
        adheres to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Service providers</h2>
      <p>
        To provide features you request, OpenSEO sends the minimum data needed
        to these providers:
      </p>
      <ul>
        <li>DataForSEO, for keyword, ranking and backlink data.</li>
        <li>
          OpenRouter, for AI assistant answers. When you ask the assistant about
          your sites, the relevant data is sent only to generate that answer.
        </li>
        <li>PostHog, for product analytics, when enabled.</li>
      </ul>

      <h2>Retention and deletion</h2>
      <p>
        Data is kept while your account is active. You can disconnect Google
        Search Console or Analytics at any time from the app&apos;s settings,
        which deletes the stored tokens. You can also revoke access at{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
        >
          myaccount.google.com/permissions
        </a>
        . To delete your account and its data, email{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>

      <h2>Security</h2>
      <p>
        Data is stored on servers controlled by the operator and transmitted
        over HTTPS. Access is limited to the people who run this installation.
      </p>

      <h2>Changes</h2>
      <p>We will update the date above when this policy changes.</p>
    </LegalPage>
  );
}
