"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

const LABEL_HALF_W = 38;
const LABEL_HALF_H = 10;
const LABEL_GAP = 4;

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  markerStart,
  style,
  data,
}: EdgeProps) {
  const flags = data as
    | { _disappearing?: boolean; _entering?: boolean }
    | undefined;
  const disappearing = flags?._disappearing === true;
  const entering = flags?._entering === true;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy);
  let perpX = length > 0 ? dy / length : 0;
  let perpY = length > 0 ? -dx / length : -1;
  // Bei aufwärts-laufenden Linien (dy < 0) die Perp-Richtung um 180° drehen,
  // damit das Label auf derselben relativen Seite landet wie bei abwärts-laufenden.
  if (dy < 0) {
    perpX = -perpX;
    perpY = -perpY;
  }
  // Offset-Betrag = Projektion der Label-Halbgröße auf die Perp-Richtung + Gap.
  // So bleibt bei 45° die nächste Label-Ecke ebenfalls `LABEL_GAP` von der Linie entfernt.
  const perpDist =
    LABEL_GAP +
    Math.abs(perpX) * LABEL_HALF_W +
    Math.abs(perpY) * LABEL_HALF_H;
  const displayX = labelX + perpX * perpDist;
  const displayY = labelY + perpY * perpDist;

  const pathStyle = disappearing
    ? { ...style, animation: "edge-disappear 250ms ease-out forwards" }
    : entering
      ? { ...style, animation: "edge-appear 250ms ease-out both" }
      : style;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={pathStyle}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${displayX}px, ${displayY}px)`,
              pointerEvents: "none",
            }}
          >
            <div
              className={
                disappearing
                  ? "animate-node-disappear"
                  : entering
                    ? "animate-node-pop-in"
                    : ""
              }
              style={{
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 500,
                color: "#52525b",
                background: "rgba(250, 250, 250, 0.9)",
                backdropFilter: "blur(2px)",
                borderRadius: 4,
              }}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { labeled: LabeledEdge };
