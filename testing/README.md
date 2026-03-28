# Test Databases

Kitchen sink databases for validating SQL client functionality.

## Quick Start

```bash
# Reload both PostgreSQL and MySQL kitchen_sink databases
task dev:db:seed:kitchen_sink

# Or reload individually
task dev:db:seed:kitchen_sink:postgres
task dev:db:seed:kitchen_sink:mysql
```

## What's Included

The kitchen_sink databases contain 20 tables testing:

- All data types (MySQL & PostgreSQL specific)
- Foreign keys (simple, circular, self-referential)
- UUID primary keys and foreign keys
- Unique constraints (single, composite, multiple)
- Indexes (simple, composite, partial, spatial, full-text)
- Views (simple, aggregate, materialized)
- Generated columns
- CHECK constraints, DEFAULT values, NULL handling
- Pagination (5000 rows)
- Empty tables
- String escaping edge cases
- Identifier limits
- Timezone-aware timestamps

## Tables

- `data_types_demo` - All data types including UUID, TIMESTAMPTZ
- `uuid_pk_demo_users/posts/comments` - **UUID primary keys and foreign keys** (users → posts → comments)
- `circular_refs_orgs/members/teams` - Circular foreign keys (UUID)
- `self_referential_hierarchy` - Self-referential foreign keys
- `foreign_keys_parent/child` - Simple foreign keys
- `many_to_many_left/right/junction` - Many-to-many relationships
- `unique_constraints_multi` - Multiple unique constraints
- `defaults_and_nulls` - DEFAULT values and NULLs
- `string_escaping_edge_cases` - String edge cases
- `generated_columns_test` - Generated columns
- `pagination_large` - 5000 rows for pagination
- `empty_table` - Empty table (0 rows)
- `identifier_limits_test` - Identifier length limits
