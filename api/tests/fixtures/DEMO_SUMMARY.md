# Los Pollos Hermanos Demo Summary 🐔

A complete Breaking Bad themed demo environment for VaultSQL showcasing credential management, access control, and SQL workbench features.

## What's Included

### 🏢 Workspace
- **Name**: Los Pollos Hermanos
- **Mode**: Vault (zero-trust credential encryption)
- **Slug**: `los-pollos-hermanos`

### 👥 Team Members

| Name | Email | Role | Access |
|------|-------|------|--------|
| Gus Fring | gus@lospollos.example | Admin | Full admin access |
| Walt White | walt@lospollos.example | Member | Distribution Crew group |
| Jesse Pinkman | jesse@lospollos.example | Member | Distribution Crew group |
| Mike Ehrmantraut | mike@lospollos.example | Member | Direct readonly access |
| Saul Goodman | saul@lospollos.example | Member | No database access |

### 👥 User Groups

1. **Executive Circle**
   - Members: Gus Fring
   - Access: Admin profile
   
2. **Distribution Crew**
   - Members: Walt White, Jesse Pinkman
   - Access: Readonly profile

### 🗄️ Database Servers

#### Server 1: Los Pollos Hermanos Demo DB
- Type: PostgreSQL
- Host: localhost:5432
- Database: demodb
- Description: Restaurant operations database

**Profiles:**

1. **admin** profile
   - Username: `admin`
   - Password: `InsecureDbPass`
   - Granted to: Executive Circle group (Gus)

2. **readonly** profile
   - Username: `readonly`
   - Password: `InsecureDbPass`
   - Granted to: Distribution Crew group (Walt, Jesse) + Mike Ehrmantraut (direct)

#### Server 2: "The Laundromat"
- Type: PostgreSQL
- Host: localhost:5432
- Database: laundromat
- Description: Premium cleaning supplies distribution

**Profiles:**

1. **admin** profile
   - Username: `laundry_admin`
   - Password: `InsecureDbPass`
   - Granted to: Gus Fring (direct - not via group)

2. **viewer** profile
   - Username: `laundry_viewer`
   - Password: `InsecureDbPass`
   - Granted to: Walt White and Jesse Pinkman (direct access only)

### 📊 Database Schema

#### Tables
- **departments** (5 departments)
- **employees** (8 employees including Gus, Max, Victor, Tyrus)
- **locations** (3 restaurant locations in NM)
- **customers** (8 customers including Walter White, Jesse Pinkman, Hank Schrader)
- **products** (10 menu items)
- **inventory** (18 inventory records across locations)
- **orders** (10 recent orders)
- **order_items** (16 line items)

#### Views
- **sales_summary**: Daily revenue aggregated by location
- **top_products**: Best-selling products with revenue metrics

## Access Control Matrix

This table shows which users have access to which servers/profiles:

| User | Los Pollos (admin) | Los Pollos (readonly) | Laundromat (admin) | Laundromat (viewer) |
|------|-------------------|----------------------|-------------------|--------------------|
| Gus Fring | ✅ (via group) | ❌ | ✅ (direct) | ❌ |
| Walt White | ❌ | ✅ (via group) | ❌ | ✅ (direct) |
| Jesse Pinkman | ❌ | ✅ (via group) | ❌ | ✅ (direct) |
| Mike Ehrmantraut | ❌ | ✅ (direct) | ❌ | ❌ |
| Saul Goodman | ❌ | ❌ | ❌ | ❌ |

**Key Demonstrations:**
- **Group-based access**: Gus gets admin via Executive Circle group
- **Direct user access**: Mike has direct readonly access (not via group)
- **Multiple servers**: Walt and Jesse have access to both servers
- **Different access patterns**: Laundromat uses direct grants instead of groups
- **No access**: Saul demonstrates a user with no database access
- **Server isolation**: Mike can only access Los Pollos, not Laundromat

### 📏 Sample Worksheets

Pre-created worksheets for Gus Fring (admin):

#### Los Pollos Hermanos Server:
**In "Analytics" Folder:**
1. **Top Customers by Loyalty Points**
   - Shows most valuable loyalty program members
   - Orders by points descending
   
2. **Recent Sales by Location**
   - 7-day sales performance by restaurant
   - Includes average order value calculation

**At Root Level:**
3. **Best Selling Products**
   - Product performance analysis
   - Revenue per order metrics
   
4. **Employee Overview**
   - Active employees by department
   - Average salaries and hire dates

#### "The Laundromat" Server:
**At Root Level:**
5. **High-Value Deliveries**
   - Tracks premium shipments over $50K
   - Shows delivery status and drivers
   
6. **Premium Product Inventory**
   - High-purity (99%+) products
   - Storage locations and pricing

## Demo Credentials

### Application Login
```
Email: gus@lospollos.example
Password: Insecure42
Vault Passphrase: crystal blue
```

### Database Access
```
Admin User:
  Username: admin
  Password: InsecureDbPass
  
Readonly User:
  Username: readonly
  Password: InsecureDbPass
```

## Sample Queries to Try

### Los Pollos Hermanos Queries

#### Customer Analysis
```sql
-- Top loyalty customers
SELECT 
    first_name || ' ' || last_name AS name,
    loyalty_points,
    email
FROM customers
ORDER BY loyalty_points DESC
LIMIT 5;
```

### Sales Performance
```sql
-- Revenue by location
SELECT 
    location_name,
    SUM(total_revenue) as total_sales,
    SUM(total_orders) as order_count
FROM sales_summary
GROUP BY location_name
ORDER BY total_sales DESC;
```

### Inventory Check
```sql
-- Low stock items
SELECT 
    l.name as location,
    p.name as product,
    i.quantity,
    i.last_restocked
FROM inventory i
JOIN locations l ON i.location_id = l.id
JOIN products p ON i.product_id = p.id
WHERE i.quantity < 100
ORDER BY i.quantity ASC;
```

#### Employee Insights
```sql
-- Department salaries
SELECT 
    d.name as department,
    COUNT(e.id) as employees,
    ROUND(AVG(e.salary), 2) as avg_salary,
    MAX(e.salary) as max_salary
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id 
WHERE e.status = 'active'
GROUP BY d.name
ORDER BY avg_salary DESC;
```

### Laundromat Queries

#### Premium Deliveries
```sql
-- High-value shipments
SELECT 
    delivery_code,
    customer_account,
    total_weight_kg,
    amount,
    status,
    driver_name
FROM high_value_deliveries
ORDER BY amount DESC;
```

#### Product Inventory
```sql
-- Premium products by purity
SELECT 
    product_code,
    name,
    purity_grade,
    unit_price,
    storage_location
FROM products
WHERE purity_grade LIKE '%99%'
ORDER BY unit_price DESC;
```

#### Customer Risk Analysis
```sql
-- High-risk customers
SELECT 
    business_name,
    contact_person,
    credit_limit,
    risk_level,
    territory
FROM customers
WHERE risk_level IN ('high', 'medium')
ORDER BY credit_limit DESC;
```

## Quick Setup

```bash
# From api/tests/fixtures/ directory
./setup_demo.sh
```

Or manually:
```bash
# Step 1: Initialize databases
./init_demo_db.sh
./init_laundromat_db.sh

# Step 2: Seed application
cd ../..
doppler run -- uv run python manage.py seed_dev --reset
```

## Features Demonstrated

✅ **Vault Mode**: Zero-trust credential encryption with user keypairs  
✅ **User Groups**: Role-based access with group memberships  
✅ **Access Control**: Profile-based permissions (admin vs readonly)  
✅ **Direct Access**: Individual user grants outside of groups  
✅ **Multiple Servers**: Users can have access to different databases  
✅ **Mixed Access Patterns**: Group-based + direct grants in same workspace  
✅ **SQL Workbench**: Folders and worksheets for query organization  
✅ **Real Data**: Realistic data across multiple business domains  
✅ **Breaking Bad Theme**: Fun character names for memorable demos

## Notes for Screencast

- The theme adds levity while demonstrating professional features
- Two separate servers show multi-database management
- Pre-created worksheets show the workbench in action
- Different access levels demonstrate security model
- Laundromat data has subtle innuendoes ("purity grade", "high-value deliveries")
- Realistic data makes queries more interesting
- View definitions show advanced SQL features
- Saul Goodman has no access (demonstrates exclusion)
- Mike has direct access to Los Pollos only (demonstrates server isolation)
- Walt and Jesse have access to both servers (demonstrates multi-server access)
- Laundromat uses direct grants instead of groups (demonstrates flexibility)
