import type { CodeDiagnostic, DiagnosticSeverity } from "./types";

export interface DiagnosticRequest {
  fileId: string;
  filePath: string;
  language: string;
  content: string;
  workspacePaths: string[];
}

interface Position {
  line: number;
  column: number;
}

const C_STYLE_LANGUAGES = new Set(["javascript", "typescript", "java", "kotlin", "c", "cpp", "csharp", "rust", "go", "php"]);
const JS_LANGUAGES = new Set(["javascript", "typescript"]);

const positionAt = (content: string, index: number): Position => {
  const before = content.slice(0, Math.max(0, index));
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
};

const diagnostic = (
  request: DiagnosticRequest,
  message: string,
  position: Position,
  severity: DiagnosticSeverity,
  code: string,
  source = "IDE Core"
): CodeDiagnostic => ({
  id: `${request.fileId}-${code}-${position.line}-${position.column}`,
  fileId: request.fileId,
  filePath: request.filePath,
  message,
  source,
  severity,
  line: position.line,
  column: position.column,
  endLine: position.line,
  endColumn: position.column + 1,
  code
});

const analyseDelimiters = (request: DiagnosticRequest): CodeDiagnostic[] => {
  const { content } = request;
  const result: CodeDiagnostic[] = [];
  const stack: Array<{ char: string; index: number }> = [];
  const openers: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const closers = new Set(Object.values(openers));
  let quote: "'" | "\"" | "`" | null = null;
  let quoteStart = 0;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;
    const next = content[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      } else if (char === "\n" && quote !== "`" && request.language !== "python") {
        result.push(diagnostic(request, "Cadena de texto sin cerrar antes del final de línea.", positionAt(content, quoteStart), "error", "syntax.unclosed-string"));
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/" && request.language !== "python") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "#" && request.language === "python") {
      lineComment = true;
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      quoteStart = index;
      continue;
    }
    if (openers[char]) {
      stack.push({ char, index });
      continue;
    }
    if (closers.has(char)) {
      const top = stack.at(-1);
      if (!top || openers[top.char] !== char) {
        result.push(diagnostic(request, `Delimitador «${char}» inesperado.`, positionAt(content, index), "error", "syntax.unexpected-delimiter"));
      } else {
        stack.pop();
      }
    }
  }

  if (quote) {
    result.push(diagnostic(request, "Cadena de texto sin cerrar.", positionAt(content, quoteStart), "error", "syntax.unclosed-string"));
  }
  if (blockComment) {
    result.push(diagnostic(request, "Comentario de bloque sin cerrar.", positionAt(content, Math.max(0, content.lastIndexOf("/*"))), "error", "syntax.unclosed-comment"));
  }
  for (const item of stack.slice(-25)) {
    result.push(diagnostic(request, `Falta el delimitador de cierre «${openers[item.char]}».`, positionAt(content, item.index), "error", "syntax.unclosed-delimiter"));
  }

  return result;
};

const analyseIndentation = (request: DiagnosticRequest): CodeDiagnostic[] => {
  if (request.language !== "python") return [];
  const result: CodeDiagnostic[] = [];
  const lines = request.content.split("\n");
  let sawTabs = false;
  let sawSpaces = false;

  lines.forEach((line, index) => {
    const indentation = line.match(/^[\t ]+/)?.[0] ?? "";
    if (!line.trim() || !indentation) return;
    if (indentation.includes("\t")) sawTabs = true;
    if (indentation.includes(" ")) sawSpaces = true;
    if (indentation.includes("\t") && indentation.includes(" ")) {
      result.push(diagnostic(request, "Esta línea mezcla tabuladores y espacios en la sangría.", { line: index + 1, column: 1 }, "error", "python.mixed-indent"));
    }
    if (!indentation.includes("\t") && indentation.length % 4 !== 0) {
      result.push(diagnostic(request, "La sangría no es múltiplo de cuatro espacios.", { line: index + 1, column: 1 }, "warning", "python.indent-width"));
    }
  });

  if (sawTabs && sawSpaces && !result.some((item) => item.code === "python.mixed-indent")) {
    result.push(diagnostic(request, "El archivo alterna tabuladores y espacios entre bloques.", { line: 1, column: 1 }, "warning", "python.inconsistent-indent"));
  }
  return result;
};

const analyseSemicolons = (request: DiagnosticRequest): CodeDiagnostic[] => {
  if (!C_STYLE_LANGUAGES.has(request.language) || request.language === "javascript" || request.language === "typescript" || request.language === "rust") return [];
  const result: CodeDiagnostic[] = [];
  const statement = /^(?:return\b|throw\b|break\b|continue\b|(?:const|let|var|int|long|double|float|bool|boolean|char|string|String|auto|var)\b|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*[=(])/;
  request.content.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.endsWith(";") || trimmed.endsWith("{") || trimmed.endsWith("}") || trimmed.endsWith(":") || trimmed.startsWith("@")) return;
    if (statement.test(trimmed)) {
      result.push(diagnostic(request, "Posible punto y coma ausente al final de la instrucción.", { line: index + 1, column: line.length + 1 }, "warning", "syntax.missing-semicolon"));
    }
  });
  return result.slice(0, 30);
};

const analyseVariables = (request: DiagnosticRequest): CodeDiagnostic[] => {
  if (!["javascript", "typescript", "java", "csharp", "python"].includes(request.language)) return [];
  const result: CodeDiagnostic[] = [];
  const declarationPatterns: RegExp[] = request.language === "python"
    ? [/^\s*([A-Za-z_]\w*)\s*=\s*(?!=)/gm]
    : [/(?:\bconst|\blet|\bvar|\bint|\blong|\bdouble|\bfloat|\bboolean|\bbool|\bString|\bstring)\s+([A-Za-z_$][\w$]*)/g];

  for (const pattern of declarationPatterns) {
    for (const match of request.content.matchAll(pattern)) {
      const name = match[1];
      if (!name || name.startsWith("_")) continue;
      const occurrences = request.content.match(new RegExp(`\\b${name.replace(/[$]/g, "\\$")}\\b`, "g"))?.length ?? 0;
      if (occurrences === 1) {
        const index = (match.index ?? 0) + match[0].lastIndexOf(name);
        result.push(diagnostic(request, `La variable «${name}» se declara pero no se utiliza.`, positionAt(request.content, index), "warning", "semantic.unused-variable"));
      }
    }
  }

  if (JS_LANGUAGES.has(request.language)) {
    const assignments = /^\s*([A-Za-z_$][\w$]*)\s*=\s*(?!=)/gm;
    const declared = new Set<string>();
    for (const match of request.content.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
      if (match[1]) declared.add(match[1]);
    }
    const globals = new Set(["window", "document", "console", "globalThis", "self", "exports", "module"]);
    for (const match of request.content.matchAll(assignments)) {
      const name = match[1];
      if (!name || declared.has(name) || globals.has(name)) continue;
      result.push(diagnostic(request, `Asignación a «${name}» sin declaración local. ¿Falta const o let?`, positionAt(request.content, match.index ?? 0), "warning", "semantic.undeclared-assignment"));
    }
  }
  return result.slice(0, 40);
};

const resolveRelativePath = (fromPath: string, specifier: string): string => {
  const parts = fromPath.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "." || !part) continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
};

const analyseImports = (request: DiagnosticRequest): CodeDiagnostic[] => {
  if (!JS_LANGUAGES.has(request.language)) return [];
  const result: CodeDiagnostic[] = [];
  const importPattern = /(?:from\s+|import\s*\()(["'])(\.[^"']+)\1/g;
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
  for (const match of request.content.matchAll(importPattern)) {
    const specifier = match[2];
    if (!specifier) continue;
    const base = resolveRelativePath(request.filePath, specifier);
    const exists = extensions.some((extension) => request.workspacePaths.includes(`${base}${extension}`));
    if (!exists) {
      const specifierIndex = (match.index ?? 0) + match[0].indexOf(specifier);
      result.push(diagnostic(request, `No se encuentra el módulo local «${specifier}».`, positionAt(request.content, specifierIndex), "error", "semantic.missing-import"));
    }
  }
  return result;
};

const analyseTypes = (request: DiagnosticRequest): CodeDiagnostic[] => {
  if (!new Set(["typescript", "java", "csharp"]).has(request.language)) return [];
  const result: CodeDiagnostic[] = [];
  const stringToNumber = /\b(?:number|int|long|double|float)\s+([A-Za-z_]\w*)\s*=\s*(["'])/g;
  for (const match of request.content.matchAll(stringToNumber)) {
    result.push(diagnostic(request, `«${match[1] ?? "valor"}» espera un número, pero recibe texto.`, positionAt(request.content, match.index ?? 0), "error", "semantic.type-mismatch"));
  }
  const numberToString = /\b(?:string|String)\s+([A-Za-z_]\w*)\s*=\s*\d+(?:\.\d+)?\s*;/g;
  for (const match of request.content.matchAll(numberToString)) {
    result.push(diagnostic(request, `«${match[1] ?? "valor"}» espera texto, pero recibe un número.`, positionAt(request.content, match.index ?? 0), "error", "semantic.type-mismatch"));
  }
  return result;
};

export const analyseCode = (request: DiagnosticRequest): CodeDiagnostic[] => {
  if (!request.content.trim()) return [];
  return [
    ...analyseDelimiters(request),
    ...analyseIndentation(request),
    ...analyseSemicolons(request),
    ...analyseVariables(request),
    ...analyseImports(request),
    ...analyseTypes(request)
  ].slice(0, 200);
};
