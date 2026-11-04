import { headers } from "next/headers";
import { canonicalUrl, COMPANY_NAME, BOOKINGS_EMAIL } from "../lib/public-site";

function json(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export async function OrganisationJsonLd() {
  const nonce = (await headers()).get("x-lokd-script-nonce") ?? undefined;
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": canonicalUrl("/#organization"),
    name: "LOKD",
    legalName: COMPANY_NAME,
    email: BOOKINGS_EMAIL,
    url: canonicalUrl(),
    logo: canonicalUrl("/lokd-logo.svg"),
    description: "On-demand security officers for shifts, events and ongoing cover in Johannesburg, South Africa.",
    areaServed: { "@type": "City", name: "Johannesburg", containedInPlace: { "@type": "Country", name: "South Africa" } },
  }) }} />;
}

export async function ServiceJsonLd({ name, description, path }: { name: string; description: string; path: string }) {
  const nonce = (await headers()).get("x-lokd-script-nonce") ?? undefined;
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${canonicalUrl(path)}#service`,
    name,
    description,
    url: canonicalUrl(path),
    serviceType: "SecurityService",
    areaServed: { "@type": "City", name: "Johannesburg", containedInPlace: { "@type": "Country", name: "South Africa" } },
    provider: { "@id": canonicalUrl("/#organization") },
  }) }} />;
}
