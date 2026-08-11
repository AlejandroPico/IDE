import { describe, expect, it } from "vitest";
import { buildWebPreview } from "./runtime";
import { createProjectFromTemplate } from "../core/templates";

describe("vista previa web", () => {
  it("incrusta CSS y JavaScript locales en un documento aislable", () => {
    const project = createProjectFromTemplate("web-vanilla", "Prueba");
    const preview = buildWebPreview(project);
    expect(preview).toContain("data-ide-source=\"styles.css\"");
    expect(preview).toContain("data-ide-source=\"app.js\"");
    expect(preview).toContain("source:\"ide-preview\"");
    expect(preview).not.toContain("href=\"styles.css\"");
  });
});
