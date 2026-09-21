import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type LokdUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "x-lokd-verified-email";
const USER_FULL_NAME_HEADER = "x-lokd-verified-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "x-lokd-verified-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/sign-in";
const SIGN_OUT_PATH = "/sign-out";
const CALLBACK_PATH = "/callback";

export async function getLokdUser(): Promise<LokdUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireLokdUser(
  returnTo: string,
): Promise<LokdUser> {
  const user = await getLokdUser();
  if (user) return user;

  redirect(lokdSignInPath(returnTo));
}

export function lokdSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function lokdSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
