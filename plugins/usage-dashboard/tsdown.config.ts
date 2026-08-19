/**
 * Plugin build config.
 *
 * Reuses the repository's own UI-plugin client preset (`clientBundle`) so this
 * out-of-tree package builds exactly like an in-tree client plugin:
 *   - the host node-half (`src/index.ts` → `lib/index.js`) is externalized
 *     against the framework modules the dsh host provides;
 *   - the browser client (`src/client/index.ts` → `lib/client.js`) is emitted
 *     as a `window.__ModuleLoader__.load({ id, factory })` closure bundle, with
 *     CSS Modules compiled by lightningcss into auto-injected
 *     `<style data-plugin="...">` tags.
 *
 * `clientBundle` lives in-tree; importing it (not modifying it) keeps this
 * plugin zero-touch on existing code.
 */
import { clientBundle } from '../../packages/client/tsdown.client.ts'

// The host node-half is pre-compiled by `tsc -p tsconfig.build.json` into
// `lib/types/index.js` (standard TC39 decorators downlevel to `__esDecorate`;
// tsdown/oxc only downlevels the legacy form). Bundling the compiled output —
// exactly the in-tree `lib/types/*.js` entry convention — keeps the host half
// valid ESM with the framework externals intact.
export default clientBundle('dsh-usage-dashboard', ['lib/types/index.js', 'lib/types/startup.js'])
