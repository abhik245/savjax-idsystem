"use client";

/**
 * TemplateEditor — full ID card template editor
 *
 * Layout:
 *   ┌─────────────┬──────────────────────────────┬──────────────┐
 *   │  Left panel │        Canvas area           │ Right panel  │
 *   │  (elements) │  (zoomable card preview)     │ (properties) │
 *   └─────────────┴──────────────────────────────┴──────────────┘
 *
 * Features:
 * • Drag-to-move, resize handles, rotation
 * • Undo / Redo (50-step history)
 * • Zoom in / out
 * • Add text, photo placeholder, shapes, QR code
 * • Token binding (student_name, school_name, …)
 * • Export template JSON
 * • Background color / gradient picker
 */

import { useCallback, useReducer, useRef, useState } from "react";
import {
  ChevronDown,
  Clipboard,
  Download,
  Grid,
  Layers,
  Minus,
  Plus,
  QrCode,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Type,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Camera
} from "lucide-react";
import {
  AnyElement,
  CardTemplate,
  HistoryEntry,
  CARD_SIZES,
  CardSizePreset
} from "./types";
import {
  uid,
  deepClone,
  makeText,
  makePhoto,
  makeShape,
  makeQr,
  nextZ
} from "./utils";
import CardCanvas from "./CardCanvas";
import PropertiesPanel from "./PropertiesPanel";

// ── State ────────────────────────────────────────────────────────────────────

type State = {
  template: CardTemplate;
  history: HistoryEntry[];
  historyIndex: number;
  selectedId: string | null;
  zoom: number;
};

type Action =
  | { type: "SELECT"; id: string | null }
  | { type: "UPDATE_ELEMENT"; element: AnyElement }
  | { type: "UPDATE_BACKGROUND"; bg: Partial<CardTemplate["background"]> }
  | { type: "ADD_ELEMENT"; element: AnyElement }
  | { type: "DELETE_ELEMENT"; id: string }
  | { type: "DUPLICATE_ELEMENT"; id: string }
  | { type: "Z_INDEX"; id: string; direction: "up" | "down" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "LOAD_TEMPLATE"; template: CardTemplate };

const MAX_HISTORY = 50;

function pushHistory(state: State, entry: HistoryEntry): Pick<State, "history" | "historyIndex"> {
  const trimmed = state.history.slice(0, state.historyIndex + 1);
  const next = [...trimmed, entry].slice(-MAX_HISTORY);
  return { history: next, historyIndex: next.length - 1 };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT":
      return { ...state, selectedId: action.id };

    case "UPDATE_ELEMENT": {
      const elements = state.template.elements.map((e) =>
        e.id === action.element.id ? action.element : e
      );
      const template = { ...state.template, elements, updatedAt: new Date().toISOString() };
      return {
        ...state,
        template,
        ...pushHistory(state, { elements, background: template.background })
      };
    }

    case "UPDATE_BACKGROUND": {
      const background = { ...state.template.background, ...action.bg };
      const template = { ...state.template, background, updatedAt: new Date().toISOString() };
      return {
        ...state,
        template,
        ...pushHistory(state, { elements: template.elements, background })
      };
    }

    case "ADD_ELEMENT": {
      const elements = [...state.template.elements, action.element];
      const template = { ...state.template, elements, updatedAt: new Date().toISOString() };
      return {
        ...state,
        template,
        selectedId: action.element.id,
        ...pushHistory(state, { elements, background: template.background })
      };
    }

    case "DELETE_ELEMENT": {
      const elements = state.template.elements.filter((e) => e.id !== action.id);
      const template = { ...state.template, elements, updatedAt: new Date().toISOString() };
      return {
        ...state,
        template,
        selectedId: null,
        ...pushHistory(state, { elements, background: template.background })
      };
    }

    case "DUPLICATE_ELEMENT": {
      const src = state.template.elements.find((e) => e.id === action.id);
      if (!src) return state;
      const clone: AnyElement = {
        ...deepClone(src),
        id: uid(),
        x: src.x + 4,
        y: src.y + 4,
        zIndex: nextZ(state.template.elements)
      };
      const elements = [...state.template.elements, clone];
      const template = { ...state.template, elements, updatedAt: new Date().toISOString() };
      return {
        ...state,
        template,
        selectedId: clone.id,
        ...pushHistory(state, { elements, background: template.background })
      };
    }

    case "Z_INDEX": {
      const el = state.template.elements.find((e) => e.id === action.id);
      if (!el) return state;
      const delta = action.direction === "up" ? 1 : -1;
      const elements = state.template.elements.map((e) =>
        e.id === action.id ? { ...e, zIndex: Math.max(0, e.zIndex + delta) } : e
      );
      const template = { ...state.template, elements, updatedAt: new Date().toISOString() };
      return {
        ...state,
        template,
        ...pushHistory(state, { elements, background: template.background })
      };
    }

    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const entry = state.history[newIndex];
      return {
        ...state,
        historyIndex: newIndex,
        template: { ...state.template, elements: entry.elements, background: entry.background }
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const entry = state.history[newIndex];
      return {
        ...state,
        historyIndex: newIndex,
        template: { ...state.template, elements: entry.elements, background: entry.background }
      };
    }

    case "SET_ZOOM":
      return { ...state, zoom: action.zoom };

    case "LOAD_TEMPLATE":
      return {
        ...state,
        template: action.template,
        selectedId: null,
        history: [{ elements: action.template.elements, background: action.template.background }],
        historyIndex: 0
      };

    default:
      return state;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  initialTemplate: CardTemplate;
  onSave?: (template: CardTemplate) => Promise<void>;
};

export default function TemplateEditor({ initialTemplate, onSave }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    template: initialTemplate,
    history: [
      { elements: initialTemplate.elements, background: initialTemplate.background }
    ],
    historyIndex: 0,
    selectedId: null,
    zoom: 3 // 3× scaling makes 85.6mm card look good on screen
  });

  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Shortcuts ─────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      }
      if ((ctrl && e.key === "y") || (ctrl && e.shiftKey && e.key === "z")) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && state.selectedId) {
          dispatch({ type: "DELETE_ELEMENT", id: state.selectedId });
        }
      }
      if (ctrl && e.key === "d" && state.selectedId) {
        e.preventDefault();
        dispatch({ type: "DUPLICATE_ELEMENT", id: state.selectedId });
      }
    },
    [state.selectedId]
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const addText = () => {
    dispatch({
      type: "ADD_ELEMENT",
      element: makeText({ zIndex: nextZ(state.template.elements) })
    });
  };

  const addPhoto = () => {
    dispatch({
      type: "ADD_ELEMENT",
      element: makePhoto({ zIndex: nextZ(state.template.elements) })
    });
  };

  const addShape = (shape: "rect" | "circle" | "line") => {
    dispatch({
      type: "ADD_ELEMENT",
      element: makeShape({
        shape,
        x: 10,
        y: 10,
        w: shape === "line" ? 60 : 30,
        h: shape === "line" ? 2 : 20,
        zIndex: nextZ(state.template.elements)
      })
    });
  };

  const addQr = () => {
    dispatch({
      type: "ADD_ELEMENT",
      element: makeQr({ zIndex: nextZ(state.template.elements) })
    });
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(state.template);
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state.template, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.template.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as CardTemplate;
        dispatch({ type: "LOAD_TEMPLATE", template: data });
      } catch {
        alert("Invalid template JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-full min-h-screen bg-gray-950 text-gray-100 overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: "none" }}
    >
      {/* ── Left panel: add elements ── */}
      <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col gap-1 p-3 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
          Add Element
        </p>

        <ToolButton icon={<Type size={14} />} label="Text" onClick={addText} />
        <ToolButton icon={<Camera size={14} />} label="Photo Placeholder" onClick={addPhoto} />
        <ToolButton icon={<QrCode size={14} />} label="QR Code" onClick={addQr} />

        <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mt-3 mb-1">
          Shapes
        </p>
        <ToolButton icon={<Square size={14} />} label="Rectangle" onClick={() => addShape("rect")} />
        <ToolButton icon={<div className="w-3.5 h-3.5 rounded-full border-2 border-current" />} label="Circle" onClick={() => addShape("circle")} />
        <ToolButton
          icon={<div className="w-3.5 h-0.5 bg-current mt-1.5" />}
          label="Line"
          onClick={() => addShape("line")}
        />

        <div className="border-t border-gray-800 my-3" />

        {/* Layer list */}
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
          Layers ({state.template.elements.length})
        </p>
        <div className="space-y-0.5 overflow-y-auto max-h-64">
          {[...state.template.elements]
            .sort((a, b) => b.zIndex - a.zIndex)
            .map((el) => (
              <button
                key={el.id}
                onClick={() => dispatch({ type: "SELECT", id: el.id })}
                className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-1.5 truncate transition ${
                  state.selectedId === el.id
                    ? "bg-blue-700 text-white"
                    : "hover:bg-gray-800 text-gray-400"
                }`}
              >
                <LayerIcon type={el.type} />
                <span className="truncate">{layerLabel(el)}</span>
                {el.locked && <span className="ml-auto text-[9px] text-gray-600">🔒</span>}
              </button>
            ))}
        </div>
      </aside>

      {/* ── Main canvas area ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <header className="h-11 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center gap-2 px-3">
          {/* Template name */}
          <input
            className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 focus:outline-none text-gray-200 w-48 px-1"
            value={state.template.name}
            onChange={(e) =>
              dispatch({
                type: "LOAD_TEMPLATE",
                template: { ...state.template, name: e.target.value }
              })
            }
          />

          <div className="flex-1" />

          {/* Undo / Redo */}
          <button
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={() => dispatch({ type: "UNDO" })}
            className={`p-1.5 rounded transition ${canUndo ? "hover:bg-gray-700 text-gray-300" : "text-gray-700 cursor-not-allowed"}`}
          >
            <Undo2 size={15} />
          </button>
          <button
            title="Redo (Ctrl+Y)"
            disabled={!canRedo}
            onClick={() => dispatch({ type: "REDO" })}
            className={`p-1.5 rounded transition ${canRedo ? "hover:bg-gray-700 text-gray-300" : "text-gray-700 cursor-not-allowed"}`}
          >
            <Redo2 size={15} />
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1" />

          {/* Zoom */}
          <button
            onClick={() => dispatch({ type: "SET_ZOOM", zoom: Math.max(1, state.zoom - 0.5) })}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-300 transition"
          >
            <ZoomOut size={15} />
          </button>
          <span className="text-xs text-gray-400 w-10 text-center">
            {Math.round(state.zoom * 100)}%
          </span>
          <button
            onClick={() => dispatch({ type: "SET_ZOOM", zoom: Math.min(6, state.zoom + 0.5) })}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-300 transition"
          >
            <ZoomIn size={15} />
          </button>

          {/* Grid toggle */}
          <button
            title="Toggle grid"
            onClick={() => setShowGrid((g) => !g)}
            className={`p-1.5 rounded transition ${showGrid ? "bg-blue-700 text-white" : "hover:bg-gray-700 text-gray-400"}`}
          >
            <Grid size={15} />
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1" />

          {/* Import */}
          <button
            title="Import JSON"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-300 transition"
          >
            <Upload size={15} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJson}
          />

          {/* Export */}
          <button
            title="Export JSON"
            onClick={handleExportJson}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-300 transition"
          >
            <Download size={15} />
          </button>

          {/* Save */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs font-semibold rounded transition"
            >
              <Save size={13} />
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </header>

        {/* Canvas scroll area */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-gray-950">
          <div
            className="relative"
            style={{
              backgroundImage: showGrid
                ? "radial-gradient(circle, #374151 1px, transparent 1px)"
                : undefined,
              backgroundSize: showGrid ? "20px 20px" : undefined
            }}
          >
            <CardCanvas
              template={state.template}
              selectedId={state.selectedId}
              onSelect={(id) => dispatch({ type: "SELECT", id })}
              onUpdate={(element) => dispatch({ type: "UPDATE_ELEMENT", element })}
              zoom={state.zoom}
            />
          </div>
        </div>

        {/* Status bar */}
        <footer className="h-6 shrink-0 bg-gray-900 border-t border-gray-800 flex items-center px-3 gap-4 text-[10px] text-gray-500">
          <span>
            {state.template.cardWidth.toFixed(1)} × {state.template.cardHeight.toFixed(1)} mm
          </span>
          <span>{state.template.elements.length} elements</span>
          {state.selectedId && (
            <span className="text-blue-400">
              ↕ Arrows to nudge · Del to delete · Ctrl+D to duplicate
            </span>
          )}
        </footer>
      </main>

      {/* ── Right panel: properties ── */}
      <PropertiesPanel
        template={state.template}
        selectedId={state.selectedId}
        onUpdate={(element) => dispatch({ type: "UPDATE_ELEMENT", element })}
        onUpdateBackground={(bg) => dispatch({ type: "UPDATE_BACKGROUND", bg })}
        onDelete={(id) => dispatch({ type: "DELETE_ELEMENT", id })}
        onDuplicate={(id) => dispatch({ type: "DUPLICATE_ELEMENT", id })}
        onZIndex={(id, direction) => dispatch({ type: "Z_INDEX", id, direction })}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ToolButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full text-left text-xs px-2.5 py-2 rounded hover:bg-gray-800 text-gray-300 transition"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </button>
  );
}

function LayerIcon({ type }: { type: AnyElement["type"] }) {
  switch (type) {
    case "text": return <Type size={10} className="text-blue-400 shrink-0" />;
    case "photo": return <Camera size={10} className="text-green-400 shrink-0" />;
    case "qr": return <QrCode size={10} className="text-purple-400 shrink-0" />;
    case "shape": return <Square size={10} className="text-orange-400 shrink-0" />;
    case "image": return <ImageIcon size={10} className="text-pink-400 shrink-0" />;
    default: return <Layers size={10} className="text-gray-400 shrink-0" />;
  }
}

function layerLabel(el: AnyElement): string {
  if (el.type === "text") {
    const t = el as import("./types").TextElement;
    return t.token ? `{{${t.token}}}` : t.content.slice(0, 20);
  }
  if (el.type === "photo") return "Photo placeholder";
  if (el.type === "qr") return "QR Code";
  if (el.type === "shape") return `Shape (${(el as import("./types").ShapeElement).shape})`;
  if (el.type === "image") return "Image";
  return el.type;
}
