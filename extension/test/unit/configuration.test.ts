import path from "node:path";
import { describe, expect, it } from "vitest";

import { configuredJavaExecutable, validateJava } from "../../src/javaRuntime";

describe("Java configuration", () => {
  it("uses configured javaHome even when it contains spaces", () => {
    expect(configuredJavaExecutable("C:\\Program Files\\Java\\jdk-17", {}, "win32")).toBe(
      path.join("C:\\Program Files\\Java\\jdk-17", "bin", "java.exe")
    );
  });

  it("falls back to JAVA_HOME then PATH", () => {
    expect(configuredJavaExecutable("", { JAVA_HOME: "/opt/jdk" }, "linux")).toBe(
      path.join("/opt/jdk", "bin", "java")
    );
    expect(configuredJavaExecutable("", {}, "linux")).toBe("java");
  });

  it("validates the Java available to the test process", async () => {
    await expect(validateJava(configuredJavaExecutable(""))).resolves.toBeGreaterThanOrEqual(17);
  });

  it("reports a missing absolute executable", async () => {
    await expect(validateJava(path.resolve("missing-jdk", "bin", "java"))).rejects.toThrow(
      "Java executable not found"
    );
  });
});
