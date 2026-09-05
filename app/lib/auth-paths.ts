// Return paths never leave the current origin or re-enter an auth endpoint.
export function safeAuthReturnPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || /^\/(sign-in|sign-up|sign-out|__clerk|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export function lokdSignInPath(returnTo = "/account") {
  return `/sign-in?return_to=${encodeURIComponent(safeAuthReturnPath(returnTo))}`;
}
