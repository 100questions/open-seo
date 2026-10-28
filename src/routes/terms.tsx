import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/client/features/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service – OpenSEO" }] }),
  component: TermsPage,
});

// Public page linked from the Google OAuth consent screen of this self-hosted
// installation; it must stay reachable without signing in.
function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms cover your use of this installation of OpenSEO. By creating
        an account or connecting a Google service, you agree to them.
      </p>

      <h2>Use of the service</h2>
      <ul>
        <li>
          Only connect Google Search Console properties and Analytics accounts
          you are authorized to access.
        </li>
        <li>
          Do not use the service to break the law, abuse third-party APIs, or
          interfere with other users.
        </li>
        <li>You are responsible for keeping your sign-in credentials safe.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        You keep ownership of the data you add or connect. How we handle it is
        described in the <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Availability</h2>
      <p>
        The service is provided &quot;as is&quot;, without warranties. Data from
        third-party providers may be incomplete or delayed. We may change,
        suspend or end the service or your access at any time.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, the operator is not liable for indirect
        or consequential losses arising from your use of the service.
      </p>

      <h2>Changes</h2>
      <p>
        We will update the date above when these terms change. Continuing to use
        the service after a change means you accept the new terms.
      </p>
    </LegalPage>
  );
}
