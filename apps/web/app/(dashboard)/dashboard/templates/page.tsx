"use client";

import Link from "next/link";
import { Plus, Pencil, Copy, Trash2, CreditCard } from "lucide-react";

/**
 * /dashboard/templates
 *
 * Lists all ID card templates. Each card links to the template editor.
 */

const MOCK_TEMPLATES = [
  { id: "tpl_001", name: "School ID Card (CR-80)", updatedAt: "2026-04-10", cardWidth: 85.6, cardHeight: 54 },
  { id: "tpl_002", name: "Staff Badge", updatedAt: "2026-04-08", cardWidth: 85.6, cardHeight: 54 },
  { id: "tpl_003", name: "A6 Student Card", updatedAt: "2026-03-30", cardWidth: 148, cardHeight: 105 }
];

export default function TemplatesPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">ID Card Templates</h1>
          <p className="text-sm text-gray-400 mt-1">
            Design and manage your ID card layouts
          </p>
        </div>
        <Link
          href="/dashboard/templates/editor"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
        >
          <Plus size={15} />
          New Template
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_TEMPLATES.map((tpl) => (
          <TemplateCard key={tpl.id} template={tpl} />
        ))}

        {/* New template card */}
        <Link
          href="/dashboard/templates/editor"
          className="border-2 border-dashed border-gray-700 hover:border-blue-600 rounded-xl flex flex-col items-center justify-center gap-2 p-8 text-gray-500 hover:text-blue-400 transition cursor-pointer aspect-video"
        >
          <Plus size={24} />
          <span className="text-sm font-medium">New Template</span>
        </Link>
      </div>
    </div>
  );
}

function TemplateCard({
  template
}: {
  template: (typeof MOCK_TEMPLATES)[number];
}) {
  // Preview aspect ratio based on card size
  const aspect = template.cardHeight / template.cardWidth;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition group">
      {/* Card preview thumbnail */}
      <div
        className="bg-gradient-to-br from-[#0F3C78] to-[#1C6ED5] w-full flex items-center justify-center"
        style={{ aspectRatio: `${template.cardWidth} / ${template.cardHeight}` }}
      >
        <CreditCard size={32} className="text-white/30" />
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-200 truncate">{template.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {template.cardWidth} × {template.cardHeight} mm · Updated{" "}
          {new Date(template.updatedAt).toLocaleDateString("en-IN")}
        </p>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Link
            href={`/dashboard/templates/editor?id=${template.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
          >
            <Pencil size={11} />
            Edit
          </Link>
          <button
            title="Duplicate"
            className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition"
          >
            <Copy size={12} />
          </button>
          <button
            title="Delete"
            className="p-1.5 rounded bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-400 transition"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
