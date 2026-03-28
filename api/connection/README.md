# Connection App

Django app for managing database servers, profiles, credentials, and access control.

## Overview

This app provides the API layer for:
- **Servers**: Database server definitions (hostname, port, database, SSL config, SSH tunnel config)
- **Profiles**: User profiles for connecting to servers (username, password)
- **Credentials**: Encrypted storage of server and profile credentials (vault or managed mode)
- **Access**: Time-based access grants to profiles for users/groups
- **Adapters**: Validation and connection string building for different database types

## Architecture

### Credential Management

The app supports two modes (configured at workspace level):

1. **Vault Mode**: Zero-trust encryption where credentials are encrypted per-user with RSA+ChaCha20. Server cannot decrypt credentials.
2. **Managed Mode**: Credentials encrypted with server master key. Server can decrypt credentials.

See `spec/architecture/credential-management.md` for details.

### Query Execution

**All database connections and query execution happen in the Go query service** (`query_service/`). 

Django's role is limited to:
- Validating credential structure
- Storing encrypted credentials
- Managing access control
- Building connection strings
- Delegating connection tests to the query service

## Key Endpoints

### Server Management
- `GET /api/server/` - List servers
- `POST /api/server/create` - Create server + default profile (wizard)
- `POST /api/server/{server_id}/profiles` - Create profile
- `POST /api/server/{server_id}/profiles/{profile_id}/test` - Test connection (via query service)

### Profile Access
- `GET /api/profile/{profile_id}` - Get profile info for workbench
- `POST /api/profile/{profile_id}/keys` - Get decrypted credentials (vault mode)
- `POST /api/profile/{profile_id}/check` - Verify access and return credentials (query service only)
- `POST /api/profile/{profile_id}/log` - Log query execution (query service only)

### Access Management
- `POST /api/access/grant` - Grant access to profile
- `POST /api/access/revoke` - Revoke access

## Database Adapters

Adapters are in `connection/adapters/` and provide:
- Credential structure validation
- Connection string building

Currently supported:
- PostgreSQL (`connection/adapters/postgres.py`)

To add a new database type:
1. Create adapter class inheriting from `BaseAdapter`
2. Implement validation and connection string methods
3. Register in `ADAPTER_REGISTRY`

## Security

- All endpoints require authentication via Bearer token
- Access control enforced via `Access` model
- Credentials encrypted at rest
- Connection testing delegated to query service
- Query execution happens in isolated Go service

