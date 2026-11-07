export type TrainingBookingRecord = {
  id: string; course: string; preferredIntakeMonth: string; fullName: string; mobile: string; email: string;
  idStatus: string; psiraStatus: string; status: string; consentedAt: string; createdAt: string;
  teamEmailStatus: string | null; confirmationEmailStatus: string | null;
};

export async function readTrainingBookings(db: D1Database, offset = 0): Promise<{ bookings: TrainingBookingRecord[]; hasMore: boolean }> {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new RangeError('Choose a valid training booking page.');
  const result = await db.prepare(`SELECT b.id,b.course,b.preferred_intake_month AS preferredIntakeMonth,
    b.full_name AS fullName,b.mobile_normalized AS mobile,b.email_normalized AS email,b.id_status AS idStatus,
    b.psira_status AS psiraStatus,b.status,b.consented_at AS consentedAt,b.created_at AS createdAt,
    t.state AS teamEmailStatus,c.state AS confirmationEmailStatus
    FROM training_bookings b
    LEFT JOIN officer_email_outbox t ON t.id='training-team:'||b.id
    LEFT JOIN officer_email_outbox c ON c.id='training-confirmation:'||b.id
    WHERE b.environment='production' AND b.integrity_state='user_submitted'
    ORDER BY b.created_at DESC,b.id DESC LIMIT 51 OFFSET ?`).bind(offset).all<TrainingBookingRecord>();
  return { bookings: result.results.slice(0, 50), hasMore: result.results.length > 50 };
}
