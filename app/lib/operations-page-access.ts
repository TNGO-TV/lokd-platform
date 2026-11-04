import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { operationsAccess } from './operations-access';
import { SignupError } from './signup-server';

export async function requireOperationsPage(returnTo: string, allowMfaRefresh = false) {
  const requestHeaders = new Headers(await headers());
  if (!requestHeaders.get('x-lokd-verified-user-id')) redirect('/sign-in?return_to=' + encodeURIComponent(returnTo));
  if (!env.DB) throw new SignupError('Operations storage is unavailable. Contact your administrator.', 503);
  try { return await operationsAccess(env.DB, requestHeaders, allowMfaRefresh); }
  catch (error) {
    if (!allowMfaRefresh && error instanceof SignupError && error.message.startsWith('Verify your second factor')) redirect('/ops/security');
    throw error;
  }
}
