# Binary triage: SpotifySetup.exe

Identify every opaque file: format, architecture, sections, entropy, and the strings that hint at what it does. Headers only; nothing is executed.

Clearbox 0.1.0 · 1 files read · 0.14s · ledger `01531f8d64b2c86a` · content `5e373fe6bd9c2905`

## What is in here?

_Which formats, and how much of the target is opaque?_

#### Shape of the target

- **Files:** 1 — 1.0 MB on disk
- **Lines of code:** 0 — across 0 source files
- **Test code:** 0% — 0 lines in test files
- **Languages:** 0 — none detected
- **Skipped:** 0 — symlinks, oversized, or special files

#### Opaque file formats  _(parsed)_

| Format | Files | Evidence |
|---|---|---|
| PE | 1 |  |

## Executables and archives

_Architecture, kind, entropy, and notable properties of each binary._

#### Binaries and opaque files  _(parsed)_

| File | Format | Arch | Kind | Bytes | Entropy | Notes | Evidence |
|---|---|---|---|---|---|---|---|
| SpotifySetup.exe | PE | x86-64 | executable | 1074664 | 6.25 | link timestamp 0x4554fa1e is not a plausible date (deterministic /Brepro build), MSVC Rich header present | `SpotifySetup.exe` |

> Entropy is bits per byte (0 to 8). Above 7.2 usually means compressed or encrypted content.

#### Windows executables: identity and signature  _(parsed)_

| File | Product | Company | Description | Subsystem | Authenticode | Hardening | Evidence |
|---|---|---|---|---|---|---|---|
| SpotifySetup.exe | Spotify 1.3.4.258.gc60b10b0946a | Spotify Ltd | Spotify Installer | Windows GUI | yes: CN=DigiCert Trusted Root G4; CN=DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1; CN=Spotify AB; CN=DigiCert Trusted G4 TimeStamping RSA4096 SHA256 2025 CA1 | high-entropy ASLR, ASLR, DEP/NX | `SpotifySetup.exe` |

> From the version resource, the certificate table, and DllCharacteristics. Signer names are read from the certificates; Clearbox does not validate the signature chain.

#### Section tables  _(parsed)_

| File | Sections | Evidence |
|---|---|---|
| SpotifySetup.exe | .text, .rdata, .data, .pdata, .fptable, .rsrc, .reloc | `SpotifySetup.exe` |

## What can it do?

_Which operating-system capabilities do the imported functions grant?_

#### What the imports let it do  _(parsed)_

| File | Capability | APIs | Imported functions | Evidence |
|---|---|---|---|---|
| SpotifySetup.exe | Start other programs | 2 | ShellExecuteW, CreateProcessW | `SpotifySetup.exe` |
| SpotifySetup.exe | Inspect or modify other processes | 2 | OpenProcessToken, OpenProcess | `SpotifySetup.exe` |
| SpotifySetup.exe | Load code at runtime | 4 | GetProcAddress, LoadLibraryExW, LoadLibraryExA, LoadLibraryW | `SpotifySetup.exe` |
| SpotifySetup.exe | Registry | 2 | RegSetValueExW, RegCreateKeyExW | `SpotifySetup.exe` |
| SpotifySetup.exe | Files and folders | 9 | SHGetFolderPathW, WriteFile, CreateFileW, CreateDirectoryW, DeleteFileW, MoveFileExW, CreateFileMappingA, CreateFileA, CopyFileW | `SpotifySetup.exe` |
| SpotifySetup.exe | Shortcuts and shell integration | 2 | SHChangeNotify, CoCreateInstance | `SpotifySetup.exe` |
| SpotifySetup.exe | Privileges and security | 2 | OpenProcessToken, GetTokenInformation | `SpotifySetup.exe` |
| SpotifySetup.exe | User interface | 4 | InitCommonControlsEx, MessageBoxW, CreateWindowExW, ShowWindow | `SpotifySetup.exe` |
| SpotifySetup.exe | Version checks | 1 | VerifyVersionInfoW | `SpotifySetup.exe` |
| SpotifySetup.exe | Scheduled tasks / COM automation | 1 | CoInitializeEx | `SpotifySetup.exe` |

> Derived from the import table. Functions resolved at runtime with GetProcAddress do not appear here.

#### Imported DLLs and functions  _(parsed)_

| File | DLL | Functions | Imports | Evidence |
|---|---|---|---|---|
| SpotifySetup.exe | COMCTL32.dll | 1 | InitCommonControlsEx | `SpotifySetup.exe` |
| SpotifySetup.exe | SHELL32.dll | 3 | SHGetFolderPathW, ShellExecuteW, SHChangeNotify | `SpotifySetup.exe` |
| SpotifySetup.exe | ADVAPI32.dll | 8 | GetNamedSecurityInfoW, RegSetValueExW, OpenProcessToken, GetTokenInformation, SetEntriesInAclW, SetNamedSecurityInfoW, ConvertStringSidToSidW, RegCreateKeyExW | `SpotifySetup.exe` |
| SpotifySetup.exe | KERNEL32.dll | 147 | QueryPerformanceCounter, GetCurrentProcessId, GetCurrentThreadId, GetSystemTimeAsFileTime, InitializeSListHead, RtlCaptureContext, RtlLookupFunctionEntry, RtlVirtualUnwind, IsDebuggerPresent, UnhandledExceptionFilter, SetUnhandledExceptionFilter, GetStartupInfoW, IsProcessorFeaturePresent, GetModuleHandleW … +133 | `SpotifySetup.exe` |
| SpotifySetup.exe | USER32.dll | 26 | LoadIconW, LoadCursorW, SetWindowLongW, GetWindowLongW, MessageBoxW, AdjustWindowRect, SetTimer, GetActiveWindow, GetDlgItem, GetDC, CreateWindowExW, RegisterClassExW, DefWindowProcW, PostMessageW … +12 | `SpotifySetup.exe` |
| SpotifySetup.exe | GDI32.dll | 2 | GetDeviceCaps, GetStockObject | `SpotifySetup.exe` |
| SpotifySetup.exe | ole32.dll | 2 | CoCreateInstance, CoInitializeEx | `SpotifySetup.exe` |
| SpotifySetup.exe | OLEAUT32.dll | 4 | #6, #200, #7, #201 | `SpotifySetup.exe` |

## Strings

_URLs, paths, libraries, and type names embedded in the binaries._

#### Meaningful strings inside binaries  _(pattern)_

| File | String | Count | Evidence |
|---|---|---|---|
| SpotifySetup.exe | Spotify.exe | 2 | `SpotifySetup.exe` |
| SpotifySetup.exe | Spotify_new.exe | 2 | `SpotifySetup.exe` |
| SpotifySetup.exe | http://ocsp.digicert.com0A | 2 | `SpotifySetup.exe` |
| SpotifySetup.exe | http://cacerts.digicert.com/DigiCertTrustedRootG4.crt0C | 2 | `SpotifySetup.exe` |
| SpotifySetup.exe | http://crl3.digicert.com/DigiCertTrustedRootG4.crl0 | 2 | `SpotifySetup.exe` |
| SpotifySetup.exe | https://www.spotify.com | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | uninstall.exe | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | d.exe | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | kernel32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | VERSION.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | WININET.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | api-ms-win-core-winrt-l1-1-0.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | api-ms-win-core-winrt-error-l1-1-1.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | RoOriginateLanguageException | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | COMCTL32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | SHELL32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | ADVAPI32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | GetLastError | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | SetLastError | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | KERNEL32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | USER32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | GDI32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | ole32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | OLEAUT32.dll | 1 | `SpotifySetup.exe` |
| SpotifySetup.exe | http://schemas.microsoft.com/SMI/2005/WindowsSettings">true</dpiAware> | 1 | `SpotifySetup.exe` |

_20 more rows in report.json._

> URLs, absolute paths, library names, and type-like identifiers. Strings are data from the target.

#### Readable UTF-16 strings  _(parsed)_

| File | Offset | String | Evidence |
|---|---|---|---|
| SpotifySetup.exe | 0x5a6d8 | api-ms-win-core-fibers-l1-1-1 | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5a718 | api-ms-win-core-synch-l1-2-0 | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5a758 | kernel32 | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5a770 | api-ms- | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5ab00 | mscoree.dll | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5ac40 | LC_ALL | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5ac50 | LC_COLLATE | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5ac68 | LC_CTYPE | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5ac80 | LC_MONETARY | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5ac98 | LC_NUMERIC | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5acb0 | LC_TIME | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b098 | (null) | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b6d0 | Sunday | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b6e0 | Monday | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b6f0 | Tuesday | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b700 | Wednesday | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b718 | Thursday | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b730 | Friday | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b740 | Saturday | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b7b8 | January | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b7c8 | February | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b7e0 | March | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b7f0 | April | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b820 | August | `SpotifySetup.exe` |
| SpotifySetup.exe | 0x5b830 | September | `SpotifySetup.exe` |

_188 more rows in report.json._

> Windows programs store user-facing text, object names, and identifiers as UTF-16. Mostly-letter strings only; offsets are file offsets.

## Blind spots

- Binary triage reads headers and strings only. Control flow, decompilation, and runtime behavior need a disassembler (Ghidra, IDA, Hopper) in an isolated environment.

## Safety contract

- Read-only: target files are opened O_RDONLY and never modified.
- No execution: nothing from the target is run, imported, or evaluated. Python is parsed with ast.parse.
- No network: Clearbox has no networking code; it analyzes a local directory only.
- Jailed: paths that resolve outside the target are refused; symlinks are not followed.
- Bounded: file count, per-file size, and total bytes read are capped.
- Redacted: secret values are masked and fingerprinted before they reach a report.
- Accountable: every file read is listed in the ledger with its SHA-256.
