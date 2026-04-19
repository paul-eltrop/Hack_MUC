const DEFECT_LABELS: Record<string, string> = {
  SOLDER_COLD: "Cold Solder Joint",
  VIB_FAIL: "Vibration Test Failure",
  LABEL_MISALIGN: "Label Misalignment",
  VISUAL_SCRATCH: "Surface Scratch",
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function defectLabel(code: string): string {
  const exact = DEFECT_LABELS[code];
  if (exact) return exact;
  return toTitleCase(code.replaceAll("_", " "));
}

