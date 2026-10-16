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
    address: { "@type": "PostalAddress", streetAddress: "71 Louis Trichardt Street", addressLocality: "Pretoria", postalCode: "0002", addressCountry: "ZA" },
    sameAs: ["https://www.facebook.com/lokdsecurity/", "https://www.youtube.com/@lokdsecurity", "https://www.instagram.com/lokdsecurity/"],
    url: canonicalUrl(),
    logo: canonicalUrl("/lokd-logo.png"),
    description: "South African security services with officer application review, controlled operations and auditable service delivery.",
    areaServed: { "@type": "Country", name: "South Africa" },
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
    serviceType: name,
    areaServed: path === "/locations/johannesburg" ? { "@type": "City", name: "Johannesburg" } : { "@type": "Country", name: "South Africa" },
    provider: { "@id": canonicalUrl("/#organization") },
  }) }} />;
}
