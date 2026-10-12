// Module hooks for scripts/coplanar.mjs: keeps every model part a separate mesh (finalizeModel
// would merge them per material), so a flickering pair can be named by its parts.
export async function load(url, context, next) {
  if (url.endsWith('/models/lib/merge.js')) {
    return { format: 'module', shortCircuit: true, source: 'export function finalizeModel(root) { return root; }' };
  }
  return next(url, context);
}
