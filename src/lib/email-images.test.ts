import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  embeddedEmailImages,
  publicImageUrl,
  replaceEmbeddedEmailImages,
} from "./email-images";
const dom = new JSDOM("<!doctype html><html><body></body></html>");
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP6kAAAAASUVORK5CYII=";
beforeAll(() => vi.stubGlobal("DOMParser", dom.window.DOMParser));
afterAll(() => {
  vi.unstubAllGlobals();
  dom.window.close();
});
describe("Brevo email image preparation", () => {
  it("finds and deduplicates embedded images across message and signature", () => {
    const images = embeddedEmailImages({
      Message: `<p>Hello</p><img src="${png}">`,
      Signature: `<table><tr><td><img src="${png}"></td></tr></table>`,
    });
    expect(images).toHaveLength(1);
    expect(images[0].source).toBe(png);
    expect(images[0].name).toBe("email-image-1.png");
    expect(images[0].locations).toEqual(["Message", "Signature"]);
  });
  it("leaves already hosted images out of the resolution list", () => {
    expect(
      embeddedEmailImages({
        Signature: '<img src="https://cdn.example.com/image.png">',
      }),
    ).toEqual([]);
  });
  it("replaces the image source while preserving tables, inline styles and attributes", () => {
    const html = `<div style="font-family:Arial;color:#d32f2f"><p>Kind regards</p><table cellpadding="8"><tr><td><img src="${png}" width="600" alt="Company banner"></td></tr></table></div>`;
    const updated = replaceEmbeddedEmailImages(
      html,
      new Map([
        [png, "https://cdn.example.com/signature.png?version=1&size=600"],
      ]),
    );
    const parsed = new dom.window.DOMParser().parseFromString(
      updated,
      "text/html",
    );
    expect(parsed.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example.com/signature.png?version=1&size=600",
    );
    expect(parsed.querySelector("img")?.getAttribute("width")).toBe("600");
    expect(parsed.querySelector("img")?.getAttribute("alt")).toBe(
      "Company banner",
    );
    expect(parsed.querySelector("table")?.getAttribute("cellpadding")).toBe(
      "8",
    );
    expect(parsed.querySelector("div")?.getAttribute("style")).toBe(
      "font-family:Arial;color:#d32f2f",
    );
    expect(parsed.querySelector("p")?.textContent).toBe("Kind regards");
    expect(embeddedEmailImages({ Signature: updated })).toEqual([]);
  });
  it("does not remove images when no replacement has been supplied", () => {
    const updated = replaceEmbeddedEmailImages(`<img src="${png}">`, new Map());
    expect(embeddedEmailImages({ Signature: updated })).toHaveLength(1);
  });
  it.each([
    "http://cdn.example.com/image.png",
    "javascript:alert(1)",
    "https://user:password@cdn.example.com/image.png",
    "https://localhost/image.png",
    "https://127.0.0.1/image.png",
    "https://10.0.0.1/image.png",
    "https://192.168.1.10/image.png",
    "https://172.16.0.10/image.png",
    "https://site.local/image.png",
    "https://cdn.example.com/image.png#section",
    "not a URL",
  ])("rejects unusable hosted image address %s", (url) => {
    expect(() => publicImageUrl(url)).toThrow();
  });
  it("accepts normal public HTTPS image links", () => {
    expect(
      publicImageUrl(" https://cdn.example.com/image.png?version=1 "),
    ).toBe("https://cdn.example.com/image.png?version=1");
  });
});
