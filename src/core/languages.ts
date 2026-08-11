export interface LanguageDefinition {
  id: string;
  label: string;
  extensions: string[];
  color: string;
  comment: string;
  webRuntime: "browser" | "javascript" | "typescript" | "python" | "none";
  desktopRuntime: string;
}

export const LANGUAGES: LanguageDefinition[] = [
  { id: "typescript", label: "TypeScript", extensions: ["ts", "tsx"], color: "#5da9f6", comment: "//", webRuntime: "typescript", desktopRuntime: "Node, Deno o Bun" },
  { id: "javascript", label: "JavaScript", extensions: ["js", "jsx", "mjs", "cjs"], color: "#f1cf5a", comment: "//", webRuntime: "javascript", desktopRuntime: "Node, Deno o Bun" },
  { id: "html", label: "HTML", extensions: ["html", "htm"], color: "#f0794f", comment: "<!--", webRuntime: "browser", desktopRuntime: "Vista web" },
  { id: "css", label: "CSS", extensions: ["css", "scss", "sass", "less"], color: "#b881f7", comment: "/*", webRuntime: "browser", desktopRuntime: "Vista web" },
  { id: "python", label: "Python", extensions: ["py", "pyw"], color: "#70c6df", comment: "#", webRuntime: "python", desktopRuntime: "CPython" },
  { id: "java", label: "Java", extensions: ["java"], color: "#ed8b62", comment: "//", webRuntime: "none", desktopRuntime: "JDK / Maven / Gradle" },
  { id: "kotlin", label: "Kotlin", extensions: ["kt", "kts"], color: "#b176f2", comment: "//", webRuntime: "none", desktopRuntime: "Kotlin/JVM" },
  { id: "c", label: "C", extensions: ["c", "h"], color: "#91a8d0", comment: "//", webRuntime: "none", desktopRuntime: "GCC o Clang" },
  { id: "cpp", label: "C++", extensions: ["cpp", "cc", "cxx", "hpp", "hh"], color: "#6a94d4", comment: "//", webRuntime: "none", desktopRuntime: "G++ o Clang++" },
  { id: "csharp", label: "C#", extensions: ["cs", "csx"], color: "#9bd27d", comment: "//", webRuntime: "none", desktopRuntime: ".NET SDK" },
  { id: "rust", label: "Rust", extensions: ["rs"], color: "#d6a16d", comment: "//", webRuntime: "none", desktopRuntime: "Cargo / rustc" },
  { id: "php", label: "PHP", extensions: ["php"], color: "#9194d3", comment: "//", webRuntime: "none", desktopRuntime: "PHP CLI" },
  { id: "go", label: "Go", extensions: ["go"], color: "#58c9dc", comment: "//", webRuntime: "none", desktopRuntime: "Go" },
  { id: "ruby", label: "Ruby", extensions: ["rb"], color: "#e56d6d", comment: "#", webRuntime: "none", desktopRuntime: "Ruby" },
  { id: "shell", label: "Shell", extensions: ["sh", "bash", "zsh", "ps1", "bat", "cmd"], color: "#9bc89b", comment: "#", webRuntime: "none", desktopRuntime: "Shell del sistema" },
  { id: "sql", label: "SQL", extensions: ["sql"], color: "#e0b96b", comment: "--", webRuntime: "none", desktopRuntime: "Cliente de base de datos" },
  { id: "json", label: "JSON", extensions: ["json", "jsonc"], color: "#d8c56a", comment: "//", webRuntime: "none", desktopRuntime: "Datos" },
  { id: "yaml", label: "YAML", extensions: ["yaml", "yml"], color: "#df747a", comment: "#", webRuntime: "none", desktopRuntime: "Configuración" },
  { id: "xml", label: "XML", extensions: ["xml", "svg", "xsl"], color: "#e68a58", comment: "<!--", webRuntime: "none", desktopRuntime: "Datos" },
  { id: "markdown", label: "Markdown", extensions: ["md", "mdx"], color: "#8db4c7", comment: "<!--", webRuntime: "none", desktopRuntime: "Documento" },
  { id: "plaintext", label: "Texto", extensions: ["txt", "log", "env", "gitignore"], color: "#91a09b", comment: "#", webRuntime: "none", desktopRuntime: "Texto" }
];

const languageByExtension = new Map(
  LANGUAGES.flatMap((language) => language.extensions.map((extension) => [extension, language] as const))
);

export const getExtension = (path: string): string => {
  const name = path.split("/").pop() ?? path;
  if (name === "Dockerfile") return "dockerfile";
  if (name.startsWith(".") && !name.slice(1).includes(".")) return name.slice(1).toLowerCase();
  return name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
};

export const detectLanguage = (path: string): string => {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (name === "dockerfile") return "dockerfile";
  if (name === "cargo.toml") return "toml";
  if (name === "pom.xml") return "xml";
  return languageByExtension.get(getExtension(path))?.id ?? "plaintext";
};

export const getLanguage = (id: string): LanguageDefinition =>
  LANGUAGES.find((language) => language.id === id) ?? LANGUAGES[LANGUAGES.length - 1]!;

export const getLanguageForPath = (path: string): LanguageDefinition => getLanguage(detectLanguage(path));

export const languageBadge = (path: string): string => {
  const extension = getExtension(path);
  if (!extension) return "·";
  const aliases: Record<string, string> = {
    javascript: "JS",
    typescript: "TS",
    python: "PY",
    markdown: "MD",
    csharp: "C#",
    plaintext: "TXT"
  };
  const language = getLanguageForPath(path);
  return aliases[language.id] ?? extension.slice(0, 3).toUpperCase();
};
