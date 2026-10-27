export interface EmbeddedEmailImage {
  id: string;
  source: string;
  name: string;
  locations: string[];
}
const embedded = /^data:image\/(png|jpeg|gif|webp);base64,/i;
export function embeddedEmailImages(
  parts: Record<string, string>,
): EmbeddedEmailImage[] {
  const bySource = new Map<string, EmbeddedEmailImage>();
  for (const [location, html] of Object.entries(parts)) {
    const document = new DOMParser().parseFromString(html, "text/html");
    for (const image of document.querySelectorAll("img[src]")) {
      const source = image.getAttribute("src") ?? "";
      const match = embedded.exec(source);
      if (!match) continue;
      const previous = bySource.get(source);
      if (previous) {
        if (!previous.locations.includes(location))
          previous.locations.push(location);
      } else {
        const extension =
          match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
        const id = `image-${bySource.size + 1}`;
        bySource.set(source, {
          id,
          source,
          name: `email-${id}.${extension}`,
          locations: [location],
        });
      }
    }
  }
  return [...bySource.values()];
}
export function publicImageUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a full HTTPS image URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Use a public HTTPS image URL without login credentials.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const octets = host.split(".").map(Number);
  const privateIpv4 =
    octets.length === 4 &&
    octets.every(
      (part) => Number.isInteger(part) && part >= 0 && part <= 255,
    ) &&
    (octets[0] === 0 ||
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168));
  if (
    !host.includes(".") ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    privateIpv4
  )
    throw new Error(
      "The image must be publicly reachable; localhost and private network addresses will not work.",
    );
  if (url.hash)
    throw new Error("Use the direct image URL without a page fragment.");
  return url.href;
}
export function replaceEmbeddedEmailImages(
  html: string,
  replacements: Map<string, string>,
): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const image of document.querySelectorAll("img[src]")) {
    const source = image.getAttribute("src") ?? "";
    const replacement = replacements.get(source);
    if (replacement !== undefined)
      image.setAttribute("src", publicImageUrl(replacement));
  }
  return document.body.innerHTML;
}
