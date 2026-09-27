import type { ReactNode } from "react";
import Link from "next/link";
import { PublicFooter, PublicHeader, PublicLaunchBar } from "./public-site-shell";

export const LEGAL_OPERATOR = "The Tactical Nation, Inc";
export const LEGAL_NOTICES_EMAIL = "alerts@thetacticalnation.com";
export const LEGAL_EFFECTIVE_LABEL = "27 September 2026";

export function LegalDefs({ caption, rows }: { caption: string; rows: Array<[string, string]> }) {
  return (
    <table className="legal-defs">
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([term, meaning]) => (
          <tr key={term}>
            <th scope="row">{term}</th>
            <td>{meaning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalDocument({
  kicker,
  title,
  lede,
  asideNote,
  links,
  sections,
}: {
  kicker: string;
  title: string;
  lede: string;
  asideNote: string;
  links: Array<{ href: string; label: string }>;
  sections: Array<{ title: string; body: ReactNode }>;
}) {
  return (
    <main className="public-home marketing-page">
      <PublicLaunchBar />
      <PublicHeader active="about" />
      <section className="legal-hero">
        <p className="public-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{lede}</p>
        <span>Effective {LEGAL_EFFECTIVE_LABEL} · Not legal advice</span>
      </section>
      <section className="legal-content">
        <aside>
          <strong>{LEGAL_OPERATOR}</strong>
          <p>LOKD Security</p>
          <a href={`mailto:${LEGAL_NOTICES_EMAIL}`}>{LEGAL_NOTICES_EMAIL}</a>
          <p>{asideNote}</p>
          <nav aria-label="Related legal documents">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
          </nav>
        </aside>
        <div>
          {sections.map((section, index) => (
            <section key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.title}</h2>
                <div className="legal-prose">{section.body}</div>
              </div>
            </section>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
