"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

type Props = {
  initialTitle?: string;
  initialBody?: string;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string } | void>;
  onDelete?: () => Promise<void>;
};

export function NoteForm({
  initialTitle = "",
  initialBody = "",
  submitLabel,
  cancelHref,
  onSubmit,
  onDelete,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(formData);
      if (result && "ok" in result && !result.ok) setError(result.error);
    });
  };

  const handleDelete = () => {
    if (!onDelete) return;
    if (!confirm("ลบโน้ตนี้ ใช่ไหม?")) return;
    startDeleteTransition(async () => {
      await onDelete();
    });
  };

  return (
    <form action={handleSubmit} className="note-form">
      <label>
        ชื่อโน้ต
        <input
          name="title"
          defaultValue={initialTitle}
          placeholder="ชื่อโน้ตเล่มนี้..."
          required
          maxLength={200}
          autoFocus={!initialTitle}
        />
      </label>
      <label>
        เนื้อหา
        <textarea
          name="body"
          defaultValue={initialBody}
          placeholder="เริ่มจดได้เลย..."
        />
      </label>
      {error && <div className="note-form-error">{error}</div>}
      <div className="note-form-actions">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "กำลังบันทึก..." : submitLabel}
        </button>
        <Link href={cancelHref} className="btn-secondary">
          ยกเลิก
        </Link>
        {onDelete && (
          <button
            type="button"
            className="btn-danger"
            onClick={handleDelete}
            disabled={deleting}
            style={{ marginLeft: "auto" }}
          >
            {deleting ? "กำลังลบ..." : "ลบ"}
          </button>
        )}
      </div>
    </form>
  );
}
