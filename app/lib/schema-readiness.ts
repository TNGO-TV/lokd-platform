import { readinessSchema } from './readiness-schema-generated';
type SchemaObject = { type: string; name: string };
const operationsObjects: SchemaObject[] = [
  {type: 'table', name: 'production_eft_receipts'},
  {type: 'table', name: 'production_eft_decisions'},
  {type: 'trigger', name: 'production_eft_prepare_guard'},
  {type: 'trigger', name: 'production_eft_decision_guard'},
  {type: 'trigger', name: 'production_eft_funding'},
  {type: 'trigger', name: 'production_eft_receipts_immutable'},
  {type: 'trigger', name: 'production_eft_receipts_retain'},
  {type: 'trigger', name: 'production_eft_decisions_immutable'},
  {type: 'trigger', name: 'production_eft_decisions_retain'},
  {type: 'trigger', name: 'operations_accounting_payload_immutable'},
  {type: 'table', name: 'production_notifications'},
  {type: 'index', name: 'production_notifications_due'},
  {type: 'trigger', name: 'production_notifications_immutable'},
  {type: 'trigger', name: 'production_notifications_retain'},
  {type: 'trigger', name: 'operations_intake_email'},
  {type: 'trigger', name: 'operations_officer_decision_email'},
  {type: 'trigger', name: 'operations_passport_email'},
  {type: 'trigger', name: 'operations_passport_hold_email'},
  {type: 'trigger', name: 'operations_payroll_email'},
  {type: 'trigger', name: 'operations_identity_decision_email'},
  {type: 'trigger', name: 'operations_identity_suspension_email'},
  {type: 'trigger', name: 'operations_psira_email'},
  {type: 'trigger', name: 'operations_assignment_email'},
  {type: 'table', name: 'production_schedule_changes'},
  {type: 'trigger', name: 'production_schedule_change_guard'},
  {type: 'trigger', name: 'production_schedule_apply'},
  {type: 'trigger', name: 'production_schedule_changes_immutable'},
  {type: 'trigger', name: 'production_schedule_changes_retain'},
];
const baseObjects: readonly SchemaObject[] = readinessSchema.objects;
const objects = [...new Map([...baseObjects, ...operationsObjects].map(object => [object.type + ":" + object.name, object])).values()].sort((a,b)=>(a.type+':'+a.name)<(b.type+':'+b.name)?-1:(a.type+':'+a.name)>(b.type+':'+b.name)?1:0);


export const requiredSchemaCounts = {
  requiredTables: objects.filter(object => object.type === 'table').length,
  requiredTriggers: objects.filter(object => object.type === 'trigger').length,
  requiredViews: objects.filter(object => object.type === 'view').length,
  requiredIndexes: objects.filter(object => object.type === 'index').length,
};

// Match names AND kinds; unrelated objects cannot compensate for missing guards.
// Aggregate inside SQLite so D1 result pagination cannot truncate the inventory.
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const columns = [
  ['table', 'requiredTables'], ['trigger', 'requiredTriggers'],
  ['view', 'requiredViews'], ['index', 'requiredIndexes'],
].map(([type, alias]) => `SUM(CASE WHEN type=${literal(type)} AND name IN (${objects.filter(object => object.type === type).map(object => literal(object.name)).join(',')}) THEN 1 ELSE 0 END) AS ${alias}`);
const query = `SELECT ${columns.join(',')} FROM sqlite_master`;
export async function checkSchemaReadiness(db: D1Database) {
  const row = await db.prepare(query).first<typeof requiredSchemaCounts>();
  const checks = {
    requiredTables: Number(row?.requiredTables ?? 0),
    requiredTriggers: Number(row?.requiredTriggers ?? 0),
    requiredViews: Number(row?.requiredViews ?? 0),
    requiredIndexes: Number(row?.requiredIndexes ?? 0),
  };
  return {
    ...checks,
    schemaComplete: Object.entries(requiredSchemaCounts).every(([key, count]) => checks[key as keyof typeof checks] === count),
  };
}
export const schemaMigration = [readinessSchema.migration,'0142_operations_schedule.sql'].sort().at(-1)!;
export const operationsSchema = {migration:schemaMigration,objects};
