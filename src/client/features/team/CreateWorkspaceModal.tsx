import { useMutation } from "@tanstack/react-query";
import { revalidateLogic } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { clearLastProjectId } from "@/client/lib/active-project";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { createWorkspace } from "@/serverFunctions/organization";

const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(64),
});

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const createMutation = useMutation({
    mutationFn: (name: string) => createWorkspace({ data: { name } }),
    onSuccess: () => {
      // The server already switched to the new workspace; the remembered
      // project belongs to the old one.
      clearLastProjectId();
      window.location.assign("/");
    },
    onError: (error: Error) => {
      toast.error(getStandardErrorMessage(error));
    },
  });

  const form = useAppForm({
    defaultValues: { name: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: workspaceSchema },
    onSubmit: ({ value }) => createMutation.mutateAsync(value.name.trim()),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !createMutation.isPending) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <form.AppForm>
          <form.Form className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New workspace</DialogTitle>
              <DialogDescription>
                A workspace has its own projects and its own team. People you
                invite to it see only its projects. You'll be its owner.
              </DialogDescription>
            </DialogHeader>
            <form.AppField name="name">
              {(field) => (
                <field.TextField
                  label="Name"
                  placeholder="Client X"
                  required
                  autoFocus
                />
              )}
            </form.AppField>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <form.SubmitButton>Create workspace</form.SubmitButton>
            </DialogFooter>
          </form.Form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
