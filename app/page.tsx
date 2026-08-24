import Link from "next/link";

const workCategories = [
  { name: "Unarmed", note: "Purpose-trained for the site: construction, school, retail, residential, events or logistics." },
  { name: "Armed", note: "Continuously trained and assessed—not merely qualified once a year." },
  { name: "VIP", note: "Selective Protective Operations specialists with advanced, continuing readiness standards." },
];

export default function PublicHome() {
  return (
    <main className="public-home">
      <aside className="team-review-bar" aria-label="Team review shortcuts">
        <div><strong>Team review</strong><span>Explore the complete working model</span></div>
        <nav>
          <a href="/client">Client</a>
          <a href="/officer">Officer</a>
          <a href="/ops">Operations</a>
        </nav>
      </aside>
      <header className="public-header">
        <Link className="public-logo" href="/" aria-label="LOKD home"><img src="/lokd-logo.svg" alt="LOKD" /></Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#passport">LOKD Passport</a>
          <a href="#officers">For officers</a>
          <a href="#training">Training</a>
        </nav>
        <div className="public-header-actions">
          <a className="public-login" href="/officer">Officer pilot</a>
          <a className="public-button public-button--dark" href="/client">Book security</a>
        </div>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="public-kicker"><i /> Purpose-trained South African security</p>
          <h1>The right officer.<br />Trained for the purpose.<br /><span>Ready for the post.</span></h1>
          <p>LOKD pays security professionals properly, trains them continuously and deploys them only where their live LOKD Passport proves they are current for the assignment.</p>
          <div className="public-hero-actions">
            <a className="public-button public-button--lime" href="/join?path=qualified">I&apos;m already qualified <b>→</b></a>
            <a className="public-button public-button--outline" href="/join?path=training">I need training <b>→</b></a>
          </div>
          <div className="public-proof-row"><span>✓ Purpose endorsements</span><span>✓ Continuous readiness</span><span>✓ Live QR verification</span></div>
        </div>

        <div className="public-hero-product" aria-label="Example of a LOKD officer work offer">
          <div className="product-orbit product-orbit--one" />
          <div className="product-orbit product-orbit--two" />
          <article className="public-offer-card">
            <div className="offer-card-top"><span><i /> New matched offer</span><em>UNARMED</em></div>
            <p>Saturday · 06:00–18:00</p>
            <h2>Midrand Depot</h2>
            <small>Contractor access · 18 km away</small>
            <dl><div><dt>Your offer</dt><dd>R800</dd></div><div><dt>Release</dt><dd>Weekly</dd></div></dl>
            <div className="offer-match-row"><span>✓ Passport current</span><span>✓ Construction endorsed</span></div>
            <button type="button">Review offer <b>→</b></button>
          </article>
          <aside className="public-verified-card"><span>LK</span><div><strong>LOKD Passport active</strong><small>Grade B · Purpose trained · Current</small></div><i>✓</i></aside>
          <aside className="public-earnings-chip"><small>Ready for payout</small><strong>R1,920</strong><span>Thursday request</span></aside>
        </div>
      </section>

      <section className="public-passport-section" id="passport">
        <div className="passport-demo-card"><div><span>LOKD PASSPORT</span><strong>LKD-P-1842</strong><small>LIVE · CURRENT</small></div><img src="/lokd-passport-qr.svg" alt="Example LOKD Passport verification QR" /></div>
        <div><p className="public-kicker">Proof, not promises</p><h2>Scan the officer. Verify the readiness.</h2><p>Every deployable officer carries a live LOKD Passport. Clients can check current PSiRA status, service readiness, purpose endorsements and the exact assigned shift without seeing private documents.</p><ul><li><strong>Well paid</strong><span>Better offers support reliability and professionalism.</span></li><li><strong>Trained for the purpose</strong><span>A school, construction site and executive assignment require different preparation.</span></li><li><strong>Continuously assessed</strong><span>Expired monthly or role-specific requirements automatically block affected offers.</span></li><li><strong>Verified on arrival</strong><span>A booking QR records the officer’s current Passport and attendance evidence.</span></li></ul><a className="public-button public-button--dark" href="/verify?token=lokdvp_7f4a2c91e6d84b3fa92c1d8e5a70b641">View the pilot Passport <b>→</b></a></div>
      </section>

      <section className="public-path-section" id="officers">
        <div className="public-section-heading">
          <p className="public-kicker">Start where you are</p>
          <h2>One doorway. Two clear paths.</h2>
          <p>You do not need to guess which form to complete. Tell LOKD where you are today and we will route your application correctly.</p>
        </div>
        <div className="public-path-grid">
          <article className="path-card path-card--qualified">
            <span className="path-number">01</span>
            <p>Already registered or qualified</p>
            <h3>Build your officer profile</h3>
            <ul><li>Add your PSiRA grade and service choices</li><li>Submit qualifications for verification later</li><li>Choose Armed, Unarmed or VIP alerts</li><li>Receive matched offers only after approval</li></ul>
            <a href="/join?path=qualified">Start officer application <b>→</b></a>
          </article>
          <article className="path-card path-card--training">
            <span className="path-number">02</span>
            <p>Still need qualifications</p>
            <h3>Plan your training pathway</h3>
            <ul><li>Tell us your current registration status</li><li>Select the training areas you need</li><li>Receive course and intake information</li><li>Return for verification when work-ready</li></ul>
            <a href="/join?path=training">Explore the training route <b>→</b></a>
          </article>
        </div>
        <p className="path-disclaimer">Registration or training does not guarantee approval, work or any particular rate. Every work category remains subject to LOKD verification and the legal requirements of the assignment.</p>
      </section>

      <section className="public-process" id="how-it-works">
        <div className="public-section-heading public-section-heading--light">
          <p className="public-kicker">The officer journey</p>
          <h2>From first application to LOKD Ready.</h2>
        </div>
        <div className="process-grid">
          <article><span>01</span><i>PROFILE</i><h3>Tell us where you stand</h3><p>Share basic contact, location, registration status and work interests.</p></article>
          <article><span>02</span><i>VERIFY</i><h3>Prove who you are</h3><p>Secure ID validation, live-selfie matching and separate credential checks protect the officer and every client.</p></article>
          <article><span>03</span><i>TRAIN</i><h3>Earn your Passport</h3><p>Complete the core, service and purpose-specific requirements set by LOKD.</p></article>
          <article><span>04</span><i>DEPLOY</i><h3>Receive matched offers</h3><p>Only current officers see work matching their Passport, preferences and location.</p></article>
        </div>
      </section>

      <section className="public-categories">
        <div className="public-section-heading">
          <p className="public-kicker">Work preferences</p>
          <h2>Higher grade. Your choice of work.</h2>
          <p>A Grade A or B officer may still choose Unarmed work. LOKD matches the assignment to both verified eligibility and the officer&apos;s own offer settings.</p>
        </div>
        <div className="category-grid">{workCategories.map((item, index) => <article key={item.name}><span>0{index + 1}</span><h3>{item.name}</h3><p>{item.note}</p><i>Eligibility verified before activation</i></article>)}</div>
      </section>

      <section className="public-training" id="training">
        <div className="training-mark" aria-hidden="true"><span /><span /><span /></div>
        <div>
          <p className="public-kicker">LOKD training pathway</p>
          <h2>Qualification is the starting line—not the finish.</h2>
          <p>LOKD combines authorised or partner-delivered qualifications with continuing internal readiness, fitness, purpose and scenario-based development. Completing training never guarantees a Passport; officers must pass and remain current.</p>
          <div className="training-tags"><span>Security-officer training</span><span>Firearms training</span><span>Armed-work readiness</span><span>VIP / close protection</span></div>
          <a className="public-button public-button--lime" href="/join?path=training">Tell us what training you need <b>→</b></a>
          <small>Course availability, provider accreditation, entry requirements and certification are confirmed before enrolment. Training does not guarantee registration, app approval or work.</small>
        </div>
      </section>

      <section className="public-final-cta">
        <p className="public-kicker">Your next move</p>
        <h2>Whether you are qualified or starting from zero, start here.</h2>
        <a className="public-button public-button--dark" href="/join">Join the LOKD officer network <b>→</b></a>
      </section>

      <footer className="public-footer">
        <img src="/lokd-logo.svg" alt="LOKD" />
        <p>Verified people. Controlled operations. Complete proof.</p>
        <div><a href="/ops">Operations pilot</a><a href="/officer">Officer pilot</a><a href="/client">Client pilot</a></div>
        <small>© 2026 LOKD · Private platform pilot</small>
      </footer>
    </main>
  );
}
