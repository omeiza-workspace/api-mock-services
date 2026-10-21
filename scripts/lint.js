#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

/**
 * The lint.
 *
 * There are no dependencies in this project, so there is no eslint here.
 * What there is instead: every JavaScript file is parsed by Node itself, and
 * every file is checked for the house style — no semicolon at the end of a
 * line, no trailing whitespace, and a newline at the end of the file.
 *
 *   node scripts/lint.js
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SKIP = new Set(['node_modules', '.git', '.act-artifacts', 'dist', 'build'])

/** The files that are linted. */
async function collect(directory) {
  const found = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue

    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      found.push(...(await collect(path)))
      continue
    }

    if (entry.name.endsWith('.js')) found.push(path)
  }

  return found
}

const problems = []

for (const path of await collect(ROOT)) {
  const name = relative(ROOT, path)
  const source = await readFile(path, 'utf8')

  // Node parses it. A syntax error is a lint error.
  try {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' })
  } catch (error) {
    problems.push(`${name}: ${String(error.stderr ?? error.message).split('\n')[2]?.trim()}`)
    continue
  }

  source.split('\n').forEach((line, index) => {
    const trimmed = line.trim()

    if (/\s+$/.test(line)) {
      problems.push(`${name}:${index + 1}: trailing whitespace`)
    }

    // A semicolon at the end of a line — the house style is without one.
    // A `for` statement is the exception: it needs them.
    if (/;$/.test(trimmed) && !trimmed.startsWith('for ')) {
      problems.push(`${name}:${index + 1}: a semicolon at the end of the line`)
    }
  })

  if (!source.endsWith('\n')) {
    problems.push(`${name}: no newline at the end of the file`)
  }
}

if (problems.length) {
  console.error(`\n[lint] ${problems.length} problem(s):\n`)

  for (const problem of problems) {
    console.error(`  ${problem}`)
  }

  process.exit(1)
}

console.log('[lint] clean')
