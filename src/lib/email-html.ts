import DOMPurify from "dompurify";

const allowedStyles = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "line-height",
  "letter-spacing",
  "color",
  "background-color",
  "text-align",
  "text-decoration",
  "text-transform",
  "vertical-align",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-collapse",
  "border-spacing",
  "border-radius",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "table-layout",
  "white-space",
]);
export function portableImage(src: string) {
  return /^(https:\/\/|data:image\/(png|jpeg|gif|webp);base64,)/i.test(
    src.trim(),
  );
}

/** Keep email layout and typography, while rejecting executable content and CSS resource loading. */
export function sanitizeEmailHtml(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "hr",
      "a",
      "img",
      "span",
      "div",
      "font",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "style",
      "width",
      "height",
      "cellpadding",
      "cellspacing",
      "border",
      "align",
      "valign",
      "face",
      "size",
      "color",
      "bgcolor",
      "colspan",
      "rowspan",
      "role",
    ],
    ALLOW_DATA_ATTR: false,
  });
  const container = document.createElement("div");
  container.innerHTML = clean;
  for (const element of container.querySelectorAll<HTMLElement>("[style]")) {
    const kept: string[] = [];
    for (const property of Array.from(element.style)) {
      const value = element.style.getPropertyValue(property).trim();
      if (
        !allowedStyles.has(property) ||
        !value ||
        value.length > 250 ||
        /[\\@<>]|url\s*\(|expression\s*\(|var\s*\(|calc\s*\(|javascript:|behavior:/i.test(
          value,
        )
      )
        continue;
      // Reject negative spacing or extreme widths that can escape the preview.
      if (
        /^(margin|padding|min-width)/.test(property) &&
        /(^|\s)-[\d.]/.test(value)
      )
        continue;
      if (property === "white-space" && !["normal", "pre-wrap"].includes(value))
        continue;
      kept.push(`${property}: ${value}`);
    }
    element.removeAttribute("style");
    if (kept.length) element.setAttribute("style", kept.join("; "));
  }
  for (const table of container.querySelectorAll("table")) {
    const width = table.getAttribute("width");
    if (width && /^\d{1,4}%?$/.test(width) && !table.style.width)
      table.style.width = width.endsWith("%") ? width : `${width}px`;
    const padding = table.getAttribute("cellpadding");
    if (padding && /^\d{1,3}$/.test(padding))
      for (const cell of table.querySelectorAll<HTMLElement>("td,th"))
        if (
          cell.closest("table") === table &&
          !cell.style.padding &&
          ![
            "padding-top",
            "padding-bottom",
            "padding-left",
            "padding-right",
          ].some((p) => cell.style.getPropertyValue(p))
        )
          cell.style.padding = `${padding}px`;
  }
  for (const cell of container.querySelectorAll<HTMLElement>("td,th")) {
    const align = cell.getAttribute("align");
    const valign = cell.getAttribute("valign");
    if (
      align &&
      ["left", "center", "right", "justify"].includes(align) &&
      !cell.style.textAlign
    )
      cell.style.textAlign = align;
    if (
      valign &&
      ["top", "middle", "bottom", "baseline"].includes(valign) &&
      !cell.style.verticalAlign
    )
      cell.style.verticalAlign = valign;
  }
  for (const image of container.querySelectorAll("img")) {
    if (!portableImage(image.getAttribute("src") ?? "")) image.remove();
    else {
      image.style.maxWidth = "100%";
      image.style.height = "auto";
    }
  }
  for (const link of container.querySelectorAll("a")) {
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(link.getAttribute("href") ?? ""))
      link.removeAttribute("href");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  return container.innerHTML;
}

export interface SignatureImage {
  id: string;
  source: string;
  name: string;
}
export interface PreparedSignature {
  html: string;
  images: SignatureImage[];
}
export function prepareSignatureHtml(source: string): PreparedSignature {
  if (source.length > 150000)
    throw new Error(
      "Use an HTML signature file smaller than 150 KB. Add images separately.",
    );
  const parsed = new DOMParser().parseFromString(source, "text/html");
  // Body-level typography must survive when a complete document becomes an email fragment.
  const wrapper = parsed.createElement("div");
  const style = parsed.body.getAttribute("style");
  if (style) wrapper.setAttribute("style", style);
  wrapper.innerHTML = parsed.body.innerHTML;
  const images = Array.from(wrapper.querySelectorAll("img")).flatMap(
    (image, index) => {
      const src = image.getAttribute("src") ?? "";
      if (portableImage(src)) return [];
      let name = src.split(/[\\/]/).pop() || image.alt || "Signature image";
      try {
        name = decodeURIComponent(name);
      } catch {
        /* Keep the original name if the path is malformed. */
      }
      return [{ id: String(index), source: src, name }];
    },
  );
  return { html: wrapper.outerHTML, images };
}
export function resolveSignatureHtml(
  prepared: PreparedSignature,
  replacements: Record<string, string>,
  omitted: string[],
) {
  const parsed = new DOMParser().parseFromString(prepared.html, "text/html");
  Array.from(parsed.body.querySelectorAll("img")).forEach((image, index) => {
    const id = String(index);
    if (!prepared.images.some((item) => item.id === id)) return;
    if (omitted.includes(id)) {
      image.remove();
      return;
    }
    if (replacements[id] && portableImage(replacements[id])) {
      image.setAttribute("src", replacements[id]);
      return;
    }
    const placeholder = parsed.createElement("p");
    placeholder.textContent = `[Upload image: ${prepared.images.find((item) => item.id === id)?.name}]`;
    image.replaceWith(placeholder);
  });
  return sanitizeEmailHtml(parsed.body.innerHTML);
}
