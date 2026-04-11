"use client";

/**
 * PropertiesPanel — right-side panel that shows editable properties
 * for the currently selected element.
 */

import {
  AnyElement,
  TextElement,
  PhotoElement,
  ShapeElement,
  QrElement,
  ImageElement,
  CardTemplate,
  FontWeight,
  TextAlign,
  TokenKey
} from "./types";

// ── Token catalogue ─────────────────────────────────────────────────────────

const TOKEN_OPTIONS: { key: TokenKey; label: string }[] = [
  { key: "student_name", label: "Student Name" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "student_id", label: "Student ID" },
  { key: "admission_number", label: "Admission No." },
  { key: "employee_id", label: "Employee ID" },
  { key: "class", label: "Class" },
  { key: "section", label: "Section" },
  { key: "department", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "roll_number", label: "Roll Number" },
  { key: "blood_group", label: "Blood Group" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "parent_name", label: "Parent Name" },
  { key: "parent_mobile", label: "Parent Mobile" },
  { key: "school_name", label: "School Name" },
  { key: "school_code", label: "School Code" },
  { key: "issue_date", label: "Issue Date" },
  { key: "validity_date", label: "Validity Date" },
  { key: "address", label: "Address" },
  { key: "custom_field_1", label: "Custom Field 1" },
  { key: "custom_field_2", label: "Custom Field 2" }
];

// ── Shared UI primitives ─────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <label className="text-xs text-gray-400 w-20 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 0.5
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
      value={value.toFixed(1)}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}

function ColorInput({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 items-center">
      <input
        type="color"
        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={9}
      />
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`relative w-8 h-4 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-gray-600"
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      <span className="text-xs text-gray-300">{label}</span>
    </label>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

type Props = {
  template: CardTemplate;
  selectedId: string | null;
  onUpdate: (element: AnyElement) => void;
  onUpdateBackground: (bg: Partial<CardTemplate["background"]>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onZIndex: (id: string, direction: "up" | "down") => void;
};

export default function PropertiesPanel({
  template,
  selectedId,
  onUpdate,
  onUpdateBackground,
  onDelete,
  onDuplicate,
  onZIndex
}: Props) {
  const element = selectedId
    ? template.elements.find((e) => e.id === selectedId) ?? null
    : null;

  const upd = (partial: Partial<AnyElement>) => {
    if (!element) return;
    onUpdate({ ...element, ...partial } as AnyElement);
  };

  return (
    <aside className="w-64 shrink-0 bg-gray-900 border-l border-gray-800 overflow-y-auto flex flex-col">
      {!element ? (
        <BackgroundPanel template={template} onUpdateBackground={onUpdateBackground} />
      ) : (
        <ElementPanel
          element={element}
          upd={upd}
          onDelete={() => onDelete(element.id)}
          onDuplicate={() => onDuplicate(element.id)}
          onZIndex={(dir) => onZIndex(element.id, dir)}
        />
      )}
    </aside>
  );
}

// ── Background panel ──────────────────────────────────────────────────────────

function BackgroundPanel({
  template,
  onUpdateBackground
}: {
  template: CardTemplate;
  onUpdateBackground: (bg: Partial<CardTemplate["background"]>) => void;
}) {
  const bg = template.background;
  return (
    <div className="p-3 space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Card Background</h3>
      <Row label="BG Color">
        <ColorInput value={bg.color} onChange={(v) => onUpdateBackground({ color: v })} />
      </Row>
      <div className="text-xs text-gray-500 pt-1">
        Card: {template.cardWidth.toFixed(1)} × {template.cardHeight.toFixed(1)} mm
      </div>
    </div>
  );
}

// ── Element panel ─────────────────────────────────────────────────────────────

function ElementPanel({
  element,
  upd,
  onDelete,
  onDuplicate,
  onZIndex
}: {
  element: AnyElement;
  upd: (p: Partial<AnyElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onZIndex: (dir: "up" | "down") => void;
}) {
  return (
    <div className="p-3 space-y-4 text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {element.type}
        </span>
        <div className="flex gap-1">
          <button
            title="Duplicate"
            onClick={onDuplicate}
            className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            ⎘
          </button>
          <button
            title="Delete"
            onClick={onDelete}
            className="text-xs px-2 py-0.5 rounded bg-red-900 hover:bg-red-800 text-red-300"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Position & size */}
      <section>
        <p className="text-[10px] text-gray-500 uppercase mb-1 tracking-wider">Position & Size</p>
        <div className="grid grid-cols-2 gap-1">
          <Row label="X (mm)">
            <NumberInput value={element.x} onChange={(v) => upd({ x: v })} min={0} />
          </Row>
          <Row label="Y (mm)">
            <NumberInput value={element.y} onChange={(v) => upd({ y: v })} min={0} />
          </Row>
          <Row label="W (mm)">
            <NumberInput value={element.w} onChange={(v) => upd({ w: Math.max(1, v) })} min={1} />
          </Row>
          <Row label="H (mm)">
            <NumberInput value={element.h} onChange={(v) => upd({ h: Math.max(1, v) })} min={1} />
          </Row>
          <Row label="Rotate°">
            <NumberInput value={element.rotation} onChange={(v) => upd({ rotation: v })} min={-180} max={180} step={1} />
          </Row>
        </div>
      </section>

      {/* Layer order */}
      <section>
        <p className="text-[10px] text-gray-500 uppercase mb-1 tracking-wider">Layer</p>
        <div className="flex gap-1">
          <button
            onClick={() => onZIndex("up")}
            className="flex-1 text-xs py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            ↑ Forward
          </button>
          <button
            onClick={() => onZIndex("down")}
            className="flex-1 text-xs py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            ↓ Back
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Toggle
            checked={element.locked}
            onChange={(v) => upd({ locked: v })}
            label="Lock"
          />
          <Toggle
            checked={element.visible}
            onChange={(v) => upd({ visible: v })}
            label="Visible"
          />
        </div>
      </section>

      {/* Type-specific */}
      {element.type === "text" && <TextProps el={element as TextElement} upd={upd as any} />}
      {element.type === "photo" && <PhotoProps el={element as PhotoElement} upd={upd as any} />}
      {element.type === "shape" && <ShapeProps el={element as ShapeElement} upd={upd as any} />}
      {element.type === "qr" && <QrProps el={element as QrElement} upd={upd as any} />}
      {element.type === "image" && <ImageProps el={element as ImageElement} upd={upd as any} />}
    </div>
  );
}

// ── Type-specific sub-panels ──────────────────────────────────────────────────

function TextProps({ el, upd }: { el: TextElement; upd: (p: Partial<TextElement>) => void }) {
  return (
    <section className="space-y-1">
      <p className="text-[10px] text-gray-500 uppercase mb-1 tracking-wider">Text</p>

      {/* Token or static */}
      <Row label="Token">
        <SelectInput
          value={el.token ?? "__static__"}
          onChange={(v) => {
            if (v === "__static__") {
              upd({ token: undefined, content: el.content });
            } else {
              upd({ token: v as TokenKey, content: `{{${v}}}` });
            }
          }}
          options={[
            { value: "__static__", label: "Static text" },
            ...TOKEN_OPTIONS.map((t) => ({ value: t.key, label: t.label }))
          ]}
        />
      </Row>

      {!el.token && (
        <Row label="Content">
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 resize-y"
            rows={2}
            value={el.content}
            onChange={(e) => upd({ content: e.target.value })}
          />
        </Row>
      )}

      <Row label="Font size">
        <NumberInput value={el.fontSize} onChange={(v) => upd({ fontSize: v })} min={4} max={72} step={0.5} />
      </Row>
      <Row label="Color">
        <ColorInput value={el.color} onChange={(v) => upd({ color: v })} />
      </Row>
      <Row label="Weight">
        <SelectInput
          value={el.fontWeight}
          onChange={(v) => upd({ fontWeight: v as FontWeight })}
          options={[
            { value: "normal", label: "Normal" },
            { value: "600", label: "Semi-Bold" },
            { value: "bold", label: "Bold" }
          ]}
        />
      </Row>
      <Row label="Align">
        <SelectInput
          value={el.align}
          onChange={(v) => upd({ align: v as TextAlign })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" }
          ]}
        />
      </Row>
      <Row label="Transform">
        <SelectInput
          value={el.textTransform}
          onChange={(v) => upd({ textTransform: v as TextElement["textTransform"] })}
          options={[
            { value: "none", label: "None" },
            { value: "uppercase", label: "UPPERCASE" },
            { value: "capitalize", label: "Capitalize" },
            { value: "lowercase", label: "lowercase" }
          ]}
        />
      </Row>
      <Toggle checked={el.italic} onChange={(v) => upd({ italic: v })} label="Italic" />
    </section>
  );
}

function PhotoProps({ el, upd }: { el: PhotoElement; upd: (p: Partial<PhotoElement>) => void }) {
  return (
    <section className="space-y-1">
      <p className="text-[10px] text-gray-500 uppercase mb-1 tracking-wider">Photo</p>
      <Toggle checked={el.circle} onChange={(v) => upd({ circle: v })} label="Circle crop" />
      <Row label="Border">
        <ColorInput value={el.borderColor} onChange={(v) => upd({ borderColor: v })} />
      </Row>
      <Row label="Border px">
        <NumberInput value={el.borderWidth} onChange={(v) => upd({ borderWidth: v })} min={0} max={10} step={0.5} />
      </Row>
      <Row label="Radius %">
        <NumberInput value={el.borderRadius} onChange={(v) => upd({ borderRadius: v })} min={0} max={50} step={1} />
      </Row>
    </section>
  );
}

function ShapeProps({ el, upd }: { el: ShapeElement; upd: (p: Partial<ShapeElement>) => void }) {
  return (
    <section className="space-y-1">
      <p className="text-[10px] text-gray-500 uppercase mb-1 tracking-wider">Shape</p>
      <Row label="Type">
        <SelectInput
          value={el.shape}
          onChange={(v) => upd({ shape: v as ShapeElement["shape"] })}
          options={[
            { value: "rect", label: "Rectangle" },
            { value: "circle", label: "Circle" },
            { value: "line", label: "Line" }
          ]}
        />
      </Row>
      <Row label="Fill">
        <ColorInput value={el.fill} onChange={(v) => upd({ fill: v })} />
      </Row>
      <Row label="Stroke">
        <ColorInput value={el.stroke} onChange={(v) => upd({ stroke: v })} />
      </Row>
      <Row label="Stroke px">
        <NumberInput value={el.strokeWidth} onChange={(v) => upd({ strokeWidth: v })} min={0} max={10} step={0.5} />
      </Row>
      <Row label="Radius %">
        <NumberInput value={el.radius} onChange={(v) => upd({ radius: v })} min={0} max={50} step={1} />
      </Row>
    </section>
  );
}

function QrProps({ el, upd }: { el: QrElement; upd: (p: Partial<QrElement>) => void }) {
  return (
    <section className="space-y-1">
      <p className="text-[10px] text-gray-500 uppercase mb-1 tracking-wider">QR Code</p>
      <Row label="Data">
        <SelectInput
          value={el.data.replace(/^\{\{|\}\}$/g, "")}
          onChange={(v) => upd({ data: `{{${v}}}` })}
          options={TOKEN_OPTIONS.map((t) => ({ value: t.key, label: t.label }))}
        />
      </Row>
      <Row label="FG Color">
        <ColorInput value={el.fgColor} onChange={(v) => upd({ fgColor: v })} />
      </Row>
      <Row label="BG Color">
        <ColorInput value={el.bgColor} onChange={(v) => upd({ bgColor: v })} />
      </Row>
    </section>
  );
}

function ImageProps({ el, upd }: { el: ImageElement; upd: (p: Partial<ImageElement>) => void }) {
  return (
    <section className="space-y-1">
      <p className="text-[10px] text-gray-500 uppercase mb-1 tracking-wider">Image</p>
      <Row label="Fit">
        <SelectInput
          value={el.objectFit}
          onChange={(v) => upd({ objectFit: v as "cover" | "contain" })}
          options={[
            { value: "cover", label: "Cover" },
            { value: "contain", label: "Contain" }
          ]}
        />
      </Row>
      <Row label="Radius %">
        <NumberInput value={el.borderRadius} onChange={(v) => upd({ borderRadius: v })} min={0} max={50} step={1} />
      </Row>
      <Row label="Opacity">
        <NumberInput value={el.opacity} onChange={(v) => upd({ opacity: Math.min(1, Math.max(0, v)) })} min={0} max={1} step={0.05} />
      </Row>
    </section>
  );
}
