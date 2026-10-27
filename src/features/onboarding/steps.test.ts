import { describe, expect, it } from "vitest";
import { getTourSteps } from "./steps";
import type { User } from "../../types";
const user: User = {
  id: "test-user",
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  role: "BDO",
  productIds: [],
};
describe("first-login tour", () => {
  it("guides BDOs through core modules without exposing administration", () => {
    const steps = getTourSteps(user);
    expect(steps.map((step) => step.path)).toEqual([
      "/",
      "/contacts",
      "/leads",
      "/clients",
      "/products",
      "/campaigns",
      "/profile",
    ]);
    expect(steps.find((step) => step.path === "/products")?.text).toContain(
      "assigned to you",
    );
  });
  it("includes account and sender administration for Super Admins", () => {
    const steps = getTourSteps({ ...user, role: "Super Admin" });
    expect(steps.map((step) => step.path)).toContain("/users");
    expect(steps.map((step) => step.path)).toContain("/email-configurations");
    expect(steps.every((step) => step.text.length < 180)).toBe(true);
  });
});
