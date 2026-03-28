# Test Fixtures

This directory contains fixtures and demo data for testing and demonstration purposes.

> **Note**: SQL fixtures have been moved to `/fixtures/sql/` and are now managed via Docker Compose.
> See [`/docs/DOCKER_SETUP.md`](/docs/DOCKER_SETUP.md) for complete setup instructions.

## Docker Setup (Recommended)

The easiest way to set up demo databases is with Docker Compose:

```bash
# From repository root
./scripts/docker-dev.sh

# Or manually
cd fixtures
docker compose up -d
```

This automatically creates and loads:
- **demodb** (Los Pollos Hermanos + kitchen_sink schema)
- **laundromat** (Distribution database)
- **mysql_demo_northwind** (MySQL compatibility testing)

All fixtures are pre-loaded and ready to use!

## Demo Databases: Breaking Bad Universe 🐔

Two Breaking Bad themed demo databases for comprehensive feature demonstrations:
1. **Los Pollos Hermanos** - Restaurant operations
2. **"The Laundromat"** - Premium cleaning supplies distribution

### Quick Start

**Option 1: Docker (Recommended)**
```bash
# Start demo databases
cd fixtures
docker compose up -d

# Seed the VaultSQL application
cd ../api
doppler run -- uv run python manage.py seed_dev --reset
```

**Option 2: Legacy Shell Scripts (Deprecated)**
```bash
# These scripts are deprecated in favor of Docker Compose
./setup_demo.sh

# Or individually:
./init_demo_db.sh
./init_laundromat_db.sh

# Seed the VaultSQL application
cd ../..
doppler run -- uv run python manage.py seed_dev --reset
```

3. **Login credentials:**
   - Email: `gus@lospollos.example`
   - Password: `Insecure42`
   - Vault Passphrase: `crystal blue`

### Database Schemas

#### Los Pollos Hermanos Database

The restaurant database includes:

- **departments**: Management, Operations, Kitchen, Customer Service, Finance
- **employees**: Staff members with salaries and hire dates
- **locations**: Three restaurant branches in New Mexico
- **customers**: Loyalty program members
- **products**: Menu items (combos, sandwiches, sides, beverages)
- **inventory**: Product stock levels per location
- **orders**: Recent customer orders
- **order_items**: Individual items in each order

#### Views

- **sales_summary**: Daily revenue aggregated by location
- **top_products**: Best-selling menu items

#### "The Laundromat" Database

The cleaning supplies distribution database includes:

- **products**: Industrial cleaning products with purity grades
- **customers**: Wholesale and retail clients with risk levels
- **ingredients**: Raw materials for product manufacturing
- **deliveries**: Shipment tracking with status and payment info

#### Views

- **high_value_deliveries**: Shipments over $50,000
- **premium_customers**: Clients with credit limits over $100,000
- **inventory_status**: High-purity (99%+) products

### Sample Worksheets

The seed command creates example worksheets:

**Los Pollos Hermanos Server:**
1. **Top Customers by Loyalty Points** (in Analytics folder)
2. **Recent Sales by Location** (in Analytics folder)
3. **Best Selling Products** (root level)
4. **Employee Overview** (root level)

**"The Laundromat" Server:**
5. **High-Value Deliveries** (root level)
6. **Premium Product Inventory** (root level)

### Database Users

- **admin**: Full read/write access (password: `InsecureDbPass`)
- **readonly**: Read-only access (password: `InsecureDbPass`)

### Characters

The workspace includes these Breaking Bad characters:

- **Gus Fring** (Admin) - `gus@lospollos.example`
- **Walt White** (Member) - `walt@lospollos.example`
- **Jesse Pinkman** (Member) - `jesse@lospollos.example`
- **Mike Ehrmantraut** (Member) - `mike@lospollos.example`
- **Saul Goodman** (Member) - `saul@lospollos.example`

### Manual Database Setup

If you prefer to set up the database manually:

```bash
# Create database
createdb demodb

# Load schema
psql -d demodb -f demo_db.sql

# Create users
psql -d demodb <<EOF
CREATE USER admin WITH PASSWORD 'InsecureDbPass';
CREATE USER readonly WITH PASSWORD 'InsecureDbPass';

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
EOF
```

### Customization

To modify the demo data:

1. Edit `demo_db.sql` to change schema or sample data
2. Edit `seed_dev.py` to change workspace/user configuration or worksheet queries
3. Re-run the initialization and seed commands
