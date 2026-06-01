import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

const rawVersion = process.argv[2]
const outputPath = process.argv[3] || 'release-notes.md'

if (!rawVersion) {
  throw new Error('Usage: node scripts/extract-release-notes.mjs <version-or-tag> [output-path]')
}

if (existsSync(outputPath)) {
  unlinkSync(outputPath)
}

const version = rawVersion.replace(/^v/, '')
const changelog = readFileSync('CHANGELOG.md', 'utf8')
const lines = changelog.split(/\r?\n/)
const headingPattern = new RegExp(
  `^## \\[?${version.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\]?\\b`
)
const headingIndex = lines.findIndex((line) => headingPattern.test(line))

if (headingIndex === -1) {
  console.log(
    `No curated CHANGELOG.md section found for ${version}; using generated GitHub notes only.`
  )
  process.exit(0)
}

const nextHeadingIndex = lines.findIndex(
  (line, index) => index > headingIndex && /^##\s+/.test(line)
)
const notes = lines
  .slice(headingIndex + 1, nextHeadingIndex === -1 ? undefined : nextHeadingIndex)
  .join('\n')
  .trim()

if (!notes) {
  console.log(`CHANGELOG.md section for ${version} is empty; using generated GitHub notes only.`)
  process.exit(0)
}

writeFileSync(outputPath, `## SellerFlow v${version}\n\n${notes}\n`)
console.log(`Wrote curated release notes for ${version} to ${outputPath}.`)
