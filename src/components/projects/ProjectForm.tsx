import { useState, type FormEvent } from "react";
import { LIMITS } from "../../../convex/model/domain";
import { errorMessage } from "~/lib/errors";
import { Field, FormError, Modal, Spinner } from "../ui";

export type ProjectInput = { name: string; description: string };

/** Create or edit a project's name and description. */
export function ProjectFormDialog({
  open,
  onClose,
  onSubmit,
  initial,
  title,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ProjectInput) => Promise<void>;
  initial?: ProjectInput;
  title: string;
  submitLabel: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {open ? (
        <ProjectFormBody initial={initial} onSubmit={onSubmit} onCancel={onClose} submitLabel={submitLabel} />
      ) : null}
    </Modal>
  );
}

function ProjectFormBody({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: ProjectInput;
  onSubmit: (input: ProjectInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onSubmit({ name, description });
    } catch (submitError) {
      setError(errorMessage(submitError));
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      <Field label="Project name" htmlFor="project-name">
        <input
          id="project-name"
          className="input"
          maxLength={LIMITS.projectName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
      </Field>
      <Field label="Description" htmlFor="project-description" hint="Optional. What is this project about?">
        <textarea
          id="project-description"
          className="input"
          rows={3}
          maxLength={LIMITS.projectDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending || !name.trim()}>
          {pending ? <Spinner /> : null}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
