/**
 * Built-in ID card templates.
 *
 * Inspired by the Bharti Card / iDJet design library (H = horizontal,
 * V = vertical).  All coordinates are in mm on the card canvas.
 * CR-80 horizontal = 85.6 × 54 mm
 * CR-80 vertical   = 54  × 85.6 mm
 */

import { CardTemplate, AnyElement, Background } from "./types";

const NOW = "2026-04-12T00:00:00.000Z";

// ── helpers ──────────────────────────────────────────────────────────────────

let _seq = 1;
const id = () => `bi-${(_seq++).toString().padStart(3, "0")}`;

function rect(
  x: number, y: number, w: number, h: number,
  fill: string, zIndex = 0, extra: Partial<AnyElement> = {}
): AnyElement {
  return {
    id: id(), type: "shape", shape: "rect",
    x, y, w, h, rotation: 0, locked: true, visible: true,
    fill, stroke: "transparent", strokeWidth: 0, radius: 0,
    zIndex, ...extra
  } as AnyElement;
}

function txt(
  x: number, y: number, w: number, h: number,
  content: string, color: string, fontSize: number,
  zIndex = 3,
  extra: Partial<AnyElement> = {}
): AnyElement {
  return {
    id: id(), type: "text",
    x, y, w, h, rotation: 0, locked: false, visible: true,
    content, color, fontSize,
    fontFamily: "Arial, sans-serif", fontWeight: "normal",
    italic: false, align: "left", lineHeight: 1.25,
    letterSpacing: 0, textTransform: "none",
    zIndex, ...extra
  } as AnyElement;
}

function photo(
  x: number, y: number, w: number, h: number,
  borderColor: string, zIndex = 2,
  extra: Partial<AnyElement> = {}
): AnyElement {
  return {
    id: id(), type: "photo",
    x, y, w, h, rotation: 0, locked: false, visible: true,
    circle: false, borderColor, borderWidth: 0.8,
    placeholder: "face", objectFit: "cover", borderRadius: 5,
    zIndex, ...extra
  } as AnyElement;
}

function qr(
  x: number, y: number, w: number, h: number,
  fgColor: string, bgColor = "#ffffff", zIndex = 3
): AnyElement {
  return {
    id: id(), type: "qr",
    x, y, w, h, rotation: 0, locked: false, visible: true,
    data: "{{student_id}}", fgColor, bgColor, errorLevel: "M",
    zIndex
  } as AnyElement;
}

function mk(
  templateId: string,
  name: string,
  category: string,
  orientation: "horizontal" | "vertical",
  cardWidth: number,
  cardHeight: number,
  background: Background,
  elements: AnyElement[],
  backSide?: CardTemplate["backSide"]
): CardTemplate {
  return {
    id: templateId, name, version: 1,
    cardWidth, cardHeight, background, elements,
    orientation, category,
    ...(backSide ? { backSide } : {}),
    createdAt: NOW, updatedAt: NOW
  };
}

// ── Template 1 — Blue Corporate (H) ─────────────────────────────────────────

const blueH = mk(
  "builtin-blue-h", "Blue Corporate", "School", "horizontal", 85.6, 54,
  { color: "#f0f4ff" },
  [
    rect(0, 0, 85.6, 12, "#1e40af", 0),
    txt(3, 2.5, 79, 7, "{{school_name}}", "#ffffff", 7.5, 1,
      { fontWeight: "bold", align: "center", textTransform: "uppercase", token: "school_name" } as Partial<AnyElement>),
    rect(0, 12, 28, 42, "#dbeafe", 0),
    rect(28, 12, 0.6, 42, "#93c5fd", 1),
    photo(3.5, 14, 21, 26, "#1e40af", 2),
    txt(30, 14, 54, 8, "{{student_name}}", "#0f172a", 9, 3,
      { fontWeight: "bold", token: "student_name" } as Partial<AnyElement>),
    txt(30, 23, 54, 5, "Class: {{class}}  ·  {{section}}", "#475569", 6.5, 3),
    txt(30, 29, 54, 5, "Roll No: {{roll_number}}", "#374151", 6.5, 3),
    txt(30, 35, 54, 5, "DOB: {{date_of_birth}}", "#374151", 6, 3),
    txt(30, 41, 30, 4.5, "Blood: {{blood_group}}", "#dc2626", 6, 3,
      { fontWeight: "bold" } as Partial<AnyElement>),
    qr(67, 35, 14, 14, "#1e40af", "#f0f4ff", 3),
    rect(0, 49, 85.6, 5, "#1e40af", 4),
    txt(2, 50.3, 80, 3.8, "STUDENT IDENTITY CARD", "#ffffff", 5, 5,
      { fontWeight: "bold", align: "center", textTransform: "uppercase", letterSpacing: 1.5 } as Partial<AnyElement>),
  ]
);

// ── Template 2 — Dark Minimal (H) ───────────────────────────────────────────

const darkH = mk(
  "builtin-dark-h", "Dark Minimal", "Corporate", "horizontal", 85.6, 54,
  { color: "#0f172a" },
  [
    rect(0, 0, 3.5, 54, "#8b5cf6", 0),
    rect(3.5, 0, 82.1, 0.5, "#1e293b", 1),
    // logo area
    { id: id(), type: "photo", x: 6, y: 4, w: 16, h: 8, rotation: 0, locked: false, visible: true,
      circle: false, borderColor: "#334155", borderWidth: 0.5,
      placeholder: "logo", objectFit: "contain", borderRadius: 3, zIndex: 1 } as AnyElement,
    // right photo
    photo(60, 12, 22, 28, "#8b5cf6", 2, { circle: true, borderWidth: 1.5 } as Partial<AnyElement>),
    rect(3.5, 13.5, 82.1, 0.4, "#1e293b", 1),
    txt(6, 15, 50, 8, "{{student_name}}", "#f8fafc", 9.5, 3,
      { fontWeight: "bold", token: "student_name" } as Partial<AnyElement>),
    txt(6, 24, 50, 5.5, "{{class}}  ·  {{section}}", "#94a3b8", 6.5, 3),
    txt(6, 30, 50, 5, "ID: {{student_id}}", "#64748b", 6, 3),
    txt(6, 36, 30, 5, "Blood: {{blood_group}}", "#f87171", 6, 3,
      { fontWeight: "bold" } as Partial<AnyElement>),
    qr(63, 42, 14, 11, "#8b5cf6", "#1e293b", 3),
    rect(0, 49, 85.6, 5, "#1e293b", 4),
    txt(6, 50.3, 65, 3.8, "{{school_name}}", "#94a3b8", 5.5, 5,
      { textTransform: "uppercase", token: "school_name" } as Partial<AnyElement>),
  ]
);

// ── Template 3 — Green School (H) ───────────────────────────────────────────

const greenH = mk(
  "builtin-green-h", "Green School", "School", "horizontal", 85.6, 54,
  { color: "#f0fdf4" },
  [
    rect(0, 0, 85.6, 11, "#15803d", 0),
    txt(2, 2.2, 81, 6.8, "{{school_name}}", "#ffffff", 7.5, 1,
      { fontWeight: "bold", align: "center", textTransform: "uppercase", token: "school_name" } as Partial<AnyElement>),
    rect(0, 11, 27, 43, "#dcfce7", 0),
    rect(27, 11, 0.7, 43, "#16a34a", 1),
    photo(3, 13, 21, 27, "#16a34a", 2),
    txt(29, 13, 55, 8, "{{student_name}}", "#14532d", 9, 3,
      { fontWeight: "bold", token: "student_name" } as Partial<AnyElement>),
    txt(29, 22, 55, 5, "Class: {{class}}  -  {{section}}", "#374151", 6.5, 3),
    txt(29, 28, 55, 5, "Roll No: {{roll_number}}", "#374151", 6.5, 3),
    txt(29, 34, 55, 5, "DOB: {{date_of_birth}}", "#374151", 6, 3),
    txt(29, 40, 30, 5, "Blood: {{blood_group}}", "#dc2626", 6, 3,
      { fontWeight: "bold" } as Partial<AnyElement>),
    qr(67, 35, 14, 14, "#15803d", "#f0fdf4", 3),
    rect(0, 49, 85.6, 5, "#15803d", 4),
    txt(2, 50.3, 81, 3.8, "STUDENT IDENTITY CARD", "#ffffff", 5, 5,
      { fontWeight: "bold", align: "center", textTransform: "uppercase" } as Partial<AnyElement>),
  ]
);

// ── Template 4 — Red Bold (H) ────────────────────────────────────────────────

const redH = mk(
  "builtin-red-h", "Red Bold", "Corporate", "horizontal", 85.6, 54,
  { color: "#7f1d1d", gradient: { from: "#7f1d1d", to: "#1e1b4b", angle: 135 } },
  [
    rect(0, 0, 85.6, 2.2, "#ef4444", 0),
    txt(4, 4.5, 60, 7, "{{school_name}}", "#fecaca", 8, 1,
      { fontWeight: "bold", token: "school_name" } as Partial<AnyElement>),
    txt(4, 12.5, 40, 5, "{{school_code}}", "#fca5a5", 6, 1,
      { token: "school_code" } as Partial<AnyElement>),
    rect(0, 19, 85.6, 0.5, "#ef4444", 1),
    photo(4, 22, 21, 26, "#ef4444", 2, { circle: true, borderWidth: 1.5, borderRadius: 50 } as Partial<AnyElement>),
    txt(28, 22, 55, 8, "{{student_name}}", "#f8fafc", 9.5, 3,
      { fontWeight: "bold", token: "student_name" } as Partial<AnyElement>),
    txt(28, 31, 55, 5.5, "{{class}}  |  {{section}}", "#fca5a5", 6.5, 3),
    txt(28, 37, 55, 5, "Roll: {{roll_number}}", "#fca5a5", 6, 3),
    txt(28, 43, 30, 5, "Blood: {{blood_group}}", "#fecaca", 6, 3,
      { fontWeight: "bold" } as Partial<AnyElement>),
    qr(67, 22, 14, 14, "#ef4444", "#2d1b1b", 3),
    rect(0, 51, 85.6, 3, "#ef4444", 4),
  ]
);

// ── Template 5 — Blue Wave (V) ───────────────────────────────────────────────

const blueV = mk(
  "builtin-blue-v", "Blue Wave", "School", "vertical", 54, 85.6,
  { color: "#eff6ff" },
  [
    rect(0, 0, 54, 28, "#1d4ed8", 0),
    txt(2, 3, 50, 7, "{{school_name}}", "#ffffff", 7.5, 1,
      { fontWeight: "bold", align: "center", textTransform: "uppercase", token: "school_name" } as Partial<AnyElement>),
    txt(2, 10.5, 50, 5, "{{school_code}}", "#bfdbfe", 5.5, 1,
      { align: "center", token: "school_code" } as Partial<AnyElement>),
    photo(15, 15, 24, 30, "#93c5fd", 2, { borderRadius: 6, borderWidth: 1 } as Partial<AnyElement>),
    rect(2, 46, 50, 0.6, "#93c5fd", 1),
    txt(2, 48, 50, 8, "{{student_name}}", "#1e3a5f", 9, 3,
      { fontWeight: "bold", align: "center", token: "student_name" } as Partial<AnyElement>),
    txt(2, 57, 50, 5.5, "Class: {{class}}  ·  {{section}}", "#475569", 6.5, 3,
      { align: "center" } as Partial<AnyElement>),
    txt(2, 63, 50, 5, "Roll No: {{roll_number}}", "#374151", 6.5, 3,
      { align: "center" } as Partial<AnyElement>),
    txt(2, 69, 50, 5, "Blood: {{blood_group}}", "#dc2626", 6, 3,
      { fontWeight: "bold", align: "center" } as Partial<AnyElement>),
    qr(18, 75, 18, 8, "#1d4ed8", "#eff6ff", 3),
    rect(0, 82.6, 54, 3, "#1d4ed8", 4),
  ]
);

// ── Template 6 — Dark Pro (V) ────────────────────────────────────────────────

const darkV = mk(
  "builtin-dark-v", "Dark Pro", "Corporate", "vertical", 54, 85.6,
  { color: "#0f172a" },
  [
    rect(0, 0, 54, 32, "#1e293b", 0),
    rect(0, 32, 54, 1.5, "#7c3aed", 1),
    txt(2, 4, 50, 6.5, "{{school_name}}", "#e2e8f0", 7, 1,
      { fontWeight: "bold", align: "center", textTransform: "uppercase", token: "school_name" } as Partial<AnyElement>),
    photo(15, 11, 24, 30, "#7c3aed", 2, { circle: true, borderWidth: 2 } as Partial<AnyElement>),
    txt(2, 36, 50, 8.5, "{{student_name}}", "#f8fafc", 9.5, 3,
      { fontWeight: "bold", align: "center", token: "student_name" } as Partial<AnyElement>),
    txt(2, 46, 50, 5.5, "{{class}}  ·  {{section}}", "#a78bfa", 6.5, 3,
      { align: "center" } as Partial<AnyElement>),
    txt(2, 52.5, 50, 5, "ID: {{student_id}}", "#64748b", 6, 3,
      { align: "center" } as Partial<AnyElement>),
    txt(2, 58.5, 50, 5, "Blood: {{blood_group}}", "#f87171", 6, 3,
      { fontWeight: "bold", align: "center" } as Partial<AnyElement>),
    qr(18, 65, 18, 14, "#7c3aed", "#1e293b", 3),
    rect(0, 84, 54, 1.6, "#7c3aed", 4),
  ]
);

// ── Template 7 — Purple Modern (V) ──────────────────────────────────────────

const purpleV = mk(
  "builtin-purple-v", "Purple Modern", "School", "vertical", 54, 85.6,
  { color: "#4c1d95", gradient: { from: "#4c1d95", to: "#1e1b4b", angle: 170 } },
  [
    txt(2, 4, 50, 7, "{{school_name}}", "#e9d5ff", 7.5, 1,
      { fontWeight: "bold", align: "center", textTransform: "uppercase", token: "school_name" } as Partial<AnyElement>),
    photo(14, 12, 26, 33, "#c4b5fd", 2, { circle: false, borderWidth: 2, borderRadius: 8 } as Partial<AnyElement>),
    rect(5, 46, 44, 0.8, "#a78bfa", 1),
    txt(2, 49, 50, 8, "{{student_name}}", "#ffffff", 9.5, 3,
      { fontWeight: "bold", align: "center", token: "student_name" } as Partial<AnyElement>),
    txt(2, 58, 50, 5.5, "{{class}}  ·  {{section}}", "#d8b4fe", 6.5, 3,
      { align: "center" } as Partial<AnyElement>),
    txt(2, 64, 50, 5, "Roll: {{roll_number}}", "#c4b5fd", 6, 3,
      { align: "center" } as Partial<AnyElement>),
    txt(2, 70, 50, 5, "Blood: {{blood_group}}", "#fca5a5", 6, 3,
      { fontWeight: "bold", align: "center" } as Partial<AnyElement>),
    qr(18, 76, 18, 8, "#a78bfa", "#2d1b69", 3),
    rect(0, 83, 54, 2.6, "#7c3aed", 4),
  ]
);

// ── Template 8 — Employee ID (H) ─────────────────────────────────────────────

const employeeH = mk(
  "builtin-employee-h", "Employee ID", "Corporate", "horizontal", 85.6, 54,
  { color: "#f8fafc" },
  [
    rect(0, 0, 26, 54, "#0f172a", 0),
    // company logo in left column
    { id: id(), type: "photo", x: 4, y: 3, w: 18, h: 10, rotation: 0, locked: false, visible: true,
      circle: false, borderColor: "#334155", borderWidth: 0.5,
      placeholder: "logo", objectFit: "contain", borderRadius: 3, zIndex: 1 } as AnyElement,
    photo(3, 15, 20, 26, "#475569", 2, { borderRadius: 4, borderWidth: 0.5 } as Partial<AnyElement>),
    txt(4, 43, 18, 3.5, "EMPLOYEE ID", "#64748b", 4.5, 2,
      { align: "center", textTransform: "uppercase" } as Partial<AnyElement>),
    txt(3, 47, 20, 5, "{{employee_id}}", "#ffffff", 6, 2,
      { fontWeight: "bold", align: "center", token: "employee_id" } as Partial<AnyElement>),
    rect(26, 0, 59.6, 12, "#1e293b", 0),
    txt(28, 2.5, 55, 7, "{{school_name}}", "#f8fafc", 8, 1,
      { fontWeight: "bold", token: "school_name" } as Partial<AnyElement>),
    txt(28, 14, 55, 8.5, "{{student_name}}", "#0f172a", 10, 3,
      { fontWeight: "bold", token: "student_name" } as Partial<AnyElement>),
    txt(28, 23, 55, 5.5, "{{designation}}", "#475569", 7, 3,
      { token: "designation" } as Partial<AnyElement>),
    txt(28, 29, 55, 5, "{{department}}", "#64748b", 6, 3,
      { token: "department" } as Partial<AnyElement>),
    rect(28, 35, 55, 0.5, "#e2e8f0", 1),
    txt(28, 37, 42, 5, "{{parent_mobile}}", "#374151", 6, 3),
    qr(67, 36, 14, 14, "#0f172a", "#f8fafc", 3),
    rect(26, 49, 59.6, 5, "#0f172a", 4),
    txt(28, 50.3, 55, 3.8, "EMPLOYEE IDENTITY CARD", "#94a3b8", 5, 5,
      { textTransform: "uppercase", align: "center" } as Partial<AnyElement>),
  ]
);

// ── Export ────────────────────────────────────────────────────────────────────

export const BUILTIN_TEMPLATES: CardTemplate[] = [
  blueH,
  darkH,
  greenH,
  redH,
  blueV,
  darkV,
  purpleV,
  employeeH,
];

export function getBuiltinById(id: string): CardTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
