# Palantir Java Format for VS Code

**English** | [Français](README.fr.md)

A local Java formatting extension for VS Code powered by
[Palantir Java Format](https://github.com/palantir/palantir-java-format).

> **Unofficial community project.** This extension is not developed, endorsed,
> or sponsored by Palantir Technologies.

Bundled Palantir Java Format version: **2.91.0**

## Features

- complete Java document formatting;
- import reordering and spacing;
- unused import removal;
- standard long-string reflow;
- on-demand and format-on-save support;
- fully local execution, with no network port or request while formatting;
- persistent Java worker, avoiding a JVM restart for every document.

Formatting uses Palantir Java Format's
`FormatterService.formatSourceReflowStringsAndFixImports` API. The bundled
version is fixed to provide reproducible output.

## Requirements

- VS Code 1.96 or later;
- JDK 17 or later.

Maven, Gradle, and a local Palantir repository are not required to use the
extension. The VSIX contains the worker and Palantir Java Format in a
self-contained JAR.

## Why this extension?

This extension prioritizes a self-contained installation and reproducible
behavior: the Palantir Java Format engine and its worker are included in the
VSIX. After installation, only JDK 17 or later is required.

Java extensions based on Palantir Java Format do not all use the same execution
model. The following table highlights the key differences so that you can make
an informed choice:

| Criterion | This extension | Other common approaches |
| --- | --- | --- |
| Formatter installation | Included in the VSIX | Repository clone, user-provided JAR or executable, or separate download |
| Runtime requirements | JDK 17+ only | May require Gradle, a local repository, or path configuration |
| Formatter version | Fixed version, displayed at runtime and verified during the build | May depend on the local installation or a download |
| Execution | Persistent local Java worker | New process for each formatting request or external daemon, depending on the extension |
| Communication | `stdin`/`stdout`, with no network port | Depends on the implementation |
| Source-code processing | No network request while formatting | Depends on the installation and execution model |
| Imports and long strings | Handled through Palantir's complete public formatting API | Features may be exposed separately or made optional |

This model is particularly suitable for teams that want the same output on
every workstation without managing the formatter binary themselves. As a
trade-off, the Palantir Java Format version is upgraded through extension
updates, and formatting currently applies to complete documents rather than
selections.

## Installation

### From a VSIX

1. Download or build `palantir-java-format-<version>.vsix`.
2. Open the **Extensions** view in VS Code.
3. Open the `…` menu, select **Install from VSIX…**, and choose the file.

You can also install it from the command line:

```shell
code --install-extension ./palantir-java-format-VERSION.vsix
```

To build the VSIX from source, see [Development](#development).

## Quick start

Set the extension as the default Java formatter in your VS Code settings:

```json
{
  "[java]": {
    "editor.defaultFormatter": "lucasfleury.palantir-java-format",
    "editor.formatOnSave": true
  }
}
```

You can also run **Format Document** from the Command Palette without enabling
format on save.

If several Java formatters are installed, run **Format Document With…**, then
select **Configure Default Formatter…** to choose this extension.

## Configuration

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `palantirJavaFormat.enabled` | boolean | `true` | Enables the Java formatting provider. |
| `palantirJavaFormat.javaHome` | string | `""` | JDK home used by the worker. |
| `palantirJavaFormat.jvmArgs` | string array | `[]` | Additional JVM arguments inserted before `-jar`. |

Complete example:

```json
{
  "[java]": {
    "editor.defaultFormatter": "lucasfleury.palantir-java-format",
    "editor.formatOnSave": true
  },
  "palantirJavaFormat.enabled": true,
  "palantirJavaFormat.javaHome": "",
  "palantirJavaFormat.jvmArgs": []
}
```

Java is selected in the following order:

1. `palantirJavaFormat.javaHome`;
2. `JAVA_HOME`;
3. `java` (`java.exe` on Windows) from `PATH`.

`javaHome` must point to the JDK root, not the Java executable. The JDK version
is checked before the worker starts. Each `jvmArgs` entry is passed as a
separate argument.

## Commands

The following commands are available from the Command Palette:

- **Palantir Java Format: Restart Worker**;
- **Palantir Java Format: Show Output**;
- **Palantir Java Format: Show Version**.

## Troubleshooting

Extension diagnostics and worker error output are available under
**Output > Palantir Java Format**.

If formatting fails:

1. verify that JDK 17 or later is available;
2. check `palantirJavaFormat.javaHome`, `JAVA_HOME`, and `PATH`;
3. run **Palantir Java Format: Restart Worker**;
4. inspect the output channel.

After a crash, pending requests are rejected and the extension attempts up to
three automatic restarts with backoff.

Bugs and feature requests are tracked in
[GitHub Issues](https://github.com/Lucas-Fle/palantir-java-format-vscode/issues).
When reporting a problem, include the extension, VS Code, and JDK versions, the
operating system, the relevant `palantirJavaFormat` settings, and applicable
logs.

## Privacy and security

Documents are sent only to the local Java worker through `stdin` and `stdout`.
No network port is opened and no network request is made while formatting. The
extension does not log document contents.

Do not include confidential source code, tokens, or personal data in a public
report. Report vulnerabilities according to the
[security policy](SECURITY.md).

## Architecture

```text
VS Code / TypeScript
    │ JSONL v1 over stdin/stdout
    ▼
persistent Java worker
    │ ServiceLoader<FormatterService>
    ▼
Palantir Java Format 2.91.0
```

- `extension/` contains the VS Code provider, protocol client, and process
  lifecycle management;
- `worker/` contains the Java 17 Maven project that produces the executable
  JAR;
- `protocol/protocol.schema.json` describes the messages;
- `scripts/` automates builds, version checks, and VSIX packaging.

The worker starts on the first formatting request, remains active between
documents, and stops with the extension.

## Development

The development environment requires Node.js 22, JDK 17 or later, and Git.

Install the dependencies and run the complete verification:

```shell
npm ci
npm run package
```

This command:

1. builds and tests the worker using the Maven Wrapper;
2. runs the JAR and verifies the advertised Palantir version;
3. rejects a missing JAR or one older than its sources;
4. runs linting, type checking, TypeScript tests, and VS Code tests;
5. creates `artifacts/palantir-java-format-<version>.vsix`;
6. verifies that the worker and legal notices are present in the VSIX.

On Linux without a graphical session:

```shell
xvfb-run -a npm run package
```

The Maven Wrapper uses Maven 3.9.11; no system-wide Maven installation is
required:

```shell
cd worker
./mvnw clean package
```

On Windows:

```powershell
cd worker
.\mvnw.cmd clean package
```

To test the extension with `F5`, run `npm ci`, then use the **Run Extension**
configuration. The **Build for F5** task builds the worker and extension before
opening the Extension Development Host.

Contribution guidelines are available in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Protocol

Each exchanged line is a UTF-8 JSON object. Protocol v1 supports the
`initialize`, `formatDocument`, and `shutdown` methods. Every request has a
unique identifier, and errors use stable codes. `stdout` is reserved for the
protocol; worker logs are written to `stderr`.

See [protocol/protocol.schema.json](protocol/protocol.schema.json).

## License and attribution

This project is distributed under the
[Apache License 2.0](LICENSE). Licenses and attribution for bundled components
are documented in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and
preserved in distributed artifacts.
