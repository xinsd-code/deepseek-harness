/** Register the Electron carrier before the shared Client plugin graph starts. */

import { registerClientCarrier } from '@deepseek-ai/dsh-client-connection/client'
import { createElectronCarrier } from './electron-carrier.ts'

const carrier = createElectronCarrier()
if (carrier === undefined) throw new Error('dsh-desktop: preload did not expose window.__DSH_ELECTRON__')
registerClientCarrier(carrier)
