import { describe, expect, it } from "vitest";
import { analyseCode } from "./diagnosticsEngine";

const request = (content: string, language = "typescript") => ({
  fileId: "file-1",
  filePath: "src/main.ts",
  language,
  content,
  workspacePaths: ["src/main.ts", "src/util.ts"]
});

describe("motor de diagnóstico", () => {
  it("detecta delimitadores y cadenas sin cerrar", () => {
    const result = analyseCode(request("const value = { test: (1 + 2);\nconst text = \"abierto"));
    expect(result.some((item) => item.code === "syntax.unclosed-delimiter")).toBe(true);
    expect(result.some((item) => item.code === "syntax.unclosed-string")).toBe(true);
  });

  it("detecta variables sin uso", () => {
    const result = analyseCode(request("const visible = 2;\nconst unused = 4;\nconsole.log(visible);"));
    expect(result.some((item) => item.code === "semantic.unused-variable" && item.message.includes("unused"))).toBe(true);
    expect(result.some((item) => item.code === "semantic.unused-variable" && item.message.includes("visible"))).toBe(false);
  });

  it("valida importaciones relativas contra el espacio de trabajo", () => {
    const valid = analyseCode(request("import { util } from './util';\nconsole.log(util);"));
    const invalid = analyseCode(request("import { missing } from './missing';\nconsole.log(missing);"));
    expect(valid.some((item) => item.code === "semantic.missing-import")).toBe(false);
    expect(invalid.some((item) => item.code === "semantic.missing-import")).toBe(true);
  });

  it("avisa de sangrías Python incoherentes", () => {
    const result = analyseCode(request("if True:\n\t print('mezcla')", "python"));
    expect(result.some((item) => item.code === "python.mixed-indent")).toBe(true);
  });
});
