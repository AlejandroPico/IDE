import type { ProjectTemplate, TemplateFile, WorkspaceProject } from "./types";
import { createId } from "./types";
import { detectLanguage } from "./languages";

const webStarter: TemplateFile[] = [
  {
    path: "index.html",
    content: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mi proyecto</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main class="hero">
      <p class="eyebrow">PROYECTO INICIAL</p>
      <h1>Construye algo extraordinario.</h1>
      <p>Edita los archivos y pulsa Ejecutar para ver el resultado.</p>
      <button id="action">Probar interacción</button>
    </main>
    <script src="app.js"></script>
  </body>
</html>`
  },
  {
    path: "styles.css",
    content: `:root { font-family: Inter, system-ui, sans-serif; color: #eafff8; background: #07110f; }
* { box-sizing: border-box; }
body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: radial-gradient(circle at 25% 20%, #123a31, #07110f 55%); }
.hero { width: min(680px, 88vw); border-left: 3px solid #63e6be; padding: 2rem 2.5rem; }
.eyebrow { color: #63e6be; letter-spacing: .18em; font-size: .75rem; }
h1 { font-size: clamp(2.4rem, 8vw, 5.5rem); line-height: .95; margin: .3em 0; }
p { color: #a9c9bf; line-height: 1.6; }
button { border: 1px solid #63e6be; background: transparent; color: #eafff8; padding: .8rem 1.2rem; cursor: pointer; }
button:hover { background: #63e6be; color: #07110f; }`
  },
  {
    path: "app.js",
    content: `const button = document.querySelector("#action");

button.addEventListener("click", () => {
  button.textContent = "¡Funciona!";
  console.log("Interacción ejecutada correctamente");
});`
  },
  {
    path: "README.md",
    content: `# Mi proyecto web

Proyecto HTML, CSS y JavaScript ejecutable íntegramente en el navegador.
`
  }
];

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "web-vanilla",
    name: "Web esencial",
    language: "HTML / CSS / JavaScript",
    framework: "Web Platform",
    category: "web",
    description: "Sitio moderno sin dependencias, ejecutable al instante en el navegador.",
    accent: "#63e6be",
    webRunnable: true,
    desktopRunnable: true,
    tags: ["HTML", "CSS", "JavaScript", "Inicio rápido"],
    files: webStarter
  },
  {
    id: "react-typescript",
    name: "React + TypeScript",
    language: "TypeScript",
    framework: "React 19",
    category: "web",
    description: "SPA React estrictamente tipada con Vite y una estructura lista para crecer.",
    accent: "#61dafb",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["React", "TypeScript", "Vite", "SPA"],
    files: [
      { path: "package.json", content: `{"name":"mi-react-app","private":true,"version":"0.1.0","type":"module","scripts":{"dev":"vite","build":"tsc -b && vite build"},"dependencies":{"@vitejs/plugin-react":"latest","vite":"latest","typescript":"latest","react":"latest","react-dom":"latest"},"devDependencies":{"@types/react":"latest","@types/react-dom":"latest"}}` },
      { path: "index.html", content: `<div id="root"></div><script type="module" src="/src/main.tsx"></script>` },
      { path: "src/main.tsx", content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return <main><p>REACT + TYPESCRIPT</p><h1>Tu nueva aplicación.</h1></main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);` },
      { path: "src/styles.css", content: `:root { font-family: system-ui; color: #eefcf8; background: #081512; } body { margin: 0; } main { min-height: 100vh; display: grid; place-content: center; } h1 { font-size: 4rem; } p { color: #61dafb; letter-spacing: .2em; }` },
      { path: "tsconfig.json", content: `{"compilerOptions":{"target":"ES2024","module":"ESNext","moduleResolution":"Bundler","strict":true,"jsx":"react-jsx","noEmit":true},"include":["src"]}` },
      { path: "vite.config.ts", content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });` }
    ]
  },
  {
    id: "vue-typescript",
    name: "Vue + TypeScript",
    language: "TypeScript",
    framework: "Vue 3",
    category: "web",
    description: "Aplicación Vue con Composition API, Vite y tipado estricto.",
    accent: "#42d392",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["Vue", "TypeScript", "Vite"],
    files: [
      { path: "package.json", content: `{"name":"mi-vue-app","private":true,"version":"0.1.0","type":"module","scripts":{"dev":"vite","build":"vite build"},"dependencies":{"@vitejs/plugin-vue":"latest","vite":"latest","typescript":"latest","vue":"latest"},"devDependencies":{}}` },
      { path: "index.html", content: `<div id="app"></div><script type="module" src="/src/main.ts"></script>` },
      { path: "src/main.ts", content: `import { createApp } from "vue";
import App from "./App.vue";
createApp(App).mount("#app");` },
      { path: "src/App.vue", content: `<script setup lang="ts">
import { ref } from "vue";
const count = ref(0);
</script>

<template><main><p>VUE + TYPESCRIPT</p><h1>Proyecto preparado</h1><button @click="count++">Pulsos: {{ count }}</button></main></template>

<style>body{margin:0;background:#081512;color:#f4fffb;font-family:system-ui}main{min-height:100vh;display:grid;place-content:center}p,button{color:#42d392}</style>` }
    ]
  },
  {
    id: "angular",
    name: "Angular",
    language: "TypeScript",
    framework: "Angular",
    category: "web",
    description: "Base standalone para una aplicación Angular contemporánea.",
    accent: "#f05b78",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["Angular", "TypeScript", "Standalone"],
    files: [
      { path: "README.md", content: `# Aplicación Angular

En Desktop abre una terminal en esta carpeta y ejecuta \`npx @angular/cli new . --standalone --routing --style=scss\` para materializar el entorno completo más reciente.
` },
      { path: "src/app/app.component.ts", content: `import { Component } from "@angular/core";

@Component({
  selector: "app-root",
  standalone: true,
  template: \`<main><p>ANGULAR</p><h1>Arquitectura preparada</h1></main>\`,
  styles: [\`main { min-height: 100vh; display: grid; place-content: center; }\`]
})
export class AppComponent {}` }
    ]
  },
  {
    id: "node-typescript",
    name: "Node + TypeScript",
    language: "TypeScript",
    framework: "Node.js",
    category: "backend",
    description: "Servicio Node moderno con módulos ES, scripts de desarrollo y tipado estricto.",
    accent: "#87cf65",
    webRunnable: true,
    desktopRunnable: true,
    tags: ["Node", "TypeScript", "Backend"],
    files: [
      { path: "package.json", content: `{"name":"mi-servicio","private":true,"version":"0.1.0","type":"module","scripts":{"dev":"node --experimental-strip-types src/index.ts","start":"node --experimental-strip-types src/index.ts","check":"tsc --noEmit"},"devDependencies":{"typescript":"latest","@types/node":"latest"}}` },
      { path: "src/index.ts", content: `interface Health { status: "ok"; timestamp: string }

const health: Health = { status: "ok", timestamp: new Date().toISOString() };
console.log("Servicio preparado", health);` },
      { path: "tsconfig.json", content: `{"compilerOptions":{"target":"ES2024","module":"NodeNext","moduleResolution":"NodeNext","strict":true,"noEmit":true},"include":["src"]}` }
    ]
  },
  {
    id: "python",
    name: "Python",
    language: "Python",
    framework: "Python 3.14",
    category: "general",
    description: "Proyecto Python limpio, ejecutable en Pyodide o con CPython local.",
    accent: "#70c6df",
    webRunnable: true,
    desktopRunnable: true,
    tags: ["Python", "Pyodide", "CLI"],
    files: [
      { path: "main.py", content: `from dataclasses import dataclass

@dataclass(frozen=True)
class Proyecto:
    nombre: str
    version: str

proyecto = Proyecto("Mi proyecto", "0.1.0")
print(f"{proyecto.nombre} · versión {proyecto.version}")
print("Python está funcionando correctamente")` },
      { path: "requirements.txt", content: `# Añade aquí tus dependencias
` },
      { path: "README.md", content: `# Proyecto Python

Ejecuta \`main.py\` directamente en el navegador o mediante CPython en la edición Desktop.
` }
    ]
  },
  {
    id: "fastapi",
    name: "FastAPI",
    language: "Python",
    framework: "FastAPI",
    category: "backend",
    description: "API asíncrona tipada con rutas, validación y pruebas iniciales.",
    accent: "#33c7a2",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["Python", "FastAPI", "REST", "Pydantic"],
    files: [
      { path: "app/main.py", content: `from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Mi API", version="0.1.0")

class Health(BaseModel):
    status: str

@app.get("/health", response_model=Health)
async def health() -> Health:
    return Health(status="ok")` },
      { path: "requirements.txt", content: `fastapi
uvicorn[standard]
pytest
httpx
` },
      { path: "README.md", content: `# FastAPI

\`python -m venv .venv\` · \`pip install -r requirements.txt\` · \`uvicorn app.main:app --reload\`
` }
    ]
  },
  {
    id: "django",
    name: "Django",
    language: "Python",
    framework: "Django",
    category: "backend",
    description: "Esqueleto documentado para un proyecto Django con entorno aislado.",
    accent: "#4cb285",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["Python", "Django", "ORM", "Web"],
    files: [
      { path: "requirements.txt", content: `Django
` },
      { path: "README.md", content: `# Django

1. \`python -m venv .venv\`
2. Activa el entorno e instala \`pip install -r requirements.txt\`.
3. Ejecuta \`django-admin startproject config .\` desde la terminal integrada.
4. Inicia con \`python manage.py runserver\`.
` }
    ]
  },
  {
    id: "java",
    name: "Java",
    language: "Java",
    framework: "JDK",
    category: "general",
    description: "Aplicación Java modular y sencilla para compilar con un JDK local.",
    accent: "#ed8b62",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["Java", "JDK", "CLI"],
    files: [
      { path: "src/Main.java", content: `public final class Main {
    private Main() {}

    public static void main(String[] args) {
        System.out.println("Java está funcionando correctamente");
    }
}` },
      { path: "README.md", content: `# Java

La edición Desktop detecta \`javac\`, compila y ejecuta la clase principal automáticamente.
` }
    ]
  },
  {
    id: "spring-boot",
    name: "Spring Boot",
    language: "Java",
    framework: "Spring Boot",
    category: "backend",
    description: "API profesional con Maven, Spring Web, validación, JPA y H2 local.",
    accent: "#74c365",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["Java", "Spring Boot", "Maven", "JPA", "H2"],
    files: [
      { path: "pom.xml", content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>4.1.0</version><relativePath/></parent>
  <groupId>dev.ide</groupId><artifactId>mi-api</artifactId><version>0.1.0</version>
  <properties><java.version>25</java.version></properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
    <dependency><groupId>com.h2database</groupId><artifactId>h2</artifactId><scope>runtime</scope></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
  </dependencies>
  <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>
</project>` },
      { path: "src/main/java/dev/ide/Application.java", content: `package dev.ide;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}` },
      { path: "src/main/java/dev/ide/HealthController.java", content: `package dev.ide;

import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of("status", "ok", "timestamp", Instant.now());
    }
}` },
      { path: "src/main/resources/application.properties", content: `spring.application.name=mi-api
spring.datasource.url=jdbc:h2:file:./data/ide
spring.jpa.hibernate.ddl-auto=update
server.port=8080
` },
      { path: "README.md", content: `# Spring Boot

Requiere JDK 25 y Maven. La edición Desktop detectará el proyecto y ejecutará \`mvn spring-boot:run\`.
` }
    ]
  },
  {
    id: "dotnet-console",
    name: ".NET Console",
    language: "C#",
    framework: ".NET",
    category: "general",
    description: "Aplicación C# moderna con proyecto SDK y tipos anulables.",
    accent: "#9bd27d",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["C#", ".NET", "CLI"],
    files: [
      { path: "MiAplicacion.csproj", content: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup>
</Project>` },
      { path: "Program.cs", content: `record Proyecto(string Nombre, Version Version);

var proyecto = new Proyecto("Mi aplicación", new Version(0, 1, 0));
Console.WriteLine($"{proyecto.Nombre} · {proyecto.Version}");` }
    ]
  },
  {
    id: "aspnet-api",
    name: "ASP.NET Core API",
    language: "C#",
    framework: "ASP.NET Core",
    category: "backend",
    description: "API mínima tipada y preparada para OpenAPI con .NET moderno.",
    accent: "#ad87ef",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["C#", ".NET", "REST", "OpenAPI"],
    files: [
      { path: "Api.csproj", content: `<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>` },
      { path: "Program.cs", content: `var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", timestamp = DateTimeOffset.UtcNow }));
app.Run();` }
    ]
  },
  {
    id: "c-cmake",
    name: "C + CMake",
    language: "C",
    framework: "CMake",
    category: "systems",
    description: "Proyecto C portátil con compilación moderna y avisos estrictos.",
    accent: "#91a8d0",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["C", "CMake", "Sistemas"],
    files: [
      { path: "CMakeLists.txt", content: `cmake_minimum_required(VERSION 3.30)
project(mi_proyecto C)
set(CMAKE_C_STANDARD 23)
set(CMAKE_C_STANDARD_REQUIRED ON)
add_executable(mi_proyecto src/main.c)
if(MSVC)
  target_compile_options(mi_proyecto PRIVATE /W4)
else()
  target_compile_options(mi_proyecto PRIVATE -Wall -Wextra -Wpedantic)
endif()` },
      { path: "src/main.c", content: `#include <stdio.h>

int main(void) {
    puts("C está funcionando correctamente");
    return 0;
}` }
    ]
  },
  {
    id: "cpp-cmake",
    name: "C++ + CMake",
    language: "C++",
    framework: "CMake",
    category: "systems",
    description: "Aplicación C++ contemporánea con CMake y configuración portable.",
    accent: "#6a94d4",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["C++", "CMake", "Sistemas"],
    files: [
      { path: "CMakeLists.txt", content: `cmake_minimum_required(VERSION 3.30)
project(mi_proyecto LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_executable(mi_proyecto src/main.cpp)` },
      { path: "src/main.cpp", content: `#include <iostream>
#include <string_view>

int main() {
    constexpr std::string_view message{"C++ está funcionando correctamente"};
    std::cout << message << '\\n';
}` }
    ]
  },
  {
    id: "rust",
    name: "Rust",
    language: "Rust",
    framework: "Cargo",
    category: "systems",
    description: "Binario Rust seguro y eficiente administrado por Cargo.",
    accent: "#d6a16d",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["Rust", "Cargo", "Sistemas"],
    files: [
      { path: "Cargo.toml", content: `[package]
name = "mi_proyecto"
version = "0.1.0"
edition = "2024"

[dependencies]
` },
      { path: "src/main.rs", content: `fn main() {
    let project = ("Mi proyecto", env!("CARGO_PKG_VERSION"));
    println!("{} · versión {}", project.0, project.1);
}` }
    ]
  },
  {
    id: "php",
    name: "PHP",
    language: "PHP",
    framework: "PHP CLI",
    category: "backend",
    description: "Aplicación PHP moderna con Composer y tipado estricto.",
    accent: "#9194d3",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["PHP", "Composer", "Backend"],
    files: [
      { path: "composer.json", content: `{"name":"ide/mi-proyecto","description":"Proyecto PHP","require":{"php":">=8.4"},"autoload":{"psr-4":{"App\\\\":"src/"}}}` },
      { path: "src/main.php", content: `<?php
declare(strict_types=1);

$project = ['name' => 'Mi proyecto', 'version' => '0.1.0'];
printf("%s · versión %s\\n", $project['name'], $project['version']);` }
    ]
  },
  {
    id: "go",
    name: "Go",
    language: "Go",
    framework: "Go Modules",
    category: "systems",
    description: "Servicio Go mínimo con módulos y servidor HTTP estándar.",
    accent: "#58c9dc",
    webRunnable: false,
    desktopRunnable: true,
    tags: ["Go", "HTTP", "Backend"],
    files: [
      { path: "go.mod", content: `module example.com/miproyecto

go 1.26
` },
      { path: "main.go", content: `package main

import (
    "encoding/json"
    "log"
    "net/http"
)

func main() {
    http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })
    log.Println("Servidor en http://localhost:8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}` }
    ]
  }
];

export const getTemplate = (id: string): ProjectTemplate =>
  PROJECT_TEMPLATES.find((template) => template.id === id) ?? PROJECT_TEMPLATES[0]!;

export const createProjectFromTemplate = (templateId: string, rawName: string): WorkspaceProject => {
  const template = getTemplate(templateId);
  const name = rawName.trim() || "Proyecto sin título";
  const now = new Date().toISOString();
  const files = Object.fromEntries(
    template.files.map((file) => {
      const id = createId("file");
      return [
        id,
        {
          id,
          path: file.path,
          name: file.path.split("/").pop() ?? file.path,
          content: file.content.replaceAll("Mi proyecto", name).replaceAll("mi_proyecto", toSlug(name, "_")),
          language: detectLanguage(file.path),
          dirty: false,
          size: new Blob([file.content]).size
        }
      ];
    })
  );

  return {
    id: createId("project"),
    name,
    description: template.description,
    templateId: template.id,
    files,
    createdAt: now,
    updatedAt: now
  };
};

export const createWelcomeProject = (): WorkspaceProject =>
  createProjectFromTemplate("web-vanilla", "Laboratorio inicial");

export const toSlug = (value: string, separator = "-"): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "") || "proyecto";
