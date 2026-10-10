"use client";

import {
  faBold,
  faClock,
  faListOl,
  faListUl,
} from "@fortawesome/free-solid-svg-icons";
import {
  type ClipboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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

// Notes are saved as this small subset of HTML, so the editor shows them
// after a reload exactly as they looked while they were written.
const NOTE_TAGS: Record<string, string> = {
  A: "a",
  B: "strong",
  BLOCKQUOTE: "blockquote",
  BR: "br",
  CODE: "code",
  DEL: "s",
  DIV: "div",
  EM: "em",
  H1: "h1",
  H2: "h2",
  H3: "h3",
  H4: "h3",
  H5: "h3",
  H6: "h3",
  HR: "hr",
  I: "em",
  LI: "li",
  OL: "ol",
  P: "p",
  PRE: "pre",
  S: "s",
  STRIKE: "s",
  STRONG: "strong",
  TR: "div",
  U: "u",
  UL: "ul",
};
const BLOCK_TAGS = new Set([
  "blockquote",
  "div",
  "h1",
  "h2",
  "h3",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "ul",
]);
const DROPPED_TAGS = new Set([
  "AUDIO",
  "BUTTON",
  "CANVAS",
  "EMBED",
  "HEAD",
  "IFRAME",
  "IMG",
  "INPUT",
  "LINK",
  "MATH",
  "META",
  "NOSCRIPT",
  "OBJECT",
  "SCRIPT",
  "SELECT",
  "STYLE",
  "SVG",
  "TEMPLATE",
  "TEXTAREA",
  "TITLE",
  "VIDEO",
]);
const HTML_NOTES_PATTERN = /^<(?:blockquote|div|h[1-3]|hr|li|ol|p|pre|ul)[\s>]/;

function isBlock(node: Node) {
  return node instanceof Element && BLOCK_TAGS.has(node.tagName.toLowerCase());
}

function cleanNode(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [doc.createTextNode(node.textContent ?? "")];
  }
  if (!(node instanceof Element) || DROPPED_TAGS.has(node.tagName)) {
    return [];
  }

  let children = Array.from(node.childNodes, (child) =>
    cleanNode(child, doc),
  ).flat();
  // Pasted text often carries its bold or italics as inline styles.
  const style = node instanceof HTMLElement ? node.style : null;
  const weight = style?.fontWeight ?? "";
  const isStyledBold =
    weight === "bold" || weight === "bolder" || Number(weight) >= 600;
  const isStyledNormal = weight !== "" && !isStyledBold;
  let tag: string | undefined = NOTE_TAGS[node.tagName];
  if (tag === "strong" && isStyledNormal) {
    tag = undefined;
  }

  if (!children.some(isBlock)) {
    if (style?.fontStyle === "italic" && tag !== "em") {
      const em = doc.createElement("em");
      em.append(...children);
      children = [em];
    }
    if (isStyledBold && tag !== "strong") {
      const strong = doc.createElement("strong");
      strong.append(...children);
      children = [strong];
    }
  }

  if (!tag) {
    return children;
  }
  const element = doc.createElement(tag);
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    if (!/^(?:https?:|mailto:)/i.test(href)) {
      return children;
    }
    element.setAttribute("href", href);
  }
  element.append(...children);
  return [element];
}

function sanitizeNotesHtml(html: string, wrapLines: boolean) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const doc = template.content.ownerDocument;
  const nodes = Array.from(template.content.childNodes, (node) =>
    cleanNode(node, doc),
  ).flat();

  const output = doc.createElement("div");
  if (!wrapLines) {
    output.append(...nodes);
    return output.innerHTML;
  }

  // Editors leave the first line as bare text, so each run of inline
  // content becomes its own line and the saved notes start with a tag.
  let line: Node[] = [];
  const flushLine = () => {
    if (
      line.some((node) => node.textContent?.trim() || node.nodeName === "BR")
    ) {
      const div = doc.createElement("div");
      div.append(...line);
      output.append(div);
    }
    line = [];
  };
  for (const node of nodes) {
    if (isBlock(node)) {
      flushLine();
      output.append(node);
    } else {
      line.push(node);
    }
  }
  flushLine();
  trimLeadingBlanks(output);
  return output.innerHTML;
}

// Blank lines and line breaks above the first note would only push it down.
function trimLeadingBlanks(container: Element) {
  let node = container.firstChild;
  while (node) {
    const next = node.nextSibling;
    const isBlank =
      node.nodeName === "BR" ||
      (!node.textContent?.trim() &&
        !(node instanceof Element && node.matches("hr, :has(hr)")));
    if (!isBlank) {
      if (node instanceof Element && node.nodeName !== "PRE") {
        trimLeadingBlanks(node);
      }
      return;
    }
    node.remove();
    node = next;
  }
}

function notesToHtml(notes: string) {
  if (!notes) {
    return "";
  }
  // Older notes were saved as Markdown.
  return sanitizeNotesHtml(
    HTML_NOTES_PATTERN.test(notes) ? notes : markdownToHtml(notes),
    true,
  );
}

function serializeEditor(editor: HTMLElement) {
  if (
    !editor.textContent?.replaceAll("\u00a0", " ").trim() &&
    !editor.querySelector("hr")
  ) {
    return "";
  }
  return sanitizeNotesHtml(editor.innerHTML, true);
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
    editor.innerHTML = notesToHtml(notes);
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

  const pasteNotes = (event: ClipboardEvent<HTMLDivElement>) => {
    const html = event.clipboardData.getData("text/html");
    if (!html) {
      return;
    }
    // Keep only the formatting the notes can save, so pasted text looks the
    // same now as it will after a reload.
    event.preventDefault();
    document.execCommand("insertHTML", false, sanitizeNotesHtml(html, false));
    saveEditor(event.currentTarget);
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
          onPaste={pasteNotes}
          className="relative z-0 h-full min-h-0 w-full overflow-x-hidden overflow-y-auto bg-transparent px-4 py-3 text-base leading-7 text-zinc-800 [overflow-wrap:anywhere] outline-none focus:ring-0 course-notes-editor"
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
