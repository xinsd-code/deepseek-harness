/** Stage a portable pnpm production tree before invoking Electron Forge. */

import { cp, mkdir, mkdtemp, opendir, readFile, realpath, rm, rename, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const command = process.argv[2]
if (command !== 'package' && command !== 'make') {
  throw new Error('usage: node scripts/forge.mjs <package|make>')
}

const appRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(appRoot, '..', '..')
const staging = await mkdtemp(join(tmpdir(), 'dsh-electron-forge-'))
const output = resolve(appRoot, 'out')
const registry = process.env.DSH_NPM_REGISTRY ?? 'https://registry.npmjs.org'
const deployArgs = [
  `--registry=${registry}`,
  '--filter', '@deepseek-ai/dsh-desktop',
  'deploy', '--prod', '--legacy', staging,
]
if (process.env.DSH_PNPM_OFFLINE === '1') deployArgs.splice(1, 0, '--offline')
const restoreArgs = [`--registry=${registry}`, 'install', '--frozen-lockfile']
if (process.env.DSH_PNPM_OFFLINE === '1') restoreArgs.splice(1, 0, '--offline')

try {
  run('pnpm', deployArgs, appRoot)
  await writeFile(resolve(staging, 'pnpm-workspace.yaml'), "packages:\n  - '.'\nhoistPattern:\n  - '*'\n")
  await repairDeployLinks(staging)
  await exposeWorkspaceRuntime(staging)
  await cp(resolve(appRoot, 'assets'), resolve(staging, 'assets'), { recursive: true })
  await cp(resolve(appRoot, 'forge.config.ts'), resolve(staging, 'forge.config.ts'))
  await cp(resolve(appRoot, '..', 'web', 'dist'), resolve(staging, 'web-dist'), { recursive: true })
  await cp(resolve(appRoot, '..', 'cli', 'config', 'agent-presets'), resolve(staging, 'config', 'agent-presets'), { recursive: true })
  const electronPackage = await realpath(resolve(appRoot, 'node_modules', 'electron'))
  await symlink(electronPackage, resolve(staging, 'node_modules', 'electron'), 'dir')
  const forge = resolve(appRoot, 'node_modules', '.bin', 'electron-forge')
  run(forge, ['package', '--platform=darwin', `--arch=${process.arch}`], staging)
  await addPortableBootstrap(staging)
  run('codesign', ['--force', '--deep', '--sign', '-', packagedApplication(staging)], appRoot)
  if (command === 'make') {
    run(forge, ['make', '--skip-package', '--platform=darwin', `--arch=${process.arch}`], staging)
  }
  await rm(output, { recursive: true, force: true })
  await rename(resolve(staging, 'out'), output)
} finally {
  try {
    await rm(staging, { recursive: true, force: true })
  } finally {
    // Legacy production deploy records the shared install as production-only.
    run('pnpm', restoreArgs, workspaceRoot)
  }
}

/** Replace deploy-time workspace overrides and discard unavailable optional-platform links. */
async function repairDeployLinks(deployRoot) {
  const canonicalRoot = await realpath(deployRoot)
  const replacements = new Map()
  const vendoredRoot = resolve(deployRoot, 'node_modules', '.dsh-vendor')
  for (const name of ['cosmokit', 'schemastery']) {
    const target = resolve(vendoredRoot, name)
    await cp(resolve(appRoot, '..', '..', 'vendor', name), target, { recursive: true })
    replacements.set(name, target)
  }
  let materialized = true
  while (materialized) {
    materialized = false
    for await (const path of symlinksUnder(resolve(deployRoot, 'node_modules'))) {
      let target
      try {
        target = await realpath(path)
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
        const name = basename(path)
        const replacement = replacements.get(name)
        await rm(path)
        if (replacement !== undefined) {
          await symlink(relative(dirname(path), replacement), path, 'dir')
        } else if (name !== 'dsh-desktop' && !name.startsWith('node-addon-landlock-run-linux-')) {
          throw new Error(`unexpected broken deploy link: ${path}`)
        }
        continue
      }
      if (target === canonicalRoot || target.startsWith(`${canonicalRoot}${sep}`)) continue
      await rm(path)
      await copyPublishedPackage(target, path)
      materialized = true
    }
  }
}

/** Materialize one workspace package using the files its manifest publishes. */
async function copyPublishedPackage(source, destination) {
  let manifest
  try {
    manifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOTDIR') throw error
    await cp(source, destination)
    return
  }
  if (!Array.isArray(manifest.files)) throw new Error(`workspace package declares no files list: ${source}`)
  await mkdir(destination, { recursive: true })
  await cp(resolve(source, 'package.json'), resolve(destination, 'package.json'))
  const roots = new Set(manifest.files.map(entry => {
    const normalized = String(entry).replace(/^\.\//, '')
    const wildcard = normalized.search(/[?*\[{]/)
    if (wildcard < 0) return normalized.replace(/\/$/, '')
    const prefix = normalized.slice(0, wildcard)
    const slash = prefix.lastIndexOf('/')
    return (slash < 0 ? '' : prefix.slice(0, slash)).replace(/\/$/, '')
  }).filter(Boolean))
  for (const entry of roots) {
    const target = resolve(destination, entry)
    await mkdir(dirname(target), { recursive: true })
    await cp(resolve(source, entry), target, { recursive: true })
  }
}

/** Restore the workspace peer set that the source installation hoists for runtime packages. */
async function exposeWorkspaceRuntime(deployRoot) {
  const canonicalRoot = await realpath(deployRoot)
  const workspaceRoot = resolve(appRoot, '..', '..')
  const packageDirs = [
    ...await childPackageDirs(resolve(workspaceRoot, 'vendor'), 1),
    ...await childPackageDirs(resolve(workspaceRoot, 'packages'), 2),
  ]
  for (const source of packageDirs) {
    const manifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
    if (typeof manifest.name !== 'string' || !manifest.name.startsWith('@deepseek-ai/')) continue
    const destination = resolve(canonicalRoot, 'node_modules', manifest.name)
    try {
      await realpath(destination)
      continue
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    }
    await copyPublishedPackage(source, destination)
  }
  await exposeHoistedEntries(
    resolve(canonicalRoot, 'node_modules', '.pnpm', 'node_modules'),
    resolve(canonicalRoot, 'node_modules'),
  )
}

/** Return package directories exactly at `depth` below one workspace root. */
async function childPackageDirs(root, depth) {
  if (depth === 0) return [root]
  const children = []
  for await (const entry of await opendir(root)) {
    if (entry.isDirectory()) children.push(...await childPackageDirs(resolve(root, entry.name), depth - 1))
  }
  return children
}

/** Link pnpm's hoisted external entries into the deploy root without replacing direct packages. */
async function exposeHoistedEntries(sourceRoot, destinationRoot) {
  for await (const entry of await opendir(sourceRoot)) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const source = resolve(sourceRoot, entry.name)
    const destination = resolve(destinationRoot, entry.name)
    if (entry.name.startsWith('@')) {
      await mkdir(destination, { recursive: true })
      await exposeHoistedEntries(source, destination)
      continue
    }
    try {
      await realpath(destination)
      continue
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    }
    await symlink(relative(dirname(destination), source), destination, 'dir')
  }
}

/** Add a tiny ASAR launcher while keeping the portable pnpm tree as loose resources. */
async function addPortableBootstrap(deployRoot) {
  const store = resolve(appRoot, '..', '..', 'node_modules', '.pnpm')
  let asarBin
  for await (const entry of await opendir(store)) {
    if (entry.isDirectory() && entry.name.startsWith('@electron+asar@')) {
      asarBin = resolve(store, entry.name, 'node_modules', '@electron', 'asar', 'bin', 'asar.js')
      break
    }
  }
  if (asarBin === undefined) throw new Error('cannot locate the Electron ASAR packer')
  const resources = resolve(packagedApplication(deployRoot), 'Contents', 'Resources')
  run(process.execPath, [
    asarBin,
    'pack',
    resolve(appRoot, 'bootstrap'),
    resolve(resources, 'app.asar'),
  ], appRoot)
}

/** Return the Forge application bundle produced for the current host architecture. */
function packagedApplication(deployRoot) {
  return resolve(
    deployRoot,
    'out',
    `DeepSeek Harness-darwin-${process.arch}`,
    'DeepSeek Harness.app',
  )
}

/** Walk a directory tree without following symbolic links. */
async function* symlinksUnder(root) {
  const directory = await opendir(root)
  for await (const entry of directory) {
    const path = resolve(root, entry.name)
    if (entry.isSymbolicLink()) yield path
    else if (entry.isDirectory()) yield* symlinksUnder(path)
  }
}

/** Run one packaging subprocess and preserve its exit status and output. */
function run(executable, args, cwd) {
  const result = spawnSync(executable, args, {
    cwd,
    env: { ...process.env, CI: process.env.CI ?? 'true' },
    stdio: 'inherit',
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`${executable} exited with status ${result.status ?? 'unknown'}`)
  }
}
