import { headers } from "next/headers";
import { canonicalUrl } from "../lib/public-site";

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
    url: canonicalUrl(),
    logo: canonicalUrl("/lokd-logo.png"),
    description: "An employer-led South African security service building verified officers, controlled operations and auditable service delivery.",
    areaServed: { "@type": "AdministrativeArea", name: "Gauteng, South Africa" },
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
    serviceType: "Scheduled Unarmed fixed-site security guarding",
    areaServed: { "@type": "City", name: "Johannesburg" },
    provider: { "@id": canonicalUrl("/#organization") },
  }) }} />;
}
