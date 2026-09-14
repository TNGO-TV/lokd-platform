import { readinessSchema } from './readiness-schema-generated';

export const requiredSchemaCounts = {
  requiredTables: readinessSchema.objects.filter(object => object.type === 'table').length,
  requiredTriggers: readinessSchema.objects.filter(object => object.type === 'trigger').length,
  requiredViews: readinessSchema.objects.filter(object => object.type === 'view').length,
  requiredIndexes: readinessSchema.objects.filter(object => object.type === 'index').length,
};

// Match names AND kinds; unrelated objects cannot compensate for missing guards.
// Aggregate inside SQLite so D1 result pagination cannot truncate the inventory.
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const columns = [
  ['table', 'requiredTables'], ['trigger', 'requiredTriggers'],
  ['view', 'requiredViews'], ['index', 'requiredIndexes'],
].map(([type, alias]) => `SUM(CASE WHEN type=${literal(type)} AND name IN (${readinessSchema.objects.filter(object => object.type === type).map(object => literal(object.name)).join(',')}) THEN 1 ELSE 0 END) AS ${alias}`);
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
export const schemaMigration = readinessSchema.migration;
