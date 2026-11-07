import { env } from "cloudflare:workers";
import Link from "next/link";
import { requireOperationsPage } from "../../lib/operations-page-access";
import { readTrainingBookings } from "../../lib/training-bookings";
import { trainingCourse, trainingIdStatuses, trainingPsiraStatuses } from "../../lib/training-courses";
import "../../styles/officers.css";

export const dynamic = "force-dynamic";
const deliveryLabels: Record<string, string> = { queued: "Queued", sending: "Sending", sent: "Accepted by the mail server", failed: "Delivery needs attention", uncertain: "Outcome uncertain — check the sent mailbox before retrying" };
async function TrainingRequests({ searchParams }: { searchParams: Promise<{ offset?: string }> }) {
  await requireOperationsPage("/ops/training");
  if (!env.DB) throw new Error("Training booking storage is unavailable.");
  const raw = (await searchParams).offset ?? "0", offset = /^\d{1,7}$/.test(raw) && Number(raw) <= 1_000_000 ? Number(raw) : 0;
  const { bookings, hasMore } = await readTrainingBookings(env.DB, offset);
  return <main className="officers-ops"><p>OPERATIONS ZONE</p><h1>Training booking requests</h1><p>Review the requested course, intake month and contact details. The training team confirms eligibility and intake dates with each applicant.</p>{!bookings.length && <p>No training requests recorded.</p>}{bookings.map(booking => <article key={booking.id}><h2>{trainingCourse(booking.course)?.name ?? booking.course}</h2><p>{booking.id}</p><dl><dt>Applicant</dt><dd>{booking.fullName}</dd><dt>Contact</dt><dd><a href={"mailto:" + booking.email}>{booking.email}</a> · <a href={"tel:" + booking.mobile}>{booking.mobile}</a></dd><dt>Preferred intake</dt><dd>{booking.preferredIntakeMonth}</dd><dt>ID status</dt><dd>{trainingIdStatuses.find(([id]) => id === booking.idStatus)?.[1] ?? booking.idStatus}</dd><dt>PSIRA status</dt><dd>{trainingPsiraStatuses.find(([id]) => id === booking.psiraStatus)?.[1] ?? booking.psiraStatus}</dd><dt>Request status</dt><dd>{booking.status}</dd><dt>Team email</dt><dd>{deliveryLabels[booking.teamEmailStatus ?? "queued"]}</dd><dt>Applicant email</dt><dd>{deliveryLabels[booking.confirmationEmailStatus ?? "queued"]}</dd><dt>Consent recorded</dt><dd>{new Date(booking.consentedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</dd></dl></article>)}<nav aria-label="Training request pages">{offset > 0 && <Link href={"/ops/training?offset=" + Math.max(0, offset - 50)}>Newer requests</Link>}{hasMore && <Link href={"/ops/training?offset=" + (offset + 50)}>Older requests</Link>}</nav></main>;
}
export default function Page(props: Parameters<typeof TrainingRequests>[0]) { return <TrainingRequests {...props} />; }
