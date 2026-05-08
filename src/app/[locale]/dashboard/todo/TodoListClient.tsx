"use client";

import { useState, useTransition } from "react";
import {
  createTodo,
  toggleTodoDone,
  updateTodoText,
  deleteTodo,
} from "./actions";

export type TodoRow = {
  id: string;
  text: string;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

type FilterKey = "today" | "open" | "all";

const TODAY_MS = 1000 * 60 * 60 * 24;

function isToday(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < TODAY_MS;
}

export function TodoListClient({ initial }: { initial: TodoRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("open");
  const [draft, setDraft] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();

  // per-row pending state
  const [edit, setEdit] = useState<{
    id: string;
    field: "check" | "text";
    value: string | boolean;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const counts = {
    today: initial.filter((t) => isToday(t.created_at) && !t.done).length,
    open: initial.filter((t) => !t.done).length,
    all: initial.length,
  };

  const visible = (() => {
    switch (filter) {
      case "today":
        return initial.filter((t) => isToday(t.created_at));
      case "open":
        return initial.filter((t) => !t.done);
      case "all":
        return initial;
    }
  })().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.created_at.localeCompare(a.created_at);
  });

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    setGlobalError(null);
    startAdd(async () => {
      const res = await createTodo(text);
      if (!res.ok) {
        setGlobalError(res.error);
      } else {
        setDraft("");
      }
    });
  };

  const handleSaveCheck = async (id: string, nextDone: boolean) => {
    setSavingId(id);
    setGlobalError(null);
    const res = await toggleTodoDone(id, nextDone);
    setSavingId(null);
    if (!res.ok) setGlobalError(res.error);
    setEdit(null);
  };

  const handleSaveText = async (id: string, nextText: string) => {
    setSavingId(id);
    setGlobalError(null);
    const res = await updateTodoText(id, nextText);
    setSavingId(null);
    if (!res.ok) setGlobalError(res.error);
    setEdit(null);
  };

  const handleDelete = async (id: string) => {
    setSavingId(id);
    const res = await deleteTodo(id);
    setSavingId(null);
    if (!res.ok) setGlobalError(res.error);
    setConfirmDeleteId(null);
  };

  return (
    <section className="todo-page">
      <div className="todo-tabs" role="tablist">
        {(
          [
            ["today", "Todo วันนี้", counts.today],
            ["open", "ยังไม่เสร็จ", counts.open],
            ["all", "ทั้งหมด", counts.all],
          ] as Array<[FilterKey, string, number]>
        ).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`todo-tab${filter === key ? " active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="count">{n}</span>
          </button>
        ))}
      </div>

      <div className="todo-add">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="เพิ่ม todo ใหม่..."
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          maxLength={500}
        />
        <button
          type="button"
          className="todo-add-btn"
          onClick={handleAdd}
          disabled={adding || !draft.trim()}
        >
          {adding ? "..." : "+ เพิ่ม"}
        </button>
      </div>

      {globalError && (
        <div className="todo-error" style={{ marginBottom: 8 }}>
          {globalError}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="todo-empty">
          {filter === "today"
            ? "ไม่มี todo ที่สร้างวันนี้"
            : filter === "open"
              ? "ไม่มี todo ที่ค้างอยู่ — ดีมาก! 🎉"
              : "ยังไม่มี todo เลย"}
        </div>
      ) : (
        <div className="todo-table">
          {visible.map((t) => {
            const isEditingCheck =
              edit?.id === t.id && edit.field === "check";
            const isEditingText = edit?.id === t.id && edit.field === "text";
            const drawnDone = isEditingCheck
              ? (edit.value as boolean)
              : t.done;
            const drawnText = isEditingText ? String(edit.value) : t.text;

            return (
              <div key={t.id} className="todo-row">
                <button
                  type="button"
                  className={`todo-check${drawnDone ? " checked" : ""}${
                    isEditingCheck ? " dirty" : ""
                  }`}
                  aria-label={drawnDone ? "ยกเลิก done" : "tick done"}
                  onClick={() => {
                    if (isEditingText) return;
                    setEdit({
                      id: t.id,
                      field: "check",
                      value: !drawnDone,
                    });
                  }}
                />
                {isEditingText ? (
                  <input
                    autoFocus
                    type="text"
                    className="todo-text-input"
                    value={drawnText}
                    maxLength={500}
                    onChange={(e) =>
                      setEdit({
                        id: t.id,
                        field: "text",
                        value: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveText(t.id, drawnText);
                      if (e.key === "Escape") setEdit(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className={`todo-text${t.done ? " done" : ""}`}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      textAlign: "left",
                      width: "100%",
                      font: "inherit",
                      color: "inherit",
                    }}
                    onClick={() =>
                      setEdit({ id: t.id, field: "text", value: t.text })
                    }
                  >
                    {t.text}
                  </button>
                )}
                <div className="todo-actions">
                  <button
                    type="button"
                    className="todo-action-btn danger"
                    onClick={() => setConfirmDeleteId(t.id)}
                    aria-label="ลบ"
                  >
                    ลบ
                  </button>
                </div>

                {(isEditingCheck || isEditingText) && (
                  <div className="todo-confirm">
                    <span className="todo-confirm-text">
                      ยืนยันการแก้ไข?
                    </span>
                    <button
                      type="button"
                      className="todo-confirm-btn cancel"
                      onClick={() => setEdit(null)}
                      disabled={savingId === t.id}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      className="todo-confirm-btn save"
                      disabled={savingId === t.id}
                      onClick={() =>
                        isEditingCheck
                          ? handleSaveCheck(t.id, edit!.value as boolean)
                          : handleSaveText(t.id, drawnText)
                      }
                    >
                      {savingId === t.id ? "..." : "ยืนยันบันทึก"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmDeleteId && (
        <div
          className="lungnote-modal-overlay"
          onClick={() => setConfirmDeleteId(null)}
          role="dialog"
        >
          <div
            className="lungnote-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>ลบ todo นี้?</h3>
            <p>การลบนี้ไม่สามารถย้อนคืนได้</p>
            <div className="lungnote-modal-actions">
              <button
                type="button"
                className="todo-confirm-btn cancel"
                onClick={() => setConfirmDeleteId(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="todo-confirm-btn save"
                style={{
                  background: "var(--red)",
                  borderColor: "var(--red)",
                }}
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={savingId === confirmDeleteId}
              >
                {savingId === confirmDeleteId ? "..." : "ลบเลย"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
