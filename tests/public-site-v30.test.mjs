import assert from "node:assert/strict";
import test from "node:test";

import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";
import {
  canonicalUrl,
  isClientPortalHost,
  isOfficerPortalHost,
  isOperationsPortalHost,
  OFFICER_PORTAL_URL,
  PUBLIC_SITE_URL,
  PUBLIC_SITEMAP_PATHS,
  requestHostname,
  workspaceRedirectForHost,
  workspaceRoleForHost,
} from "../app/lib/public-site.ts";

test("public sitemap uses one canonical host and includes the launch search pages", () => {
  const entries = sitemap();
  assert.equal(entries.length, PUBLIC_SITEMAP_PATHS.length);
  assert.equal(new Set(entries.map((entry) => entry.url)).size, entries.length);
  for (const entry of entries) assert.equal(new URL(entry.url).origin, PUBLIC_SITE_URL);
  for (const path of ["/security-services", "/armed-security", "/vip-protection", "/industries", "/locations/johannesburg", "/clients", "/officers", "/contact"]) {
    assert.ok(entries.some((entry) => entry.url === canonicalUrl(path)), `${path} should be in the public sitemap`);
  }
});

test("robots keeps public client and officer content crawlable while excluding private surfaces", () => {
  const policy = robots();
  assert.equal(policy.sitemap, "https://lokd.co.za/sitemap.xml");
  const disallow = Array.isArray(policy.rules) ? policy.rules[0].disallow : policy.rules.disallow;
  assert.ok(Array.isArray(disallow));
  assert.ok(disallow.includes("/api/"));
  assert.ok(disallow.includes("/ops"));
  assert.equal(disallow.includes("/client"), false, "blocking /client also blocks the public /clients prefix");
  assert.equal(disallow.includes("/officer"), false, "blocking /officer also blocks the public /officers prefix");
});

test("custom host routing recognises all three strict authenticated workspaces", () => {
  assert.equal(requestHostname("PORTAL.LOKD.CO.ZA:443"), "portal.lokd.co.za");
  assert.equal(isClientPortalHost("portal.lokd.co.za"), true);
  assert.equal(isOfficerPortalHost("officers.lokd.co.za"), true);
  assert.equal(isOperationsPortalHost("operations.lokd.co.za"), true);
  assert.equal(workspaceRoleForHost("portal.lokd.co.za"), "client");
  assert.equal(workspaceRoleForHost("officers.lokd.co.za"), "officer");
  assert.equal(workspaceRoleForHost("operations.lokd.co.za"), "operations");
  assert.equal(isClientPortalHost("demo.lokd.co.za"), false);
  assert.equal(isOfficerPortalHost("demo.lokd.co.za"), false);
  assert.equal(isOperationsPortalHost("demo.lokd.co.za"), false);
});

test("known public and mismatched portal hosts route to the requested workspace", () => {
  assert.equal(workspaceRedirectForHost("lokd.co.za", "officer"), OFFICER_PORTAL_URL);
  assert.equal(workspaceRedirectForHost("portal.lokd.co.za", "officer"), OFFICER_PORTAL_URL);
  assert.equal(workspaceRedirectForHost("officers.lokd.co.za", "officer"), null);
  assert.equal(workspaceRedirectForHost("demo.lokd.co.za", "officer"), null);
  assert.equal(workspaceRedirectForHost("lokd-security.example.chatgpt.site", "officer"), null);
});
