import { beforeEach, describe, expect, it, vi } from "vitest";
import { IndexNowService } from "./IndexNowService";

const { getProject, setKey } = vi.hoisted(() => ({
  getProject: vi.fn(),
  setKey: vi.fn(),
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: {
    getProjectForOrganization: getProject,
    setIndexNowKeyIfMissing: setKey,
  },
}));
// The SSRF guard resolves DNS; these tests only cover IndexNow behavior.
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
}));

const KEY = "abc123def456";
const scope = { projectId: "p1", organizationId: "o1" };
const fetchMock = vi.fn<typeof fetch>();

const isBing = (input: Parameters<typeof fetch>[0]) =>
  (input instanceof Request ? input.url : input.toString()).startsWith(
    "https://www.bing.com/",
  );

// Key files answer with `keyFile`; the Bing endpoint answers with `bing`.
function respond(
  keyFile: Response,
  bing = new Response(null, { status: 200 }),
) {
  fetchMock.mockImplementation(async (input) =>
    isBing(input) ? bing.clone() : keyFile.clone(),
  );
}

function bingBodies(): unknown[] {
  return fetchMock.mock.calls
    .filter(([input]) => isBing(input))
    .map(([, init]): unknown =>
      typeof init?.body === "string" ? JSON.parse(init.body) : null,
    );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  getProject.mockResolvedValue({ domain: "example.com", indexnowKey: KEY });
  respond(new Response(KEY));
});

describe("IndexNowService.submitUrls", () => {
  it("submits one request per host on the project's website and skips the rest", async () => {
    const result = await IndexNowService.submitUrls(scope, [
      "https://example.com/a#section",
      "https://www.example.com/b",
      "https://example.com/a",
      "https://notexample.com/c",
      "not a url",
    ]);

    expect(bingBodies()).toEqual([
      { host: "example.com", key: KEY, urlList: ["https://example.com/a"] },
      {
        host: "www.example.com",
        key: KEY,
        urlList: ["https://www.example.com/b"],
      },
    ]);
    expect(result.hosts.map((host) => host.status)).toEqual([
      "submitted",
      "submitted",
    ]);
    expect(result.skipped).toHaveLength(2);
  });

  it("creates the key on first use and returns the saved one", async () => {
    getProject.mockResolvedValueOnce({
      domain: "example.com",
      indexnowKey: null,
    });

    const result = await IndexNowService.submitUrls(scope, [
      "https://example.com/a",
    ]);

    expect(setKey).toHaveBeenCalledOnce();
    // The re-read wins, so a key saved by a parallel call is the one used.
    expect(result).toMatchObject({ key: KEY, keyCreated: true });
  });

  it("refuses a project without a website before creating a key", async () => {
    getProject.mockResolvedValue({ domain: null, indexnowKey: null });

    await expect(
      IndexNowService.submitUrls(scope, ["https://example.com/a"]),
    ).rejects.toThrow("Add the project's website");
    expect(setKey).not.toHaveBeenCalled();
  });

  it.each([
    ["is missing", new Response("Not found", { status: 404 })],
    ["holds a different page", new Response("<html>Home</html>")],
    [
      "redirects",
      new Response(null, {
        status: 301,
        headers: { location: "https://www.example.com/" },
      }),
    ],
  ])("doesn't submit when the key file %s", async (_case, keyFile) => {
    respond(keyFile);

    const result = await IndexNowService.submitUrls(scope, [
      "https://example.com/a",
    ]);

    expect(bingBodies()).toEqual([]);
    expect(result.hosts[0]?.status).toBe("failed");
  });

  it("submits anyway when a bot wall hides the key file", async () => {
    respond(
      new Response("Forbidden", { status: 403 }),
      new Response(null, { status: 202 }),
    );

    const result = await IndexNowService.submitUrls(scope, [
      "https://example.com/a",
    ]);

    expect(bingBodies()).toHaveLength(1);
    expect(result.hosts[0]?.status).toBe("submitted");
  });

  it("reports a key IndexNow rejects", async () => {
    respond(new Response(KEY), new Response(null, { status: 403 }));

    const result = await IndexNowService.submitUrls(scope, [
      "https://example.com/a",
    ]);

    expect(result.hosts[0]?.status).toBe("failed");
    expect(result.hosts[0]?.message).toContain("https://example.com");
  });
});
