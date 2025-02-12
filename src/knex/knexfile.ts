import { Knex } from 'knex';
import { knexSnakeCaseMappers } from 'objection';
import { logToCloudWatch } from 'src/logger';
import { getSecretFromSecretManager } from 'src/utils/secrets';

export const analyticsDbConfig = async (): Promise<Knex.Config> => {
  const res = await getSecretFromSecretManager(process.env.DB_PASSWORD_KEY);
  const secretData = JSON.parse(res);
  logToCloudWatch( `Connecting to ${process.env.RDS_HOSTNAME}`,'INFO', 'knexfile');
  return {
    client: 'mysql2', 
    connection: {
      host: process.env.RDS_HOSTNAME,
      port: 3306,
      user: secretData?.username || process.env.DB_USERNAME,
      password: secretData?.password || process.env.DB_PASSWORD, 
      database: 'analyticaldb',
    },
    ...knexSnakeCaseMappers(), // Convert snake_case to camelCase and vice versa
  }
};

export const kidonDbConfig = async (): Promise<Knex.Config> => {
  const res = await getSecretFromSecretManager(process.env.KIDON_PASSWORD_KEY);
  const secretData = JSON.parse(res);
  logToCloudWatch( `Connecting to ${process.env.KIDON_RDS_HOSTNAME}`,'INFO', 'knexfile');
  return {
    client: 'mysql2',
    connection: {
      host: process.env.KIDON_RDS_HOSTNAME,
      port: 3306,
      user: secretData?.username || process.env.KIDON_DB_USERNAME,
      password: secretData?.password || process.env.KIDON_DB_PASSWORD,
      database: 'ebdb',
    },
    ...knexSnakeCaseMappers(), // Convert snake_case to camelCase and vice versa
  }
};

