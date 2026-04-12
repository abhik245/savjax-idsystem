"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import TemplateEditor from "@/components/template-editor/TemplateEditor";
import TemplateGallery from "@/components/template-editor/TemplateGallery";
import { defaultTemplate } from "@/components/template-editor/utils";
import { getBuiltinById } from "@/components/template-editor/builtinTemplates";
import { CardTemplate } from "@/components/template-editor/types";

/**
 * /dashboard/templates/editor?id=<templateId>      — edit existing template
 * /dashboard/templates/editor?builtin=<builtinId>  — start from built-in
 * /dashboard/templates/editor                       — shows gallery picker first
 */

function EditorInner() {
  const params     = useSearchParams();
  const templateId = params?.get("id")      ?? null;
  const builtinId  = params?.get("builtin") ?? null;

  const [pickedTemplate, setPickedTemplate] = useState<CardTemplate | null>(() => {
    // load from built-in id
    if (builtinId) return getBuiltinById(builtinId) ?? null;
    // load from API template id
    if (templateId) {
      const t  = defaultTemplate();
      t.id     = templateId;
      t.name   = `Template ${templateId.slice(0, 8)}`;
      return t;
    }
    // no params → show gallery first
    return null;
  });

  const handleSave = async (template: CardTemplate) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const method  = templateId ? "PUT" : "POST";
    const url     = templateId
      ? `${apiBase}/api/v2/admin/templates/${templateId}`
      : `${apiBase}/api/v2/admin/templates`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(template),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  };

  // ── Gallery step (no template selected yet) ────────────────────────────────
  if (!pickedTemplate) {
    return (
      <div className="h-screen overflow-hidden bg-gray-950">
        <TemplateGallery onSelect={(tpl) => setPickedTemplate(tpl)} />
      </div>
    );
  }

  // ── Editor ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen overflow-hidden">
      <TemplateEditor initialTemplate={pickedTemplate} onSave={handleSave} />
    </div>
  );
}

export default function TemplateEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center text-gray-400 bg-gray-950">
        Loading…
      </div>
    }>
      <EditorInner />
    </Suspense>
  );
}
