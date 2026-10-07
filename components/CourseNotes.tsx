"use client";

import {
  faBold,
  faClock,
  faListOl,
  faListUl,
} from "@fortawesome/free-solid-svg-icons";
import { useLayoutEffect, useRef, useState } from "react";

import Icon from "@/components/Icon";
import { formatTime } from "@/lib/youtube";

type CourseNotesProps = {
  notes: string;
  currentTime: number;
  onChange: (notes: string) => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function markdownToHtml(markdown: string) {
  if (!markdown) {
    return "";
  }

  const lines = markdown.split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };
  const inlineHtml = (text: string) =>
    escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  for (const line of lines) {
    const unordered = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    const nextListType = unordered ? "ul" : ordered ? "ol" : null;

    if (nextListType) {
      if (listType !== nextListType) {
        closeList();
        html.push(`<${nextListType}>`);
        listType = nextListType;
      }
      html.push(`<li>${inlineHtml((unordered ?? ordered)?.[1] ?? "")}</li>`);
      continue;
    }

    closeList();
    html.push(line ? `<div>${inlineHtml(line)}</div>` : "<div><br></div>");
  }

  closeList();
  return html.join("");
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const content = Array.from(node.childNodes, serializeInline).join("");
  if (node.tagName === "B" || node.tagName === "STRONG") {
    return content ? `**${content}**` : "";
  }
  if (node.tagName === "BR") {
    return "\n";
  }
  return content;
}

function serializeEditor(editor: HTMLElement) {
  if (!editor.textContent?.replaceAll("\u00a0", " ").trim()) {
    return "";
  }

  return Array.from(editor.childNodes, (node) => {
    if (!(node instanceof HTMLElement)) {
      return serializeInline(node);
    }

    if (node.tagName === "UL" || node.tagName === "OL") {
      const isOrdered = node.tagName === "OL";
      return Array.from(node.children, (item, index) => {
        const text = Array.from(item.childNodes, serializeInline)
          .join("")
          .replace(/\n+$/, "");
        return `${isOrdered ? `${index + 1}.` : "-"} ${text}`;
      }).join("\n");
    }

    return serializeInline(node);
  }).join("\n");
}

export default function CourseNotes({
  notes,
  currentTime,
  onChange,
}: CourseNotesProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedNotesRef = useRef<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(!notes.trim());

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || notes === lastEmittedNotesRef.current) {
      return;
    }
    editor.innerHTML = markdownToHtml(notes);
    setIsEmpty(notes.trim().length === 0);
    lastEmittedNotesRef.current = notes;
  }, [notes]);

  const saveEditor = (editor: HTMLDivElement) => {
    const nextNotes = serializeEditor(editor);
    const normalizedNotes = nextNotes.trim().length === 0 ? "" : nextNotes;
    setIsEmpty(normalizedNotes.length === 0);
    lastEmittedNotesRef.current = normalizedNotes;
    onChange(normalizedNotes);
  };

  const format = (
    command: "bold" | "insertUnorderedList" | "insertOrderedList",
  ) => {
    editorRef.current?.focus();
    document.execCommand(command);
    if (editorRef.current) {
      saveEditor(editorRef.current);
    }
  };

  const insertTimestamp = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.focus();
    document.execCommand("insertText", false, `[${formatTime(currentTime)}] `);
    saveEditor(editor);
  };

  const buttons = [
    {
      label: "Bold",
      icon: faBold,
      onClick: () => format("bold"),
    },
    {
      label: "Bulleted list",
      icon: faListUl,
      onClick: () => format("insertUnorderedList"),
    },
    {
      label: "Numbered list",
      icon: faListOl,
      onClick: () => format("insertOrderedList"),
    },
    {
      label: "Insert timestamp",
      icon: faClock,
      onClick: insertTimestamp,
    },
  ];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
        <h2 className="text-lg font-semibold text-zinc-900">Notes</h2>
        <div
          role="toolbar"
          aria-label="Note formatting"
          className="flex items-center gap-1"
        >
          {buttons.map(({ label, icon, onClick }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClick}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
            >
              <Icon icon={icon} />
            </button>
          ))}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={editorRef}
          role="textbox"
          aria-label="Course notes"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => {
            saveEditor(event.currentTarget);
          }}
          className="relative z-0 h-full min-h-0 w-full overflow-x-hidden overflow-y-auto bg-transparent px-4 py-3 text-base leading-7 text-zinc-800 [overflow-wrap:anywhere] outline-none focus:ring-0 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
        />
        {isEmpty ? (
          <span className="pointer-events-none absolute left-4 top-3 z-10 text-base leading-7 text-zinc-400">
            Write your notes...
          </span>
        ) : null}
      </div>
    </section>
  );
}
