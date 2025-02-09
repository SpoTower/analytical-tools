import { Knex } from 'knex';

export const analyticsDbConfig: Knex.Config = {
  client: 'mysql2', // Change to 'mysql2' for MySQL
  connection: {
    host: process.env.DB_HOSTNAME,
    port: 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'analytics',
  },
};

export const kidonDbConfig: Knex.Config = {
  client: 'mysql2', // Change to 'mysql2' for MySQL
  connection: {
    host: process.env.DB_HOSTNAME,
    port: 3306,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'ebdb',
  }
};




