// Node 24 runs .ts files by stripping their types, but it won't guess a missing ".ts" on an import.
// lib/ imports "./format" and "./logic" the bundler way, so add the extension when Node can't find the file.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !specifier.endsWith(".ts")) return next(`${specifier}.ts`, context);
    throw err;
  }
}
