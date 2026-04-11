"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import TemplateEditor from "@/components/template-editor/TemplateEditor";
import { defaultTemplate } from "@/components/template-editor/utils";
import { CardTemplate } from "@/components/template-editor/types";

/**
 * /dashboard/templates/editor?id=<templateId>
 *
 * Loads an existing template by ID or starts with the default starter template.
 * In a real integration this page would fetch the template from the API.
 */

function EditorInner() {
  const params = useSearchParams();
  const templateId = params.get("id");

  // TODO: fetch real template by templateId from API when id is provided
  const initialTemplate: CardTemplate = defaultTemplate();
  if (templateId) {
    initialTemplate.id = templateId;
    initialTemplate.name = `Template ${templateId.slice(0, 8)}`;
  }

  const handleSave = async (template: CardTemplate) => {
    // TODO: POST/PUT to /api/v2/admin/templates
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const method = templateId ? "PUT" : "POST";
    const url = templateId
      ? `${apiBase}/api/v2/admin/templates/${templateId}`
      : `${apiBase}/api/v2/admin/templates`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(template)
    });

    if (!res.ok) {
      throw new Error(`Save failed: ${res.status}`);
    }
  };

  return (
    <div className="h-screen overflow-hidden">
      <TemplateEditor initialTemplate={initialTemplate} onSave={handleSave} />
    </div>
  );
}

export default function TemplateEditorPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-gray-400">Loading editor…</div>}>
      <EditorInner />
    </Suspense>
  );
}
