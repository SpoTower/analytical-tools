import { Knex } from 'knex';

const config: Knex.Config = {
  client: 'mysql2', // Change to 'mysql2' for MySQL
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'esselA11',
    database: 'ebdb',
  },
};

export default config;
