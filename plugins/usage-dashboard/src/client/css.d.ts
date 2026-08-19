/**
 * Ambient declarations for CSS Module imports.
 *
 * The dsh web client (Vite) rewrites `import styles from './x.module.css'`
 * into a record of hashed class names; this mirrors that shape for tsc.
 * Without it, `*.css` imports fail to resolve during a standalone typecheck.
 */
declare module '*.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
