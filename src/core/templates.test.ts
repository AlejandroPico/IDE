import { describe, expect, it } from "vitest";
import { createProjectFromTemplate, PROJECT_TEMPLATES } from "./templates";

describe("plantillas de proyecto", () => {
  it("mantiene identificadores y rutas únicas", () => {
    const ids = PROJECT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const template of PROJECT_TEMPLATES) {
      const paths = template.files.map((file) => file.path);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it("crea un proyecto completamente editable", () => {
    const project = createProjectFromTemplate("spring-boot", "Mi Servicio Cósmico");
    expect(project.name).toBe("Mi Servicio Cósmico");
    expect(Object.values(project.files).some((file) => file.path === "pom.xml")).toBe(true);
    expect(Object.values(project.files).every((file) => file.dirty === false)).toBe(true);
  });

  it("ofrece una base amplia de tecnologías", () => {
    expect(PROJECT_TEMPLATES.length).toBeGreaterThanOrEqual(15);
    expect(PROJECT_TEMPLATES.some((template) => template.id === "react-typescript")).toBe(true);
    expect(PROJECT_TEMPLATES.some((template) => template.id === "rust")).toBe(true);
    expect(PROJECT_TEMPLATES.some((template) => template.id === "dotnet-console")).toBe(true);
  });
});
