/** Carrier-neutral Cordis startup barrier for the client module registry. */

import { Service, type Context } from '@deepseek-ai/cordis'

declare const process: { versions: Readonly<Record<string, string | undefined>> }

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Usage-dashboard's Web/Electron carrier startup barrier. */
    usageDashboardCarrierReady: UsageDashboardCarrierReady
  }
}

/** Whether the current Node runtime is Electron's main process. */
export function isElectronRuntime(versions: Readonly<Record<string, string | undefined>>): boolean {
  return typeof versions.electron === 'string'
}

/** Readiness marker consumed only by the composed client module row. */
export class UsageDashboardCarrierReady extends Service {
  /** Register the marker in the owning plugin fiber. */
  constructor(ctx: Context) {
    super(ctx, 'usageDashboardCarrierReady')
  }
}

/**
 * Provide readiness immediately for Electron or after WebServer activation for
 * the browser carrier.
 */
export function apply(ctx: Context): void {
  if (isElectronRuntime(process.versions)) {
    new UsageDashboardCarrierReady(ctx)
    return
  }
  const web = ctx.inject(['webServer'], (webCtx) => {
    new UsageDashboardCarrierReady(webCtx)
  })
  ctx.effect(() => () => web.dispose(), 'usage-dashboard: carrier startup barrier')
}

export default { apply }
