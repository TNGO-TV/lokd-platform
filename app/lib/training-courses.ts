export const trainingCourses = [
  { id: 'grade-e', name: 'Grade E', category: 'Entry level', audience: 'People starting a career in security with no previous security grade.', covers: 'Security fundamentals, professional conduct, observation, reporting and the responsibilities of an entry-level officer.', outcome: 'A foundation for the Grade E assessment and the next step towards PSIRA registration.' },
  { id: 'grade-d', name: 'Grade D', category: 'Entry level', audience: 'New officers progressing from Grade E towards practical guarding duties.', covers: 'Access control, patrol procedures, communication and everyday guarding responsibilities.', outcome: 'Preparation for the Grade D assessment and a pathway towards registered guarding work.' },
  { id: 'grade-c', name: 'Grade C upgrade', category: 'Grade upgrades', audience: 'Officers ready to progress from Grade D and develop broader site responsibilities.', covers: 'Site security, supervision fundamentals, incident handling and communication with clients and teams.', outcome: 'Preparation for the Grade C assessment and roles matched to the resulting grade.' },
  { id: 'grade-b', name: 'Grade B upgrade', category: 'Grade upgrades', audience: 'Grade C officers developing their supervision and team leadership skills.', covers: 'Supervision, shift coordination, team responsibilities, reporting and managing site procedures.', outcome: 'Preparation for the Grade B assessment and greater supervisory responsibility.' },
  { id: 'grade-a', name: 'Grade A upgrade', category: 'Grade upgrades', audience: 'Experienced Grade B officers preparing for security management responsibilities.', covers: 'Security management principles, operational planning, risk awareness and oversight of teams and procedures.', outcome: 'Preparation for the Grade A assessment and progression towards management roles.' },
  { id: 'firearms-competency', name: 'Firearms competency', category: 'Specialist training', audience: 'Applicants who meet the legal entry requirements for the relevant firearms training.', covers: 'Applicable firearm law, safe handling, storage, practical proficiency and the assessment requirements for the relevant firearm category.', outcome: 'The training and assessment evidence required for the relevant competency application. SAPS determines competency approval.' },
  { id: 'armed-readiness', name: 'Armed readiness', category: 'Specialist training', audience: 'Registered officers with the firearms competency and authorisations required for the intended role.', covers: 'Lawful decision-making, safe operating procedures, communication, incident response and readiness for armed assignments.', outcome: 'A structured readiness assessment for armed duties, subject to current registration, authorisation and role checks.' },
  { id: 'close-protection', name: 'VIP / close protection', category: 'Specialist training', audience: 'Officers developing the specialist skills needed for protective assignments.', covers: 'Protective planning, risk awareness, professional conduct, movement coordination, communication and response procedures.', outcome: 'Development and assessment of close-protection skills. Assignment eligibility depends on the qualifications and checks required for the role.' },
] as const;
export type TrainingCourseId = typeof trainingCourses[number]['id'];
export const trainingPsiraStatuses = [
  ['active', 'Registered and current'], ['expired', 'Registered — renewal needed'],
  ['in_training', 'Currently in training'], ['not_registered', 'Not yet registered'],
] as const;
export const trainingIdStatuses = [
  ['available', 'I have an identity document'], ['replacement_pending', 'A replacement identity document is pending'],
  ['guidance_needed', 'I need guidance about identity documents'],
] as const;
export function trainingCourse(id: unknown) { return trainingCourses.find(course => course.id === id); }
export function currentIntakeMonth(now = new Date()) {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 7);
}
