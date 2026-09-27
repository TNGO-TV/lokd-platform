import Link from 'next/link';
import OfficerPresenceMap from './components/officer-presence-map';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {PublicFooter,PublicHeader,PublicLaunchBar} from './components/public-site-shell';
import {CLIENT_PORTAL_URL,OFFICER_PORTAL_URL,requestHostname,workspaceRoleForHost} from './lib/public-site';
export const dynamic='force-dynamic';
export default async function Home(){
 const role=workspaceRoleForHost(requestHostname((await headers()).get('host')));
 if(role)redirect(role==='operations'?'/ops':`/${role}`);
 return <main className="public-home"><PublicLaunchBar/><PublicHeader active="home"/>
  <section className="public-hero"><div className="public-hero-copy"><p className="public-kicker">Verified officers · Clear next steps</p><h1>Security for your site.<br/><span>A clear next step.</span></h1><p>Request an assessment for unarmed guarding, armed security or VIP protection in South Africa.</p><div className="public-hero-actions"><Link className="public-button public-button--lime" href="/contact">Request security <b>→</b></Link><Link className="public-button public-button--outline" href="/join">Apply as an officer <b>→</b></Link></div></div>
  <aside className="public-account-card" aria-labelledby="account-heading"><p className="public-kicker">Your account</p><h2 id="account-heading">Already applied?</h2><p>Sign in with your application email to track your progress and respond to Operations.</p><div className="public-account-actions"><a className="public-button public-button--dark" href={CLIENT_PORTAL_URL}>Client sign in</a><a className="public-button public-button--outline-dark" href={OFFICER_PORTAL_URL}>Officer sign in</a></div><div className="public-account-training"><p>New to security?</p><Link href="/join?path=training">Explore training pathways →</Link></div></aside></section>

  <section className="public-path-section"><div className="public-section-heading"><p className="public-kicker">Choose your path</p><h2>Client enquiry or officer application.</h2><p>Start with the route that matches what you need next.</p></div><div className="public-path-grid"><article className="path-card path-card--qualified"><span className="path-number">01</span><h3>Clients</h3><p>Tell us about your site, hours and security needs. Operations will assess your enquiry and explain the next steps.</p><Link href="/contact">Start a security enquiry →</Link></article><article className="path-card path-card--training"><span className="path-number">02</span><h3>Officers and training applicants</h3><p>Apply with your experience and registration details, or register your interest in training.</p><Link href="/join">Start an application →</Link></article></div><p className="path-disclaimer">Enquiries and applications are open. An application does not guarantee work. Service starts only after approved terms and cleared advance funding.</p></section>
  <OfficerPresenceMap/>
  <PublicFooter/>
 </main>;
}
