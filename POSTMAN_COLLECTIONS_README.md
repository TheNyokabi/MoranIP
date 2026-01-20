# MoranERP Postman Collections

This directory contains comprehensive Postman collections for testing the MoranERP API ecosystem. These collections cover all implemented features and provide ready-to-use requests for development and testing.

## 📦 Available Collections

### 1. **MoranERP POS API** (`MoranERP_POS_API.postman_collection.json`)
Complete Point of Sale API collection including:
- **Authentication**: Login, tenant selection, token management
- **POS Operations**: Items, invoices, customers, warehouses
- **Quick Actions**: Frequent items, recent customers, search, presets
- **M-Pesa Payments**: STK Push, payment confirmation, transaction queries
- **Receipts & Printing**: Thermal, HTML, PDF receipts, email/SMS delivery
- **Offline Sync**: Transaction queuing, conflict resolution, background sync
- **Loyalty Programs**: Points earning, redemption, tier management
- **Layaway/Installments**: Partial payments, payment schedules
- **Internationalization**: Multi-language support, currency/date formatting
- **Analytics**: Sales reports, product performance, payment analysis

### 2. **MoranERP ERPNext Direct API** (`MoranERP_ERPNext_Direct_API.postman_collection.json`)
Direct ERPNext API testing (bypasses MoranERP backend):
- **System Health**: Ping, version info, authentication
- **Core Entities**: Companies, warehouses, items, customers
- **Sales Transactions**: Invoices, payments, delivery notes
- **Direct Database Operations**: Create, read, update, delete operations

### 3. **MoranERP IAM API** (`MoranERP_IAM_API.postman_collection.json`)
Identity & Access Management:
- **User Management**: Registration, invitations, role assignment
- **Tenant Operations**: Creation, configuration, membership management
- **RBAC System**: Roles, permissions, capability assignment
- **Authentication**: Multi-tenant login, session management

### 4. **MoranERP Settings API** (`MoranERP_Settings_API.postman_collection.json`)
Configuration and system management:
- **Tenant Settings**: Module toggles, preferences
- **Provisioning**: Automated setup, status monitoring, error handling
- **Import/Export**: Bulk data operations, template downloads
- **System Health**: Service monitoring, connectivity checks

## 🚀 Quick Start

### Prerequisites
- **Postman** installed (latest version recommended)
- **MoranERP stack running** (see main README for setup instructions)
- **Docker containers** up and healthy

### Setup Steps

1. **Import Collections & Environment**
   ```bash
   # In Postman: File → Import
   # Select all .postman_collection.json and .postman_environment.json files
   ```

2. **Configure Environment**
   - Select `MoranERP Complete API - Local` environment
   - Verify/Update variables:
     - `base_url`: `http://localhost:9000` (backend API)
     - `api_base_url`: `http://localhost:4000/api` (frontend proxy)
     - `erpnext_base_url`: `http://localhost:9010` (direct ERPNext)
     - `user_email`: Your test user email
     - `user_password`: Your test user password

3. **Test Authentication**
   - Start with `MoranERP POS API` → `Authentication` → `Login`
   - Token will be automatically saved to environment variables
   - Verify login response contains `access_token` and `tenants` array

4. **Test Basic Connectivity**
   - Run `Health Check - Ping` in ERPNext Direct API
   - Should return `{"message":"pong"}`

## 📋 Testing Workflow

### 1. **Basic POS Operations**
```
Authentication → Login
├── POS Operations → List Items
├── POS Operations → Create Customer
├── POS Operations → Create Invoice
└── Receipts & Printing → Generate Receipt
```

### 2. **Advanced Features**
```
M-Pesa Payments → Initiate STK Push
├── M-Pesa Payments → Query Payment Status
├── Loyalty Programs → Calculate Points
└── Offline Sync → Get Sync Status
```

### 3. **Multi-Language Support**
```
Internationalization → Get Supported Languages
├── Internationalization → Get Translations
├── Internationalization → Format Currency
└── Receipts & Printing → Generate Receipt (with language param)
```

### 4. **Analytics & Reporting**
```
Analytics & Reporting → Daily Sales Summary
├── Analytics & Reporting → Top Products
├── Analytics & Reporting → Payment Method Analysis
└── Analytics & Reporting → Customer Insights
```

## 🔧 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `base_url` | Backend API base URL | `http://localhost:9000` |
| `api_base_url` | Frontend proxy URL | `http://localhost:4000/api` |
| `erpnext_base_url` | Direct ERPNext URL | `http://localhost:9010` |
| `auth_token` | JWT authentication token | `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...` |
| `tenant_id` | Current tenant UUID | `550e8400-e29b-41d4-a716-446655440000` |
| `user_email` | Test user email | `admin@moran.localhost` |
| `user_password` | Test user password | `admin` |
| `customer_phone` | Test customer phone | `+254712345678` |
| `mpesa_amount` | Test payment amount | `100` |
| `test_item_code` | Test item code | `TEST-ITEM-2026` |

## 🧪 Test Data

### Pre-configured Test Entities
- **Company**: `Test Company API 2026`
- **Warehouse**: `Test Warehouse API - TCA26`
- **Item**: `TEST-ITEM-2026` (Standard Rate: 100 KES)
- **Customer**: Create as needed via API

### Sample Request Bodies

#### Create Customer
```json
{
    "customer_name": "John Doe",
    "customer_type": "Individual",
    "customer_group": "Direct",
    "phone": "+254712345678",
    "email": "john@example.com"
}
```

#### Create POS Invoice
```json
{
    "customer": "John Doe",
    "customer_type": "Direct",
    "referral_code": "FND-001",
    "pos_profile_id": "POS-PROFILE-ID",
    "items": [
        {
            "item_code": "TEST-ITEM-2026",
            "qty": 2,
            "rate": 100.0,
            "is_vatable": true
        }
    ],
    "payments": [
        {
            "mode_of_payment": "Cash",
            "amount": 200.0
        }
    ],
    "is_vatable": true,
    "notes": "Test transaction"
}
```

#### M-Pesa STK Push
```json
{
    "phone_number": "+254712345678",
    "amount": 150.50,
    "account_reference": "INV-2026-00001",
    "transaction_desc": "POS Payment"
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check if backend services are running
   - Verify user credentials in environment variables
   - Ensure tenant exists and user has access

2. **ERPNext Connection Failed**
   - Verify ERPNext container is healthy: `docker-compose ps erpnext`
   - Check ERPNext logs: `docker-compose logs erpnext`
   - Test direct connectivity: `curl http://localhost:9010/api/method/ping`

3. **POS Operations Fail**
   - Ensure tenant_id is set correctly
   - Verify POS profile exists in ERPNext
   - Check warehouse and item availability

4. **M-Pesa Integration Issues**
   - Verify M-Pesa credentials in backend configuration
   - Check payment gateway connectivity
   - Review payment status in ERPNext

### Debug Steps

1. **Check Service Health**
   ```bash
   # Backend health
   curl http://localhost:9000/health

   # ERPNext health
   curl http://localhost:9010/api/method/ping

   # Database connectivity
   docker-compose exec mariadb mysql -u root -padmin -e "SELECT 1;"
   ```

2. **Verify Authentication**
   ```bash
   # Test login
   curl -X POST http://localhost:9000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@moran.localhost","password":"admin"}'
   ```

3. **Check Logs**
   ```bash
   # Backend logs
   docker-compose logs api --tail=50

   # ERPNext logs
   docker-compose logs erpnext --tail=50
   ```

## 📚 API Documentation

- **Backend API Docs**: `http://localhost:9000/docs` (FastAPI Swagger)
- **Frontend API**: `http://localhost:4000/api` (Next.js API routes)
- **ERPNext API**: `http://localhost:9010` (Frappe Framework)

## 🤝 Contributing

When adding new endpoints:
1. Add to appropriate collection
2. Include proper authentication headers
3. Add test scripts for automatic variable setting
4. Update environment variables as needed
5. Document in this README

## 📄 File Structure

```
Postman Collections/
├── MoranERP_POS_API.postman_collection.json          # Main POS API
├── MoranERP_ERPNext_Direct_API.postman_collection.json  # Direct ERPNext
├── MoranERP_IAM_API.postman_collection.json         # Identity Management
├── MoranERP_Settings_API.postman_collection.json    # Configuration
├── MoranERP_POS_API.postman_environment.json        # Environment variables
└── POSTMAN_COLLECTIONS_README.md                    # This file
```

---

**Happy Testing!** 🎯

For issues or questions, check the main project documentation or create an issue in the repository.