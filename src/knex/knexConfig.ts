import { Knex } from 'knex';

export const analyticsDbConfig: Knex.Config = {
  client: 'mysql2', 
  connection: {
    host: process.env.DB_HOSTNAME,
    port: 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'analytics',
  },
};

export const kidonDbConfig: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOSTNAME,
    port: 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'ebdb',
  },
  // ✅ Convert MySQL snake_case to camelCase in query results
  postProcessResponse: (result) => {
    if (Array.isArray(result)) {
      return result.map(row => convertKeysToCamelCase(row));
    } else if (typeof result === 'object' && result !== null) {
      return convertKeysToCamelCase(result);
    }
    return result;
  },
  // ✅ Convert camelCase to snake_case when inserting/updating in MySQL
  wrapIdentifier: (value, origImpl) => {
    return origImpl(snakeToCamel(value));
  },
};

/**
 * ✅ Converts object keys from snake_case to camelCase.
 */
export function convertKeysToCamelCase(row: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [snakeToCamel(key), value])
  );
}

/**
 * ✅ Converts snake_case to camelCase.
 */
export function snakeToCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * ✅ Converts camelCase to snake_case (For Inserts & Updates).
 */
export function camelToSnake(s: string) {
  return s.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
