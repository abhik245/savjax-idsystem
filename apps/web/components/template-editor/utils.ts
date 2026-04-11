import { AnyElement, CardTemplate, TextElement, PhotoElement, ShapeElement, QrElement } from "./types";

/** Generate a short random ID */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Convert mm to pixels at a given DPI */
export function mmToPx(mm: number, dpi = 96): number {
  return (mm / 25.4) * dpi;
}

/** Convert pixels to mm at a given DPI */
export function pxToMm(px: number, dpi = 96): number {
  return (px / dpi) * 25.4;
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Deep clone via JSON (elements must be serialisable) */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** Create a default text element */
export function makeText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: uid(),
    type: "text",
    x: 10,
    y: 10,
    w: 60,
    h: 8,
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 1,
    content: "New Text",
    fontSize: 10,
    fontFamily: "Inter, sans-serif",
    fontWeight: "normal",
    italic: false,
    color: "#1a1a2e",
    align: "left",
    lineHeight: 1.3,
    letterSpacing: 0,
    textTransform: "none",
    ...overrides
  };
}

/** Create a default photo element */
export function makePhoto(overrides: Partial<PhotoElement> = {}): PhotoElement {
  return {
    id: uid(),
    type: "photo",
    x: 5,
    y: 5,
    w: 22,
    h: 28,
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 2,
    circle: false,
    borderColor: "#cccccc",
    borderWidth: 0.5,
    placeholder: "face",
    objectFit: "cover",
    borderRadius: 4,
    ...overrides
  };
}

/** Create a default shape element */
export function makeShape(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: uid(),
    type: "shape",
    x: 0,
    y: 0,
    w: 85.6,
    h: 12,
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 0,
    shape: "rect",
    fill: "#0F3C78",
    stroke: "transparent",
    strokeWidth: 0,
    radius: 0,
    ...overrides
  };
}

/** Create a default QR element */
export function makeQr(overrides: Partial<QrElement> = {}): QrElement {
  return {
    id: uid(),
    type: "qr",
    x: 65,
    y: 30,
    w: 16,
    h: 16,
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: 3,
    data: "{{student_id}}",
    fgColor: "#000000",
    bgColor: "#ffffff",
    errorLevel: "M",
    ...overrides
  };
}

/** A starter school ID card template */
export function defaultTemplate(): CardTemplate {
  return {
    id: uid(),
    name: "School ID Card",
    version: 1,
    cardWidth: 85.6,
    cardHeight: 54,
    background: { color: "#ffffff" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    elements: [
      // Header band
      makeShape({
        id: uid(), x: 0, y: 0, w: 85.6, h: 14, fill: "#0F3C78", zIndex: 0
      }),
      // School name in header
      makeText({
        id: uid(), x: 2, y: 2, w: 80, h: 6, content: "{{school_name}}",
        token: "school_name", fontSize: 11, fontWeight: "bold", color: "#ffffff",
        align: "center", zIndex: 1, textTransform: "uppercase"
      }),
      // School code
      makeText({
        id: uid(), x: 2, y: 8, w: 80, h: 5, content: "{{school_code}}",
        token: "school_code", fontSize: 7, color: "#d0e8ff", align: "center", zIndex: 1
      }),
      // Photo
      makePhoto({
        id: uid(), x: 4, y: 16, w: 22, h: 28, borderWidth: 1,
        borderColor: "#0F3C78", borderRadius: 4, zIndex: 2
      }),
      // Student name
      makeText({
        id: uid(), x: 29, y: 17, w: 54, h: 7, content: "{{student_name}}",
        token: "student_name", fontSize: 10, fontWeight: "bold", color: "#0F3C78",
        align: "left", zIndex: 2
      }),
      // Class
      makeText({
        id: uid(), x: 29, y: 25, w: 54, h: 5, content: "Class: {{class}} - {{section}}",
        fontSize: 7, color: "#333333", align: "left", zIndex: 2
      }),
      // Roll number
      makeText({
        id: uid(), x: 29, y: 31, w: 54, h: 5, content: "Roll No: {{roll_number}}",
        fontSize: 7, color: "#333333", align: "left", zIndex: 2
      }),
      // DOB
      makeText({
        id: uid(), x: 29, y: 37, w: 54, h: 5, content: "DOB: {{date_of_birth}}",
        fontSize: 7, color: "#333333", align: "left", zIndex: 2
      }),
      // Footer band
      makeShape({
        id: uid(), x: 0, y: 46, w: 85.6, h: 8, fill: "#1C6ED5", zIndex: 0
      }),
      // Footer text
      makeText({
        id: uid(), x: 2, y: 47.5, w: 65, h: 5, content: "{{school_code}} | Valid: {{validity_date}}",
        fontSize: 6, color: "#ffffff", align: "left", zIndex: 1
      }),
      // QR code
      makeQr({
        id: uid(), x: 68, y: 16, w: 15, h: 15, data: "{{student_id}}", zIndex: 2
      })
    ]
  };
}

/** Resolve token placeholders for preview rendering */
export function resolveTokens(
  content: string,
  sampleData: Record<string, string>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => sampleData[key] ?? `[${key}]`);
}

export const SAMPLE_DATA: Record<string, string> = {
  student_name: "Aarav Kumar",
  first_name: "Aarav",
  last_name: "Kumar",
  student_id: "S-2024-00142",
  admission_number: "ADM-2024-142",
  employee_id: "EMP-0042",
  class: "10",
  section: "A",
  department: "Science",
  designation: "Teacher",
  roll_number: "14",
  blood_group: "O+",
  date_of_birth: "15 Mar 2010",
  gender: "Male",
  parent_name: "Rajesh Kumar",
  parent_mobile: "98765 43210",
  school_name: "Delhi Public School",
  school_code: "DPS-GRN-001",
  school_email: "admin@dpsgreen.edu.in",
  institution_name: "Delhi Public School",
  issue_date: "01 Apr 2024",
  validity_date: "31 Mar 2025",
  address: "12 Green Park, New Delhi",
  custom_field_1: "Custom Value 1",
  custom_field_2: "Custom Value 2"
};

/** Sort elements by zIndex for rendering */
export function sortedByZ(elements: AnyElement[]): AnyElement[] {
  return [...elements].sort((a, b) => a.zIndex - b.zIndex);
}

/** Get next available zIndex */
export function nextZ(elements: AnyElement[]): number {
  return elements.length === 0 ? 0 : Math.max(...elements.map((e) => e.zIndex)) + 1;
}
