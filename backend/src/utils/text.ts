export function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function slugify(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function stableId(parts: string[]) {
  return slugify(parts.filter(Boolean).join("-")).slice(0, 120);
}
