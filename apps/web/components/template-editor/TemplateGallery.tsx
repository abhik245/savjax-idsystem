"use client";

/**
 * TemplateGallery — pick a starting design from the built-in library.
 *
 * Shows thumbnail previews (live CardCanvas renders at low zoom) with
 * filter tabs:  All · Horizontal · Vertical · Corporate · School
 *
 * Props:
 *   onSelect(template)  — called when a template is chosen
 *   onClose()           — called when the user dismisses the panel
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, LayoutTemplate } from "lucide-react";
import { CardTemplate } from "./types";
import { BUILTIN_TEMPLATES } from "./builtinTemplates";
import CardCanvas from "./CardCanvas";

// ── Zoom so card fits in the thumbnail container ──────────────────────────────
// CR-80 horizontal 85.6 mm → at DPI 96, 1 mm ≈ 3.78 px
// At zoom 0.55: 85.6 * 3.78 * 0.55 ≈ 178 px wide   (target ≤ 190)
const THUMB_ZOOM = 0.55;

type Filter = "all" | "horizontal" | "vertical" | "School" | "Corporate";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "horizontal", label: "Horizontal" },
  { key: "vertical",   label: "Vertical" },
  { key: "School",     label: "School" },
  { key: "Corporate",  label: "Corporate" },
];

type Props = {
  onSelect: (template: CardTemplate) => void;
  onClose?: () => void;
};

export default function TemplateGallery({ onSelect, onClose }: Props) {
  const [filter, setFilter]   = useState<Filter>("all");
  const [search, setSearch]   = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const visible = useMemo(() => {
    let list = BUILTIN_TEMPLATES;
    if (filter === "horizontal") list = list.filter((t) => t.orientation === "horizontal");
    if (filter === "vertical")   list = list.filter((t) => t.orientation === "vertical");
    if (filter === "School")     list = list.filter((t) => t.category === "School");
    if (filter === "Corporate")  list = list.filter((t) => t.category === "Corporate");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [filter, search]);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <LayoutTemplate size={20} className="text-blue-400" />
          <div>
            <h2 className="text-lg font-bold text-gray-100">Choose a Template</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {BUILTIN_TEMPLATES.length} designs · pick one to start editing
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="px-6 pt-4 pb-2 shrink-0 space-y-3">

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg
                       text-sm text-gray-200 placeholder-gray-600
                       focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filter === key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <AnimatePresence mode="wait">
          {visible.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-48 text-gray-600 gap-2"
            >
              <LayoutTemplate size={32} />
              <p className="text-sm">No templates match</p>
            </motion.div>
          ) : (
            <motion.div
              key={filter + search}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="grid gap-5 pt-2"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
            >
              {visible.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  hovered={hovered === tpl.id}
                  onHover={setHovered}
                  onSelect={onSelect}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Thumbnail card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  hovered,
  onHover,
  onSelect,
}: {
  template: CardTemplate;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (t: CardTemplate) => void;
}) {
  const cardWpx = (template.cardWidth  / 25.4) * 96 * THUMB_ZOOM;
  const cardHpx = (template.cardHeight / 25.4) * 96 * THUMB_ZOOM;

  return (
    <motion.div
      className="flex flex-col bg-gray-900 border rounded-xl overflow-hidden cursor-pointer group transition-all"
      style={{ borderColor: hovered ? "#3b82f6" : "#1f2937" }}
      onMouseEnter={() => onHover(template.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(template)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Thumbnail */}
      <div
        className="flex items-center justify-center bg-gray-800 overflow-hidden"
        style={{ minHeight: Math.min(cardHpx + 24, 200) }}
      >
        <div
          className="pointer-events-none rounded-sm shadow-xl overflow-hidden"
          style={{ width: cardWpx, height: cardHpx }}
        >
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
          {template.backSide && (
            <span className="ml-auto text-[10px] text-green-500">Front+Back</span>
          )}
        </div>
      </div>

      {/* Hover overlay button */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] rounded-xl"
          >
            <span className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-lg">
              Use This Template
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
