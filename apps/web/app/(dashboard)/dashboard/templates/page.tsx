"use client";

import Link from "next/link";
import { Plus, Pencil, Copy, Trash2, LayoutTemplate } from "lucide-react";
import { BUILTIN_TEMPLATES } from "@/components/template-editor/builtinTemplates";
import CardCanvas from "@/components/template-editor/CardCanvas";
import { CardTemplate } from "@/components/template-editor/types";

/**
 * /dashboard/templates
 * Lists all ID card templates with live previews.
 */

// Gallery thumbnail zoom — same constant as TemplateGallery
const THUMB_ZOOM = 0.5;

export default function TemplatesPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">ID Card Templates</h1>
          <p className="text-sm text-gray-400 mt-1">
            Design and manage your ID card layouts
          </p>
        </div>
        <Link
          href="/dashboard/templates/editor"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-semibold rounded-lg transition"
        >
          <Plus size={15} />
          New Template
        </Link>
      </div>

      {/* Built-in library section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <LayoutTemplate size={15} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-300">Built-in Designs</h2>
          <span className="text-xs text-gray-600 ml-1">
            — click to open in editor
          </span>
        </div>

        <div className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>

          {BUILTIN_TEMPLATES.map((tpl) => (
            <BuiltinCard key={tpl.id} template={tpl} />
          ))}

          {/* Create from scratch */}
          <Link
            href="/dashboard/templates/editor"
            className="border-2 border-dashed border-gray-700 hover:border-blue-600
                       rounded-xl flex flex-col items-center justify-center gap-2
                       p-8 text-gray-500 hover:text-blue-400 transition cursor-pointer
                       min-h-[160px]"
          >
            <Plus size={22} />
            <span className="text-sm font-medium">Blank Canvas</span>
          </Link>
        </div>
      </div>

      {/* My saved templates (placeholder) */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-4">My Saved Templates</h2>
        <p className="text-sm text-gray-600 italic">
          Templates you save from the editor will appear here.
        </p>
      </div>
    </div>
  );
}

// ── Built-in template card ────────────────────────────────────────────────────

function BuiltinCard({ template }: { template: CardTemplate }) {
  const cardWpx = (template.cardWidth  / 25.4) * 96 * THUMB_ZOOM;
  const cardHpx = (template.cardHeight / 25.4) * 96 * THUMB_ZOOM;

  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-600
                    rounded-xl overflow-hidden transition group">

      {/* Live thumbnail */}
      <div className="flex items-center justify-center bg-gray-800 py-3 overflow-hidden"
        style={{ minHeight: Math.min(cardHpx + 24, 180) }}>
        <div className="pointer-events-none rounded-sm shadow-xl overflow-hidden"
          style={{ width: cardWpx, height: cardHpx }}>
          <CardCanvas
            template={template}
            selectedId={null}
            onSelect={() => {}}
            onUpdate={() => {}}
            zoom={THUMB_ZOOM}
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-semibold text-gray-200 truncate">{template.name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            template.orientation === "horizontal"
              ? "bg-blue-900/60 text-blue-300"
              : "bg-purple-900/60 text-purple-300"
          }`}>
            {template.orientation === "horizontal" ? "H" : "V"}
          </span>
          <span className="text-[10px] text-gray-500">
            {template.cardWidth}×{template.cardHeight} mm
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Link
            href={`/dashboard/templates/editor?builtin=${template.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5
                       rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
          >
            <Pencil size={11} />
            Edit
          </Link>
          <button title="Duplicate"
            className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition">
            <Copy size={12} />
          </button>
          <button title="Delete"
            className="p-1.5 rounded bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-400 transition">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
