import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { Navigation } from "./navigation";

describe("Navigation", () => {
  it("renders focus-first route links", () => {
    render(<Navigation />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Focus" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Canvas" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Chrome" })).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: "Integrations" }),
    ).toBeNull();
  });
});
