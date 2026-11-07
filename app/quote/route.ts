/** Keep existing links and homepage booking shortcuts as an HTTP permanent redirect. */
export function GET(request: Request) {
  const destination = new URL(request.url);
  destination.pathname = "/book";
  return new Response(null, { status: 308, headers: { location: destination.toString() } });
}

export const HEAD = GET;
