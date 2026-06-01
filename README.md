# seller-flow

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Windows Releases

The packaged Windows application checks public GitHub Releases for updates. A pushed semantic
version tag builds the NSIS installer on GitHub Actions and publishes the installer, blockmap, and
`latest.yml` metadata to the matching Release.

Before publishing a release:

1. Update the version in `package.json` and `package-lock.json`.
2. Add a matching `## [x.y.z]` section to `CHANGELOG.md`.
3. Commit the release changes.
4. Create and push the matching tag, for example `git tag v0.1.1 && git push origin v0.1.1`.

The tag must exactly match the package version with a `v` prefix. Curated notes from `CHANGELOG.md`
are prepended to the automatically generated GitHub Release notes.

For trusted Windows installers, add the optional `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` GitHub
Actions secrets. `WIN_CSC_LINK` should contain the base64-encoded Windows code-signing certificate.
