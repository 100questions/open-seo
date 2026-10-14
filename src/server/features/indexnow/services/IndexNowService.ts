import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { AppError } from "@/server/lib/errors";
import { readBoundedText } from "@/server/lib/scrape";

// Bing shares every submission with the other IndexNow engines (Yandex,
// Seznam, Naver, Yep, ...), so one request reaches all of them, and its status
// codes come from the largest participant.
const INDEXNOW_ENDPOINT = "https://www.bing.com/indexnow";
const REQUEST_TIMEOUT_MS = 10_000;

interface ProjectScope {
  projectId: string;
  organizationId: string;
}

interface IndexNowHostResult {
  host: string;
  urlCount: number;
  status: "submitted" | "failed";
  message: string;
}

async function loadProject(scope: ProjectScope) {
  const project = await ProjectRepository.getProjectForOrganization(
    scope.projectId,
    scope.organizationId,
  );
  if (!project) throw new AppError("NOT_FOUND");
  return project;
}

async function getSetup(scope: ProjectScope) {
  const project = await loadProject(scope);
  return { domain: project.domain, key: project.indexnowKey };
}

/** The project's key, created on first use. The project needs a website. */
async function setUp(scope: ProjectScope) {
  const project = await loadProject(scope);
  if (!project.domain) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Add the project's website before using IndexNow.",
    );
  }
  if (project.indexnowKey) {
    return { domain: project.domain, key: project.indexnowKey, created: false };
  }
  await ProjectRepository.setIndexNowKeyIfMissing(
    scope.projectId,
    scope.organizationId,
    crypto.randomUUID().replaceAll("-", ""),
  );
  // Re-read: a concurrent first use may have saved its key instead.
  const saved = await loadProject(scope);
  if (!saved.indexnowKey) throw new AppError("NOT_FOUND");
  return { domain: project.domain, key: saved.indexnowKey, created: true };
}

/**
 * Catches the setup mistakes engines would otherwise reject later: a missing
 * file, a page served in its place, or a redirect (engines want the file
 * itself). Anything inconclusive, like a bot wall or a timeout, returns null
 * and the submission goes ahead.
 */
async function findKeyFileProblem(
  host: string,
  key: string,
): Promise<string | null> {
  const url = `https://${host}/${key}.txt`;
  let response: Response;
  try {
    response = await fetch(await normalizeAndValidateStartUrl(url), {
      headers: { "user-agent": "OpenSEO-IndexNow/1.0 (+https://openseo.so)" },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    if (response.status === 404 || response.status === 410) {
      return `No key file at the root of https://${host}. Upload it there, then try again.`;
    }
    if (response.status >= 300 && response.status < 400) {
      return `The key file on https://${host} redirects. Upload it to https://${host} itself.`;
    }
    return null;
  }
  // A body that stalls or drops mid-read is inconclusive, like a timeout.
  const body = await readBoundedText(response).catch(() => undefined);
  if (body === undefined || body?.trim() === key) return null;
  return `The key file on https://${host} should contain only the key.`;
}

function describeResponse(
  status: number,
  urlCount: number,
  host: string,
): Pick<IndexNowHostResult, "status" | "message"> {
  const urls = `${urlCount} URL${urlCount === 1 ? "" : "s"}`;
  switch (status) {
    case 200:
      return { status: "submitted", message: `Submitted ${urls}.` };
    case 202:
      return {
        status: "submitted",
        message: `Submitted ${urls}. Search engines will verify the key file on https://${host} first.`,
      };
    case 403:
      return {
        status: "failed",
        message: `The key wasn't accepted. Check that the key file on https://${host} contains only the key.`,
      };
    case 429:
      return {
        status: "failed",
        message:
          "Too many submissions for this site. Wait before trying again, and only submit pages that changed.",
      };
    default:
      return {
        status: "failed",
        message: `IndexNow returned HTTP ${status}.`,
      };
  }
}

async function submitHost(
  host: string,
  key: string,
  urlList: string[],
): Promise<IndexNowHostResult> {
  const base = { host, urlCount: urlList.length };
  const problem = await findKeyFileProblem(host, key);
  if (problem) return { ...base, status: "failed", message: problem };

  let response: Response;
  try {
    response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, urlList }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("indexnow.submit network error", error);
    return {
      ...base,
      status: "failed",
      message: "IndexNow didn't respond. Try again later.",
    };
  }
  if (response.status >= 300) {
    console.warn(`indexnow.submit HTTP ${response.status} for ${host}`);
  }
  return {
    ...base,
    ...describeResponse(response.status, urlList.length, host),
  };
}

/**
 * Sends URLs on the project's website to IndexNow, one request per host.
 * URLs off the website are skipped rather than failing the whole call.
 */
async function submitUrls(scope: ProjectScope, urls: string[]) {
  const { domain, key, created } = await setUp(scope);

  const byHost = new Map<string, Set<string>>();
  const skipped: string[] = [];
  for (const raw of urls) {
    const url = URL.parse(raw.trim());
    const host = url?.hostname ?? "";
    if (
      !url ||
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      (host !== domain && !host.endsWith(`.${domain}`))
    ) {
      skipped.push(raw);
      continue;
    }
    url.hash = "";
    const hostUrls = byHost.get(host) ?? new Set<string>();
    hostUrls.add(url.toString());
    byHost.set(host, hostUrls);
  }

  const hosts: IndexNowHostResult[] = [];
  for (const [host, hostUrls] of byHost) {
    hosts.push(await submitHost(host, key, [...hostUrls]));
  }
  return { key, keyCreated: created, hosts, skipped };
}

export const IndexNowService = {
  getSetup,
  setUp,
  submitUrls,
} as const;
