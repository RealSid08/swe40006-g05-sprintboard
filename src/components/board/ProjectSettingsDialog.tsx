import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LIMITS } from "../../../convex/model/domain";
import { errorMessage } from "~/lib/errors";
import { Field, FormError, Modal, Spinner } from "../ui";

export type ProjectSettingsValues = { name: string; description: string };

/** Owner-only: rename the project, edit its description, or delete it after typing its name. */
export function ProjectSettingsDialog({
  open,
  project,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  project: ProjectSettingsValues;
  onClose: () => void;
  onSave: (values: ProjectSettingsValues) => Promise<void>;
  onDelete: (confirmName: string) => Promise<void>;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Project settings">
      {open ? <SettingsBody project={project} onClose={onClose} onSave={onSave} onDelete={onDelete} /> : null}
    </Modal>
  );
}

function SettingsBody({
  project,
  onClose,
  onSave,
  onDelete,
}: {
  project: ProjectSettingsValues;
  onClose: () => void;
  onSave: (values: ProjectSettingsValues) => Promise<void>;
  onDelete: (confirmName: string) => Promise<void>;
}) {
  const [values, setValues] = useState(project);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);

  async function run(kind: "save" | "delete", action: () => Promise<void>) {
    setPending(kind);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(errorMessage(actionError));
      setPending(null);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void run("save", () => onSave(values));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <FormError message={error} />
        <Field label="Project name" htmlFor="settings-name">
          <input
            id="settings-name"
            className="input"
            required
            maxLength={LIMITS.projectName}
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
          />
        </Field>
        <Field label="Description" htmlFor="settings-description">
          <textarea
            id="settings-description"
            className="input"
            rows={3}
            maxLength={LIMITS.projectDescription}
            value={values.description}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending !== null || !values.name.trim()}>
            {pending === "save" ? <Spinner /> : null}
            Save settings
          </button>
        </div>
      </form>
      <div className="rounded-xl border border-danger/25 bg-danger-soft/50 p-4">
        <h3 className="text-sm font-semibold text-danger">Delete project</h3>
        <p className="mt-1 text-[13px] text-ink-soft">
          This removes the board, every task and the activity history for all members. Type{" "}
          <strong className="text-ink">{project.name}</strong> to confirm.
        </p>
        <div className="mt-3 flex gap-2">
          <label htmlFor="settings-confirm" className="sr-only">
            Type the project name to confirm deletion
          </label>
          <input
            id="settings-confirm"
            className="input h-9"
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn-danger h-9 shrink-0"
            disabled={pending !== null || confirmName.trim() !== project.name}
            onClick={() => void run("delete", () => onDelete(confirmName))}
          >
            {pending === "delete" ? <Spinner /> : <Trash2 className="size-4" aria-hidden="true" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
