export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return {
      url: "data:text/javascript,export%20const%20env%20%3D%20%7B%7D%3B",
      shortCircuit: true,
    };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code === "ERR_MODULE_NOT_FOUND"
      && (specifier.startsWith("./") || specifier.startsWith("../"))
      && !specifier.match(/\.[a-z0-9]+$/i)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}
