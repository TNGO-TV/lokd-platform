import assert from "node:assert/strict";
import test from "node:test";

const context = { waitUntil() {}, passThroughOnException() {} };
const environment = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
function withoutScripts(markup) {
  // Test-only text extraction from our own rendered HTML: drop everything from each <script to the next </script.
  const lower = markup.toLowerCase();
  let text = "";
  let index = 0;
  for (;;) {
    const start = lower.indexOf("<script", index);
    if (start === -1) return text + markup.slice(index);
    text += markup.slice(index, start) + " ";
    const end = lower.indexOf("</script", start);
    if (end === -1) return text;
    const close = lower.indexOf(">", end);
    if (close === -1) return text;
    index = close + 1;
  }
}
async function renderPublicPage(path = "/") {
  const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url).href);
  const response = await worker.fetch(new Request("http://localhost" + path, { headers: { accept: "text/html" } }), environment, context);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  // Streaming SSR sends the loading boundary before the completed page.
  const main = [...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)].findLast(([, content]) => /<h1\b/.test(content))?.[1] ?? "";
  assert.ok(main, path + " must include the completed server-rendered page");
  const visible = withoutScripts(main).replace(/<[^>]*>/g, " ").replace(/[<>]/g, " ").replace(/\s+/g, " ");
  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(([, attributes, content]) => ({
    href: attributes.match(/\bhref="([^"]*)"/i)?.[1]?.replace(/&amp;/g, "&"),
    text: content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  }));
  return {html, main, visible, links};
}
function hasLink(links, href, label) {
  assert.ok(links.some(link => link.href === href && link.text.startsWith(label)), label + " must link to " + href);
}
function professionalCopy(visible) {
  assert.doesNotMatch(visible, /\b(?:demo|sample|placeholder|prelaunch|pilot|coming soon|lorem ipsum)\b/i);
  assert.doesNotMatch(visible, /\b(?:R\s?\d[\d,.]*|ZAR\s?\d|arrives? in \d+|within \d+ minutes?|\d+\s*(?:min|minutes?|hours?) away)\b/i);
  assert.doesNotMatch(visible, /Thabo Mokoena|Rosebank office park|31 Mar 2027|contracted rate|dispatch premium/i);
}

test("homepage renders all three LOKD pillars with real booking, training and officer paths", async () => {
  const {html, main, visible, links} = await renderPublicPage();
  assert.match(html, /<title>Security on your terms \| LOKD<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/lokd\.co\.za\/?"\/>/i);
  assert.match(visible, /Book officers\.\s*On your terms\./);
  assert.match(visible, /today, tomorrow or ongoing cover/i);
  assert.match(visible, /LOKD Flex/); assert.match(visible, /LOKD Fixed/); assert.match(visible, /LOKD Training/);
  assert.match(visible, /certified training provider/i);
  assert.match(visible, /Training is a paid service/);
  for (const title of ["Entry-level training", "Grade upgrades", "Firearms training", "VIP protection"]) assert.ok(visible.includes(title), title);
  assert.match(visible, /closest available pool/); assert.match(visible, /Arrival time depends on your location/);
  for (const [href,label] of [
    ["/book","Book officers"], ["/book?when=ongoing","Ongoing cover"],
    ["/book?when=today","Today"], ["/book?when=tomorrow","Tomorrow"],
    ["/book?service=scheduled_unarmed_fixed_site","Unarmed guarding"],
    ["/book?service=armed_static","Armed security"], ["/book?service=vip_unarmed","VIP protection"],
    ["/training","Explore LOKD Training"], ["/verify","Verify a Passport"],
    ["/officers","PSIRA Registered or renewal"], ["/officers","New Application"],
    ["/sign-in?return_to=%2Fclient","Client Zone"], ["/sign-in?return_to=%2Fofficer","Officer Zone"],
    ["/sign-in?return_to=%2Fops","Operations Zone"], ["/privacy","Privacy"], ["/terms","Terms and conditions"],
  ]) hasLink(links, href, label);
  const sections = ["booking-models-title","services-title","passport-title","training-title","officer-paths-title","closing-title"];
  for (let i=1;i<sections.length;i++) assert.ok(main.indexOf('id="'+sections[i]+'"') > main.indexOf('id="'+sections[i-1]+'"'), "homepage section order");
  assert.doesNotMatch(main, /✓|<img[^>]*src="(?!\/(?:brand\/lokd-mark\.svg|lokd-logo[^"]*))/);
  professionalCopy(visible);
});

for (const [path, service, grade, qualification] of [
  ["/security-services","scheduled_unarmed_fixed_site","C","Assignment readiness"],
  ["/armed-security","armed_static","B","Firearm competency"],
  ["/vip-protection","vip_unarmed","B","Close-protection qualifications"],
]) test(path + " renders the correct grade, role requirements and prefilled booking CTA", async () => {
  const {html,visible,links} = await renderPublicPage(path);
  assert.match(html, new RegExp('href="https://lokd\\.co\\.za'+path+'"'));
  assert.ok(visible.includes("PSIRA grade "+grade+" minimum"));
  assert.ok(visible.includes(qualification)); assert.ok(visible.includes("LOKD Flex")); assert.ok(visible.includes("LOKD Fixed"));
  assert.match(visible, /ongoing contract cover/i); assert.match(visible, /Identity and Passport/);
  assert.ok(links.some(link => link.href === "/book?service="+service && link.text.startsWith("Book ")));
  professionalCopy(visible);
});

for (const path of ["/industries","/locations/johannesburg","/about","/contact"]) test(path + " renders a professional product page with shared navigation and booking paths", async () => {
  const {html,visible,links} = await renderPublicPage(path);
  assert.match(html, /<h1\b/);
  for (const [href,label] of [["/book","Book"],["/security-services","Security services"],["/clients","For clients"],["/officers","For officers"],["/training","Training"],["/about","About"],["/contact","Contact"],["/sign-in","Zone"]]) hasLink(links,href,label);
  hasLink(links,"/book?when=ongoing","Ongoing cover");
  if (path === "/contact") { assert.match(html, /<form\b/); assert.match(html, /name="privacyConsent"/); }
  if (path === "/about") { assert.match(visible, /certified training provider/); assert.match(visible, /Training is a paid service/); }
  professionalCopy(visible);
});

test('built Worker rejects rehearsal paths and router aliases on production despite forged test host headers',async()=>{
 const {default:worker}=await import(new URL('../dist/server/index.js',import.meta.url).href);
 let touched=0;
 const environment={LOKD_APP_STAGE:'demo',LOKD_TEST_SURFACES_ENABLED:'true',DB:{prepare(){touched++;throw Error('Primary database must not be touched');}},ASSETS:{fetch:async()=>new Response('not found',{status:404})}};
 const context={waitUntil(){},passThroughOnException(){}};
 for(const path of ['/api/pilot','/api/pilot/','/api/%70ilot','/api/platform/export/file','/api/sandbox/identity','/api/agreements/test','/api/test-cycle','/api/paystack/test/webhook']){
  const response=await worker.fetch(new Request('https://operations.lokd.co.za'+path,{headers:{host:'demo.lokd.co.za','x-forwarded-host':'demo.lokd.co.za','x-lokd-verified-email':'owner@example.test'}}),environment,context);
  assert.ok([404,405].includes(response.status),path+': '+response.status);
 }
 for(const path of ['/api/operations','/api/platform/export?run=private','/api/finance-workflows','/api/specialist']){
  const response=await worker.fetch(new Request('https://operations.lokd.co.za'+path,{headers:{'x-lokd-verified-user-id':'forged','x-lokd-verified-email':'owner@example.test'}}),environment,context);
  assert.ok([401,503].includes(response.status),path+': '+response.status);
 }
 const webhook=await worker.fetch(new Request('https://operations.lokd.co.za/api/finance-workflows/webhook',{method:'POST',body:'{}'}),environment,context);
 assert.equal(webhook.status,503,'Disconnected payment webhook must refuse events before any database or provider work.');
 assert.equal(touched,0);
});

test("built Worker HTML nonces every executable bootstrap script and replaces attacker CSP", async () => {
  const {default: worker}=await import(new URL('../dist/server/index.js',import.meta.url).href);
  const environment={ASSETS:{fetch:async()=>new Response('not found',{status:404})}},context={waitUntil(){},passThroughOnException(){}};
  const request=()=>new Request('https://lokd.example/',{headers:{accept:'text/html','content-security-policy':"script-src 'nonce-attacker'",'x-lokd-script-nonce':'attacker'}});
  const first=await worker.fetch(request(),environment,context),second=await worker.fetch(request(),environment,context);
  assert.equal(first.status,200);assert.equal(second.status,200);
  const policy=first.headers.get('content-security-policy');
  const nonce=policy?.match(/'nonce-([^']+)'/)?.[1];assert.ok(nonce);assert.notEqual(nonce,'attacker');
  assert.ok(!policy.split('; ').find(d=>d.startsWith('script-src')).includes('unsafe-inline'));
  assert.notEqual(policy,second.headers.get('content-security-policy'));
  assert.equal(first.headers.get('cache-control'),'private, no-store');
  const html=await first.text(),scripts=html.split(/<script\b/i).slice(1).map(part=>[part,part.slice(0,part.indexOf('>'))]);
  assert.ok(scripts.length>2,'actual SSR includes bootstrap and RSC scripts');
  for(const [,attributes] of scripts){assert.ok(attributes.includes(`nonce="${nonce}"`),`script lacks response nonce: ${attributes}`);}
  assert.match(html,/Symbol\.for\("vinext\.navigationRuntime"\)/);
  assert.match(html,/\.bootstrap\.rsc/);
});

test("public booking page renders Bolt, Flex and Fixed with no internal prices", async () => {
  const {default: worker} = await import(new URL("../dist/server/index.js", import.meta.url).href);
  const response = await worker.fetch(new Request("http://localhost/book"), {ASSETS:{fetch:async()=>new Response("Not found",{status:404})}}, {waitUntil(){},passThroughOnException(){}});
  assert.equal(response.status,200);
  const html = await response.text();
  assert.match(html, /Request security cover \| LOKD/);
  assert.match(html, /Immediate \/ Emergency Service/);
  assert.match(html, /Temporary \/ Flexible Service/);
  assert.match(html, /Full time deployment/);
  assert.doesNotMatch(html, /internalDraftPrice|clientShiftCents|officerRateCents|R\s*\d+[,.]\d{2}|prelaunch/i);
});


test("legacy quote requests redirect permanently and preserve homepage prefills", async () => {
  const {default: worker} = await import(new URL("../dist/server/index.js", import.meta.url).href);
  for (const method of ["GET", "HEAD"]) {
    const response = await worker.fetch(new Request("http://localhost/quote?service=armed_static&when=tomorrow", {method}), {ASSETS:{fetch:async()=>new Response("Not found",{status:404})}}, {waitUntil(){},passThroughOnException(){}});
    assert.equal(response.status,308);
    const destination = new URL(response.headers.get("location"), "http://localhost");
    assert.equal(destination.pathname,"/book");
    assert.equal(destination.search,"?service=armed_static&when=tomorrow");
  }
});
