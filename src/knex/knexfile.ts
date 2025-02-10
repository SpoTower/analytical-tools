import { Knex } from 'knex';
import { knexSnakeCaseMappers } from 'objection';

 export const analyticsDbConfig: Knex.Config = {
  client: 'mysql2', // Change to 'mysql2' for MySQL
  connection: {
    host: process.env.DB_HOSTNAME,
    port: 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD ,
    database: 'analytics',
  },
  ...knexSnakeCaseMappers(), // Convert snake_case to camelCase and vice versa
};

export const kidonDbConfig: Knex.Config = {
  client: 'mysql2', // Change to 'mysql2' for MySQL
  connection: {
    host: process.env.DB_HOSTNAME,
    port: 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'ebdb',
  },
  ...knexSnakeCaseMappers(), // Convert snake_case to camelCase and vice versa
};






