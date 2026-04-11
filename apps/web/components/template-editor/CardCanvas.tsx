"use client";

/**
 * CardCanvas — renders the live preview of the ID card template.
 * Handles element selection, drag-to-move, and resize handles.
 */

import { useCallback, useRef, useState } from "react";
import {
  AnyElement,
  CardTemplate,
  PhotoElement,
  ShapeElement,
  TextElement,
  QrElement,
  ImageElement
} from "./types";
import { mmToPx, pxToMm, clamp, resolveTokens, SAMPLE_DATA, sortedByZ } from "./utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  template: CardTemplate;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (element: AnyElement) => void;
  zoom: number; // 1 = 100 %
  sampleData?: Record<string, string>;
};

type DragState = {
  elementId: string;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
};

type ResizeState = {
  elementId: string;
  handle: "se" | "sw" | "ne" | "nw" | "e" | "w" | "n" | "s";
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
};

// ── Constants ────────────────────────────────────────────────────────────────

const DPI = 96;
const HANDLE_SIZE = 8; // px

// ── Main component ───────────────────────────────────────────────────────────

export default function CardCanvas({
  template,
  selectedId,
  onSelect,
  onUpdate,
  zoom,
  sampleData = SAMPLE_DATA
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  const cardW = mmToPx(template.cardWidth, DPI) * zoom;
  const cardH = mmToPx(template.cardHeight, DPI) * zoom;

  // ── Pointer helpers ────────────────────────────────────────────────────────

  const toMm = useCallback(
    (px: number) => pxToMm(px / zoom, DPI),
    [zoom]
  );

  // ── Drag start ─────────────────────────────────────────────────────────────

  const onElementPointerDown = useCallback(
    (e: React.PointerEvent, element: AnyElement) => {
      if (element.locked) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onSelect(element.id);
      dragRef.current = {
        elementId: element.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: element.x,
        startY: element.y
      };
    },
    [onSelect]
  );

  const onElementPointerMove = useCallback(
    (e: React.PointerEvent, element: AnyElement) => {
      if (!dragRef.current || dragRef.current.elementId !== element.id) return;
      const dx = toMm(e.clientX - dragRef.current.startMouseX);
      const dy = toMm(e.clientY - dragRef.current.startMouseY);
      const newX = clamp(dragRef.current.startX + dx, 0, template.cardWidth - element.w);
      const newY = clamp(dragRef.current.startY + dy, 0, template.cardHeight - element.h);
      onUpdate({ ...element, x: newX, y: newY });
    },
    [toMm, onUpdate, template.cardWidth, template.cardHeight]
  );

  const onElementPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Resize ─────────────────────────────────────────────────────────────────

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent, element: AnyElement, handle: ResizeState["handle"]) => {
      if (element.locked) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeRef.current = {
        elementId: element.id,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: element.x,
        startY: element.y,
        startW: element.w,
        startH: element.h
      };
    },
    []
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent, element: AnyElement) => {
      if (!resizeRef.current || resizeRef.current.elementId !== element.id) return;
      const r = resizeRef.current;
      const dx = toMm(e.clientX - r.startMouseX);
      const dy = toMm(e.clientY - r.startMouseY);
      const MIN = 4;

      let x = r.startX;
      let y = r.startY;
      let w = r.startW;
      let h = r.startH;

      if (r.handle.includes("e")) w = Math.max(MIN, r.startW + dx);
      if (r.handle.includes("w")) {
        w = Math.max(MIN, r.startW - dx);
        x = r.startX + (r.startW - w);
      }
      if (r.handle.includes("s")) h = Math.max(MIN, r.startH + dy);
      if (r.handle.includes("n")) {
        h = Math.max(MIN, r.startH - dy);
        y = r.startY + (r.startH - h);
      }

      onUpdate({ ...element, x, y, w, h });
    },
    [toMm, onUpdate]
  );

  const onResizePointerUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  // ── Background style ───────────────────────────────────────────────────────

  const bg = template.background;
  let backgroundStyle: React.CSSProperties = { backgroundColor: bg.color };
  if (bg.gradient) {
    backgroundStyle = {
      background: `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`
    };
  }
  if (bg.imageUrl) {
    backgroundStyle = {
      ...backgroundStyle,
      backgroundImage: `url(${bg.imageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center"
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative select-none shadow-2xl rounded-sm overflow-hidden"
      style={{ width: cardW, height: cardH, ...backgroundStyle }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      {sortedByZ(template.elements)
        .filter((el) => el.visible)
        .map((element) => {
          const isSelected = selectedId === element.id;
          const left = mmToPx(element.x, DPI) * zoom;
          const top = mmToPx(element.y, DPI) * zoom;
          const width = mmToPx(element.w, DPI) * zoom;
          const height = mmToPx(element.h, DPI) * zoom;

          const style: React.CSSProperties = {
            position: "absolute",
            left,
            top,
            width,
            height,
            transform: `rotate(${element.rotation}deg)`,
            cursor: element.locked ? "default" : "move",
            boxSizing: "border-box",
            outline: isSelected ? "2px solid #3b82f6" : "none",
            outlineOffset: 1,
            userSelect: "none"
          };

          return (
            <div
              key={element.id}
              style={style}
              onPointerDown={(e) => onElementPointerDown(e, element)}
              onPointerMove={(e) => {
                onElementPointerMove(e, element);
                onResizePointerMove(e, element);
              }}
              onPointerUp={() => {
                onElementPointerUp();
                onResizePointerUp();
              }}
            >
              {/* Element content */}
              <ElementRenderer element={element} sampleData={sampleData} zoom={zoom} />

              {/* Selection handles */}
              {isSelected && !element.locked && (
                <ResizeHandles
                  element={element}
                  onResizePointerDown={onResizePointerDown}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}

// ── Element renderer ─────────────────────────────────────────────────────────

function ElementRenderer({
  element,
  sampleData,
  zoom
}: {
  element: AnyElement;
  sampleData: Record<string, string>;
  zoom: number;
}) {
  const fontSize = element.type === "text" ? (element as TextElement).fontSize * zoom : 12;

  switch (element.type) {
    case "text": {
      const el = element as TextElement;
      const text = resolveTokens(el.content, sampleData);
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            fontSize: el.fontSize * zoom,
            fontFamily: el.fontFamily,
            fontWeight: el.fontWeight,
            fontStyle: el.italic ? "italic" : "normal",
            color: el.color,
            textAlign: el.align,
            lineHeight: el.lineHeight,
            letterSpacing: el.letterSpacing,
            textTransform: el.textTransform,
            padding: el.padding ? el.padding * zoom : 2,
            background: el.bgColor || "transparent",
            borderRadius: el.bgRadius ? el.bgRadius * zoom : undefined,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            whiteSpace: "pre-wrap"
          }}
        >
          {text}
        </div>
      );
    }

    case "photo": {
      const el = element as PhotoElement;
      const radius = el.circle ? "50%" : `${el.borderRadius}%`;
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: radius,
            border: `${el.borderWidth * zoom}px solid ${el.borderColor}`,
            overflow: "hidden",
            background: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10 * zoom,
            color: "#9ca3af"
          }}
        >
          <span style={{ fontSize: 12 * zoom }}>📷</span>
        </div>
      );
    }

    case "shape": {
      const el = element as ShapeElement;
      if (el.shape === "circle") {
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: el.fill,
              border: `${el.strokeWidth * zoom}px solid ${el.stroke}`
            }}
          />
        );
      }
      if (el.shape === "line") {
        return (
          <div
            style={{
              width: "100%",
              height: el.strokeWidth * zoom,
              background: el.stroke,
              marginTop: "50%",
              transform: "translateY(-50%)"
            }}
          />
        );
      }
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: el.fill,
            border: `${el.strokeWidth * zoom}px solid ${el.stroke}`,
            borderRadius: `${el.radius}%`
          }}
        />
      );
    }

    case "qr": {
      const el = element as QrElement;
      const text = resolveTokens(el.data, sampleData);
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: el.bgColor,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #e5e7eb",
            gap: 2
          }}
        >
          {/* Simplified QR grid placeholder */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 1,
              width: "80%",
              height: "80%"
            }}
          >
            {Array.from({ length: 49 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: Math.random() > 0.5 ? el.fgColor : el.bgColor,
                  borderRadius: 0
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    case "image": {
      const el = element as ImageElement;
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: `${el.borderRadius}%`,
            overflow: "hidden",
            opacity: el.opacity
          }}
        >
          {el.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={el.src}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: el.objectFit }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10 * zoom,
                color: "#9ca3af"
              }}
            >
              🖼️
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

// ── Resize handles ────────────────────────────────────────────────────────────

const HANDLES: ResizeState["handle"][] = ["se", "sw", "ne", "nw", "e", "w", "n", "s"];

const HANDLE_POSITIONS: Record<ResizeState["handle"], React.CSSProperties> = {
  nw: { top: -4, left: -4, cursor: "nw-resize" },
  n: { top: -4, left: "calc(50% - 4px)", cursor: "n-resize" },
  ne: { top: -4, right: -4, cursor: "ne-resize" },
  e: { top: "calc(50% - 4px)", right: -4, cursor: "e-resize" },
  se: { bottom: -4, right: -4, cursor: "se-resize" },
  s: { bottom: -4, left: "calc(50% - 4px)", cursor: "s-resize" },
  sw: { bottom: -4, left: -4, cursor: "sw-resize" },
  w: { top: "calc(50% - 4px)", left: -4, cursor: "w-resize" }
};

function ResizeHandles({
  element,
  onResizePointerDown
}: {
  element: AnyElement;
  onResizePointerDown: (
    e: React.PointerEvent,
    el: AnyElement,
    handle: ResizeState["handle"]
  ) => void;
}) {
  return (
    <>
      {HANDLES.map((handle) => (
        <div
          key={handle}
          style={{
            position: "absolute",
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: "#3b82f6",
            border: "1.5px solid white",
            borderRadius: 2,
            zIndex: 9999,
            ...HANDLE_POSITIONS[handle]
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onResizePointerDown(e, element, handle);
          }}
        />
      ))}
    </>
  );
}
