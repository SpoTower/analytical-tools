import { Knex } from 'knex';

const config: Knex.Config = {
  client: 'mysql2', // Change to 'mysql2' for MySQL
  connection: {
    host: 'kidonv3-db-prod-aurora-replica.c1c3obgmz70n.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: 'kidonRoot',
    password: 'flPblZRJCRNIJqiXQwGo',
    database: 'ebdb',
  },
};

export default config;
 