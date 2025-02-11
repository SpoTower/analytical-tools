/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('ab_test_management', (table) => {
        table.increments('id').primary();
        table.string('title').notNullable();
        table.text('description').nullable();
        table.integer('domain_id').notNullable();
        table.string('control_group').nullable();
        table.string('variant_group').nullable();
        table.string('type').nullable();
        table.string('parent_path').nullable();
        table.string('hostname').nullable();
        table.string('unique_id').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTableIfExists('ab_test_management');

};
