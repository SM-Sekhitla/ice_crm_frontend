// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addContact: vi.fn(),
  navigate: vi.fn(),
  user: {
    id: "admin",
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
    role: "Super Admin",
    productIds: [],
  },
}));
vi.mock("../../app/context", () => ({
  useCRM: () => ({
    user: mocks.user,
    db: { contacts: [], products: [], campaigns: [] },
    addContact: mocks.addContact,
    openContact: vi.fn(),
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => "/",
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, ...props }: any) =>
    createElement("a", { href: to, ...props }, children),
}));
vi.mock("../../pwa/client", () => ({
  usePwa: () => ({ online: true, updateReady: false }),
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  mocks.user.role = "Super Admin";
  mocks.addContact.mockClear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query === "(max-width: 760px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function renderShell() {
  const { Shell } = await import("./Shell");
  await act(async () =>
    root.render(
      createElement(
        Tooltip.Provider,
        null,
        createElement(Shell, {
          children: createElement("div", null, "Workspace"),
        }),
      ),
    ),
  );
}
describe("mobile quick navigation", () => {
  it("offers four destinations and opens the existing contact form from the plus", async () => {
    await renderShell();
    const dock = container.querySelector('nav[aria-label="Quick navigation"]')!;
    expect(
      Array.from(dock.querySelectorAll("a")).map((a) => a.getAttribute("href")),
    ).toEqual(["/", "/contacts", "/calendar"]);
    expect(
      dock.querySelector('a[href="/"]')?.getAttribute("aria-current"),
    ).toBe("page");
    const add = dock.querySelector<HTMLButtonElement>(
      'button[aria-label="Add contact"]',
    )!;
    await act(async () => add.click());
    expect(mocks.addContact).toHaveBeenCalledOnce();
  });
  it("More exposes remaining modules, with a close action and inert page behind it", async () => {
    await renderShell();
    const aside = container.querySelector("aside")!;
    expect(aside.hasAttribute("inert")).toBe(true);
    const more = container.querySelector<HTMLButtonElement>(
      '.mobile-dock button[aria-controls="workspace-navigation"]',
    )!;
    await act(async () => more.click());
    expect(aside.getAttribute("role")).toBe("dialog");
    expect(aside.getAttribute("aria-modal")).toBe("true");
    expect(aside.hasAttribute("inert")).toBe(false);
    for (const path of [
      "/leads",
      "/clients",
      "/products",
      "/campaigns",
      "/users",
      "/email-configurations",
      "/backend-logs",
    ])
      expect(aside.querySelector(`a[href="${path}"]`)).not.toBeNull();
    expect(container.querySelector(".main-shell")?.hasAttribute("inert")).toBe(
      true,
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(".mobile-sidebar-close")!
        .click(),
    );
    expect(aside.hasAttribute("inert")).toBe(true);
    expect(container.querySelector(".main-shell")?.hasAttribute("inert")).toBe(
      false,
    );
  });
  it("keeps administration modules hidden from BDO accounts", async () => {
    mocks.user.role = "BDO";
    await renderShell();
    const aside = container.querySelector("aside")!;
    expect(aside.querySelector('a[href="/users"]')).toBeNull();
    expect(aside.querySelector('a[href="/backend-logs"]')).toBeNull();
    expect(aside.querySelector('a[href="/campaigns"]')).not.toBeNull();
  });
});
