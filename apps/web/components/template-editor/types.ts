/**
 * Template Editor — shared types
 *
 * An ID card template is a list of "elements" laid out on a fixed-size canvas.
 * Each element has a position (x, y), size (w, h), rotation, and type-specific
 * properties. The template is serialised to/from JSON and stored on the server.
 */

export type ElementType =
  | "text"
  | "photo"
  | "qr"
  | "barcode"
  | "shape"
  | "image";

export type FontWeight = "normal" | "bold" | "600";
export type TextAlign = "left" | "center" | "right";

/** Token keys that map to student / school data at print time */
export type TokenKey =
  | "student_name"
  | "first_name"
  | "last_name"
  | "student_id"
  | "admission_number"
  | "employee_id"
  | "class"
  | "section"
  | "department"
  | "designation"
  | "roll_number"
  | "blood_group"
  | "date_of_birth"
  | "gender"
  | "parent_name"
  | "parent_mobile"
  | "school_name"
  | "school_code"
  | "issue_date"
  | "validity_date"
  | "address"
  | "custom_field_1"
  | "custom_field_2";

/** Base properties shared by all elements */
interface BaseElement {
  id: string;
  type: ElementType;
  /** Position in mm from top-left of card */
  x: number;
  y: number;
  /** Size in mm */
  w: number;
  h: number;
  rotation: number; // degrees
  locked: boolean;
  visible: boolean;
  zIndex: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  /** Either a static string or a token like "{{student_name}}" */
  content: string;
  /** If set, this is a dynamic token field */
  token?: TokenKey;
  fontSize: number; // pt
  fontFamily: string;
  fontWeight: FontWeight;
  italic: boolean;
  color: string; // CSS hex
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  bgColor?: string; // optional pill background
  bgRadius?: number;
  padding?: number;
}

export interface PhotoElement extends BaseElement {
  type: "photo";
  /** Whether to clip the photo to a circle */
  circle: boolean;
  borderColor: string;
  borderWidth: number;
  /** Placeholder shown in editor */
  placeholder: "face" | "logo" | "stamp";
  objectFit: "cover" | "contain";
  borderRadius: number; // 0-50 %
}

export interface QrElement extends BaseElement {
  type: "qr";
  /** What to encode — can be a token like "{{student_id}}" */
  data: string;
  fgColor: string;
  bgColor: string;
  errorLevel: "L" | "M" | "Q" | "H";
}

export interface BarcodeElement extends BaseElement {
  type: "barcode";
  data: string;
  format: "CODE128" | "CODE39" | "EAN13";
  fgColor: string;
  bgColor: string;
  showText: boolean;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: "rect" | "circle" | "line";
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number; // border-radius %
}

export interface ImageElement extends BaseElement {
  type: "image";
  /** Base64 data URL or signed asset URL */
  src: string;
  objectFit: "cover" | "contain";
  borderRadius: number;
  opacity: number;
}

export type AnyElement =
  | TextElement
  | PhotoElement
  | QrElement
  | BarcodeElement
  | ShapeElement
  | ImageElement;

/** Card size presets in mm */
export type CardSizePreset =
  | "CR80"          // 85.6 × 54 — standard ID
  | "A6"            // 148 × 105
  | "CUSTOM";

export const CARD_SIZES: Record<Exclude<CardSizePreset, "CUSTOM">, { w: number; h: number; label: string }> = {
  CR80: { w: 85.6, h: 54, label: "CR-80 Standard ID (85.6×54 mm)" },
  A6: { w: 148, h: 105, label: "A6 (148×105 mm)" }
};

/** The full template document */
export interface CardTemplate {
  id: string;
  name: string;
  version: number;
  /** Card dimensions in mm */
  cardWidth: number;
  cardHeight: number;
  /** Canvas background */
  background: {
    color: string;
    imageUrl?: string;
    gradient?: { from: string; to: string; angle: number };
  };
  elements: AnyElement[];
  createdAt: string;
  updatedAt: string;
}

/** History entry for undo/redo */
export type HistoryEntry = {
  elements: AnyElement[];
  background: CardTemplate["background"];
};
