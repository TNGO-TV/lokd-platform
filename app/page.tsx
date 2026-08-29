import Link from "next/link";

const workCategories = [
  { name: "Unarmed · Phase 1", note: "The first controlled pilot is limited to scheduled, fixed-site unarmed guarding in one Gauteng operating area." },
  { name: "Armed · Future", note: "Not part of the first paid pilot. It remains gated behind separate regulatory, competency, equipment and operational controls." },
  { name: "VIP · Future", note: "Protective Operations remains outside Phase 1 and will not be offered until its specialist operating model is approved." },
];

export default function PublicHome() {
  return (
    <main className="public-home">
      <aside className="team-review-bar" aria-label="Launch status">
        <div><strong>Controlled pre-launch</strong><span>PSiRA paperwork is reported complete; paid deployment remains locked pending the control-room inspection and production activation checks.</span></div>
        <nav><a href="/join">Officer interest</a><a href="/client">Open public demo</a></nav>
      </aside>
      <header className="public-header">
        <Link className="public-logo" href="/" aria-label="LOKD home"><img src="/lokd-logo.png" alt="LOKD" /></Link>
        <nav aria-label="Main navigation">
          <Link href="/clients">For clients</Link>
          <a href="#passport">LOKD Passport</a>
          <a href="#officers">For officers</a>
          <a href="#training">Training</a>
        </nav>
        <div className="public-header-actions">
          <a className="public-login" href="/join">Officer interest</a>
          <a className="public-button public-button--dark" href="/client">Pilot sign-in</a>
        </div>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="public-kicker"><i /> Building purpose-trained South African security</p>
          <h1>The right officer.<br />Trained for the purpose.<br /><span>Ready for the post.</span></h1>
          <p>LOKD is building an employer-led security platform that pays professionals properly, trains them continuously and assigns them only where verified LOKD Passport controls show they are current for the post.</p>
          <div className="public-hero-actions">
            <a className="public-button public-button--lime" href="/join?path=qualified">I&apos;m already qualified <b>→</b></a>
            <a className="public-button public-button--outline" href="/join?path=training">I need training <b>→</b></a>
          </div>
          <div className="public-proof-row"><span>✓ Purpose endorsements</span><span>✓ Continuous readiness</span><span>✓ QR verification prototype</span></div>
        </div>

        <div className="public-hero-product" aria-label="Example of a LOKD officer work offer">
          <div className="product-orbit product-orbit--one" />
          <div className="product-orbit product-orbit--two" />
          <article className="public-offer-card">
            <div className="offer-card-top"><span><i /> New matched offer</span><em>UNARMED</em></div>
            <p>Prototype offer · Saturday · 06:00–18:00</p>
            <h2>Midrand Depot</h2>
            <small>Contractor access · 18 km away</small>
            <dl><div><dt>Your offer</dt><dd>R800</dd></div><div><dt>Release</dt><dd>Weekly</dd></div></dl>
            <div className="offer-match-row"><span>✓ Passport current</span><span>✓ Construction endorsed</span></div>
            <Link href="/officer">Preview offer <b>→</b></Link>
          </article>
          <aside className="public-verified-card"><span>LK</span><div><strong>Passport preview ready</strong><small>Illustrative Grade B · Purpose trained</small></div><i>✓</i></aside>
          <aside className="public-earnings-chip"><small>Illustrative payroll item</small><strong>R800</strong><span>No payment generated</span></aside>
        </div>
      </section>

      <section className="public-client-entry">
        <div><p className="public-kicker">For clients</p><h2>Know exactly what happens before an officer reaches your site.</h2><p>From the first risk brief and post orders to roster eligibility, attendance, incidents and the final service record—see the complete accountable client journey.</p><Link className="public-button public-button--dark" href="/clients">How LOKD works for clients <b>→</b></Link></div>
        <ol><li><span>01</span><strong>Assess the site</strong></li><li><span>02</span><strong>Define the post</strong></li><li><span>03</span><strong>Verify the roster</strong></li><li><span>04</span><strong>Prove delivery</strong></li></ol>
      </section>

      <section className="public-passport-section" id="passport">
        <div className="passport-demo-card"><div><span>LOKD PASSPORT</span><strong>LKD-P-1842</strong><small>PROTOTYPE · EXAMPLE</small></div><img src="/lokd-passport-qr.svg" alt="Example LOKD Passport verification QR" /></div>
        <div><p className="public-kicker">Proof, not promises</p><h2>Scan the officer. Verify the readiness.</h2><p>The production design gives every deployable officer a LOKD Passport. Authorised clients will be able to check verified PSiRA status, service readiness, purpose endorsements and the assigned shift without seeing private documents.</p><ul><li><strong>Well paid</strong><span>Better employment terms support reliability and professionalism.</span></li><li><strong>Trained for the purpose</strong><span>A school, construction site and executive assignment require different preparation.</span></li><li><strong>Continuously assessed</strong><span>Expired role-specific requirements will automatically block affected assignments.</span></li><li><strong>Verified on arrival</strong><span>The planned booking flow captures current Passport, time and approved attendance evidence.</span></li></ul><a className="public-button public-button--dark" href="/verify?token=lokdvp_7f4a2c91e6d84b3fa92c1d8e5a70b641">View the Passport prototype <b>→</b></a></div>
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
            <ul><li>Add your PSiRA grade and service interests</li><li>Submit qualifications for verification later</li><li>Register Armed or VIP interest for future phases</li><li>Phase 1 assignments are scheduled Unarmed fixed-site posts only</li></ul>
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
          <article><span>02</span><i>VERIFY</i><h3>Prove who you are</h3><p>Planned secure identity and separate credential checks will protect the officer and every client before activation.</p></article>
          <article><span>03</span><i>TRAIN</i><h3>Earn your Passport</h3><p>Complete the core, service and purpose-specific requirements set by LOKD.</p></article>
          <article><span>04</span><i>DEPLOY</i><h3>Receive matched assignments</h3><p>After activation, only eligible employed officers will see work matching their Passport, roster and lawful rest window.</p></article>
        </div>
      </section>

      <section className="public-categories">
        <div className="public-section-heading">
          <p className="public-kicker">Work preferences</p>
          <h2>Higher grade. Your choice of interest.</h2>
          <p>A Grade A or B officer may still choose Unarmed work. Phase 1 is scheduled Unarmed fixed-site guarding; other interests are recorded only for future regulated phases.</p>
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
        <img src="/lokd-logo.png" alt="LOKD" />
        <p>Verified people. Controlled operations. Complete proof.</p>
        <div><Link href="/clients">Client guide</Link><a href="/join">Officer interest</a><a href="/officer">Authorised officer access</a><a href="/client">Authorised client access</a></div>
        <small>© 2026 LOKD · Controlled pre-launch platform · No paid security deployment is active</small>
      </footer>
    </main>
  );
}
