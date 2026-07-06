export const EXTENSION_VERSION = "0.1.0";
export const FORMATTER_VERSION = "2.91.0";
export const PROTOCOL_VERSION = 1;
export const WORKER_JAR_NAME = "palantir-formatter-worker.jar";

export const JAVAC_EXPORTS = [
  "jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED",
  "jdk.compiler/com.sun.tools.javac.main=ALL-UNNAMED",
  "jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED",
  "jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED",
  "jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED",
  "jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED",
  "jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED"
] as const;
