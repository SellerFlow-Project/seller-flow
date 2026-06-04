Place Mihomo Core binaries in the platform-specific folders below.

Development and packaged builds both resolve the bundled core from this tree when
the settings field "Mihomo Core path" is empty.

Expected files:

- `darwin-arm64/mihomo` for macOS Apple Silicon
- `darwin-x64/mihomo` for macOS Intel
- `win32-x64/mihomo.exe` for Windows x64
- `win32-arm64/mihomo.exe` for Windows arm64
- `linux-x64/mihomo` for Linux x64

The binaries are copied into packaged apps through `electron-builder.yml`
`extraResources`, and remain outside ASAR so they can be spawned by Electron.
