export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
};

export async function GET() {
  return Response.json(
    {
      status: "live",
      service: "lokd-security",
      checkedAt: new Date().toISOString(),
    },
    { status: 200, headers },
  );
}
