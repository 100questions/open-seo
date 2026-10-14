import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { revalidateLogic } from "@tanstack/react-form";
import { useAppForm } from "@/client/components/form/useAppForm";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { Button } from "@/client/components/ui/button";
import {
  getIndexNowSetup,
  setUpIndexNow,
  submitIndexNowUrls,
} from "@/serverFunctions/indexnow";

const urlsSchema = z.object({
  urls: z
    .string()
    .refine((value) => splitUrls(value).length > 0, "Enter at least one URL."),
});

function splitUrls(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const pluralUrls = (count: number) => `${count} URL${count === 1 ? "" : "s"}`;

function downloadKeyFile(key: string) {
  const url = URL.createObjectURL(new Blob([key], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${key}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * IndexNow tells Bing and the other participating engines which pages
 * changed. The site proves ownership by hosting the project's key file.
 */
export function IndexNowSettings({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const setupQueryKey = ["indexnow-setup", projectId];
  const setupQuery = useQuery({
    queryKey: setupQueryKey,
    queryFn: () => getIndexNowSetup({ data: { projectId } }),
    // Website edits elsewhere don't invalidate this, so refetch on each visit.
    staleTime: 0,
  });

  const setUpMutation = useMutation({
    mutationFn: () => setUpIndexNow({ data: { projectId } }),
    onSuccess: (setup) => queryClient.setQueryData(setupQueryKey, setup),
  });

  const submitMutation = useMutation({
    mutationFn: (urls: string[]) =>
      submitIndexNowUrls({ data: { projectId, urls } }),
  });

  const form = useAppForm({
    defaultValues: { urls: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: urlsSchema },
    onSubmit: async ({ value, formApi }) => {
      const result = await submitMutation.mutateAsync(splitUrls(value.urls));
      const failed = result.hosts.filter((host) => host.status === "failed");
      const sent = result.hosts
        .filter((host) => host.status === "submitted")
        .reduce((count, host) => count + host.urlCount, 0);

      for (const host of failed) {
        toast.error("Couldn't submit to IndexNow", {
          description: host.message,
          duration: 10_000,
        });
      }
      if (sent > 0) toast.success(`Submitted ${pluralUrls(sent)}`);
      if (result.skipped.length > 0) {
        toast.warning(
          `Skipped ${pluralUrls(result.skipped.length)} not on ${setupQuery.data?.domain}`,
        );
      }
      if (failed.length === 0 && sent > 0) formApi.reset();
    },
  });

  if (setupQuery.isError) {
    return (
      <section id="indexnow" className="scroll-mt-6">
        <CardShell title="IndexNow">
          <QueryError
            error={setupQuery.error}
            fallback="Couldn't load IndexNow."
            onRetry={() => void setupQuery.refetch()}
            isRetrying={setupQuery.isFetching}
          />
        </CardShell>
      </section>
    );
  }
  if (!setupQuery.data) return null;
  const { domain, key } = setupQuery.data;

  return (
    <section id="indexnow" className="scroll-mt-6">
      <CardShell title="IndexNow">
        <div className="flex flex-1 flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            Bing and other search engines recrawl the pages you submit sooner.
            Google doesn't support IndexNow.
          </p>
          {!domain ? (
            <p className="text-muted-foreground">
              Add your website in General settings to use IndexNow.
            </p>
          ) : !key ? (
            <div className="mt-auto flex justify-end">
              <Button
                variant="outline"
                size="sm"
                pending={setUpMutation.isPending}
                onClick={() => setUpMutation.mutate()}
              >
                Set up IndexNow
              </Button>
            </div>
          ) : (
            <ol className="space-y-5">
              <Step number={1} title="Download your key file">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => downloadKeyFile(key)}
                >
                  <Download className="size-4" />
                  Download key file
                </Button>
              </Step>
              <Step number={2} title="Upload it to the root of your site">
                <p className="text-muted-foreground">
                  It should open at{" "}
                  <SafeExternalLink
                    url={`https://${domain}/${key}.txt`}
                    label={`https://${domain}/${key}.txt`}
                    className="inline-flex items-center gap-1 font-mono break-all text-foreground underline underline-offset-2"
                  />
                </p>
                <p className="text-muted-foreground">
                  If your pages are on www.{domain}, upload it there too.
                </p>
              </Step>
              <Step
                number={3}
                title="Submit pages you added, changed or removed"
              >
                <form.AppForm>
                  <form.Form className="space-y-3">
                    <form.AppField name="urls">
                      {(field) => (
                        <field.TextareaField
                          label={
                            <span className="text-xs font-normal text-muted-foreground">
                              URLs (one per line)
                            </span>
                          }
                          placeholder={`https://${domain}/new-page`}
                          className="min-h-28 font-mono text-xs"
                        />
                      )}
                    </form.AppField>
                    <form.SubmitButton>Submit to IndexNow</form.SubmitButton>
                  </form.Form>
                </form.AppForm>
              </Step>
            </ol>
          )}
        </div>
      </CardShell>
    </section>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}
