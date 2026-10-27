import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { revalidateLogic } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SectionHeader } from "@/client/components/PageHeader";
import { useAppForm } from "@/client/components/form/useAppForm";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { organizationContextQueryOptions } from "@/client/features/team/organizationQueries";
import { clearLastProjectId } from "@/client/lib/active-project";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { getClientAuthMode } from "@/lib/auth-mode";
import { hasOrgPermission } from "@/lib/org-permissions";
import {
  deleteWorkspace,
  renameWorkspace,
} from "@/serverFunctions/organization";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(64),
});

// Rename and delete for the active workspace. Self-hosted (password mode)
// only; the server functions refuse elsewhere.
export function WorkspaceSettings() {
  const orgContextQuery = useQuery(organizationContextQueryOptions());
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const data = orgContextQuery.data;

  if (getClientAuthMode() !== "password" || !data) return null;

  const canRename = hasOrgPermission(data.role, { organization: ["update"] });
  const canDelete = hasOrgPermission(data.role, { organization: ["delete"] });
  const isOnlyWorkspace = data.organizations.length < 2;

  return (
    <section className="space-y-3">
      <SectionHeader title="Workspace" />
      {canRename ? (
        <RenameWorkspaceForm
          key={data.organizationId}
          name={data.organizationName}
        />
      ) : (
        <p className="text-sm" data-ph-mask>
          {data.organizationName}
        </p>
      )}
      {canDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Delete workspace</p>
            <p className="text-sm text-muted-foreground">
              {isOnlyWorkspace
                ? "This is your only workspace. Create another one before deleting it."
                : "Permanently deletes its projects and their data, and removes everyone from it."}
            </p>
          </div>
          <Button
            variant="destructive"
            disabled={isOnlyWorkspace}
            onClick={() => setIsDeleteOpen(true)}
          >
            Delete workspace
          </Button>
        </div>
      ) : null}
      {isDeleteOpen ? (
        <DeleteWorkspaceModal
          name={data.organizationName}
          onClose={() => setIsDeleteOpen(false)}
        />
      ) : null}
    </section>
  );
}

function RenameWorkspaceForm({ name }: { name: string }) {
  const queryClient = useQueryClient();
  const renameMutation = useMutation({
    mutationFn: (newName: string) =>
      renameWorkspace({ data: { name: newName } }),
    onSuccess: () => {
      toast.success("Workspace renamed");
      void queryClient.invalidateQueries({
        queryKey: organizationContextQueryOptions().queryKey,
      });
    },
    onError: (error: Error) => {
      toast.error(getStandardErrorMessage(error));
    },
  });

  const form = useAppForm({
    defaultValues: { name },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: nameSchema },
    onSubmit: ({ value }) => renameMutation.mutateAsync(value.name.trim()),
  });

  return (
    <form.AppForm>
      <form.Form className="flex items-end gap-2">
        <div className="flex-1">
          <form.AppField name="name">
            {(field) => <field.TextField label="Name" required />}
          </form.AppField>
        </div>
        <form.SubmitButton variant="outline">Save</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
}

function DeleteWorkspaceModal({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkspace({ data: { confirmName } }),
    onSuccess: () => {
      // The server switched to another workspace; the remembered project
      // belonged to the deleted one.
      clearLastProjectId();
      window.location.assign("/");
    },
    onError: (error: Error) => {
      toast.error(getStandardErrorMessage(error));
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !deleteMutation.isPending) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this workspace?</DialogTitle>
          <DialogDescription>
            Every project in{" "}
            <span className="font-medium text-foreground" data-ph-mask>
              {name}
            </span>{" "}
            and all of its keywords, rank tracking, audits and reports are
            deleted, and everyone is removed from it. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1.5 text-sm">
          <span>
            Type <span className="font-medium">{name}</span> to confirm
          </span>
          <Input
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            autoFocus
            autoComplete="off"
          />
        </label>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmName.trim() !== name}
            pending={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
