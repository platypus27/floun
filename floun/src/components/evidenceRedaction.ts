export function redactValue(label: string, value: string): string {
  const normalizedLabel = label.trim() || "value";
  return `[redacted ${normalizedLabel}, ${value.length} characters]`;
}
