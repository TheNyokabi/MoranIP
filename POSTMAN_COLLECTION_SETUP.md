# Postman Collection Setup Guide

## 📦 Files Included

1. **MoranERP_POS_API.postman_collection.json** - Complete Postman collection with all POS endpoints
2. **MoranERP_POS_API.postman_environment.json** - Environment template for local development

## 🚀 Quick Start

### Step 1: Import Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select **Files** tab
4. Choose `MoranERP_POS_API.postman_collection.json`
5. Click **Import**

### Step 2: Import Environment

1. Click **Import** again
2. Select `MoranERP_POS_API.postman_environment.json`
3. Click **Import**
4. Select the environment from the dropdown (top right)

### Step 3: Configure Environment Variables

Edit the environment and set:

- **`api_base_url`**: `http://localhost:4000/api` (Frontend proxy URL)
- **`base_url`**: `http://localhost:9000` (Backend direct URL)
- **`tenant_id`**: Your tenant UUID (get from login response or database)
- **`auth_token`**: Will be auto-populated after login (see Step 4)

### Step 4: Get Authentication Token

1. Go to **Authentication > Login** request
2. Update email/password if needed:
   ```json
   {
       "email": "admin@moran.com",
       "password": "admin123"
   }
   ```
3. Click **Send**
4. The token will be automatically saved to `auth_token` variable (see Test script)

### Step 5: Start Testing

All requests are now ready to use! The collection includes:

- ✅ Automatic token injection via `Authorization: Bearer {{auth_token}}`
- ✅ Automatic tenant ID injection via `X-Tenant-ID: {{tenant_id}}`
- ✅ Pre-configured request bodies with examples
- ✅ Organized folders by feature

## 📁 Collection Structure

```
MoranERP POS API
├── Authentication
│   └── Login (auto-saves token)
├── Main POS
│   ├── Items (List, Get, Stock)
│   ├── Customers (List, Create, Get)
│   ├── Warehouses (List)
│   └── Create Invoice
├── Quick Actions
│   ├── Frequent Items
│   ├── Recent Customers
│   ├── Barcode Lookup
│   ├── Item Search
│   ├── Quick Sale
│   ├── Repeat Last Sale
│   └── Bulk Item Add
├── M-Pesa Payments
│   ├── Initiate STK Push
│   ├── Confirm Payment
│   ├── Query Transaction
│   └── M-Pesa Callback (Webhook)
├── Receipts & Printing
│   ├── Get Receipt (HTML)
│   ├── Get Thermal Receipt
│   ├── Email Receipt
│   └── SMS Receipt
├── Offline Sync
│   ├── Get Sync Status
│   ├── Get Pending Transactions
│   ├── Sync Pending
│   ├── Get Transaction Status
│   └── Resolve Conflict
├── Analytics
│   ├── Daily Sales
│   ├── Product Performance
│   ├── Payment Analysis
│   ├── Staff Performance
│   └── Customer Insights
├── Loyalty Program
│   ├── Get Customer Points
│   ├── Get Customer Tier
│   ├── Calculate Points
│   └── Redeem Points
└── Layaway/Installments
    ├── Create Layaway
    ├── Get Layaway Status
    ├── Record Payment
    ├── Complete Layaway
    └── Cancel Layaway
```

## 🔧 Environment Variables

### Local Development
- `api_base_url`: `http://localhost:4000/api`
- `base_url`: `http://localhost:9000`
- `tenant_id`: Your tenant UUID
- `auth_token`: Auto-populated from login

### Production
- `api_base_url`: `https://api.moranerp.com/api`
- `base_url`: `https://api.moranerp.com`
- `tenant_id`: Production tenant UUID
- `auth_token`: Production token

## 📝 Request Examples

### Create POS Invoice

```json
POST /api/pos/invoice
{
    "customer": "CUST-001",
    "customer_type": "Direct",
    "pos_profile_id": "Main Store",
    "items": [
        {
            "item_code": "ITEM-001",
            "qty": 2,
            "rate": 100.00,
            "is_vatable": true
        }
    ],
    "payments": [
        {
            "mode_of_payment": "Cash",
            "amount": 240.00
        }
    ]
}
```

### M-Pesa STK Push

```json
POST /api/pos/payments/mpesa/stk-push
{
    "phone_number": "254712345678",
    "amount": 1000.00,
    "account_reference": "INV-001",
    "transaction_desc": "POS Payment",
    "invoice_id": "INV-001"
}
```

### Get Daily Analytics

```
GET /api/pos/analytics/daily?date=2024-01-01
```

## 🔐 Authentication

All requests (except login) require:

1. **Authorization Header**: `Bearer {{auth_token}}`
2. **X-Tenant-ID Header**: `{{tenant_id}}`

These are automatically added to all requests via collection variables.

## 🧪 Testing Tips

1. **Start with Login**: Always login first to get your token
2. **Check Environment**: Make sure you've selected the correct environment
3. **Update Variables**: Replace placeholder values (like `ITEM-001`, `CUST-001`) with actual data from your system
4. **Test in Order**: Some requests depend on others (e.g., create customer before creating invoice)
5. **Check Responses**: All responses follow the `{"data": {...}}` format

## 📊 Response Format

All API responses are wrapped in a `data` property:

```json
{
    "data": {
        // Actual response data
    }
}
```

## 🐛 Troubleshooting

### 401 Unauthorized
- Check if `auth_token` is set correctly
- Try logging in again
- Verify token hasn't expired

### 404 Not Found
- Check if `tenant_id` is set correctly
- Verify the endpoint URL is correct
- Ensure the resource exists

### 500 Internal Server Error
- Check backend logs: `docker logs moran-api --tail 100`
- Verify backend is running: `docker ps | grep moran-api`
- Check database connectivity

### Token Not Auto-Saving
- Verify the Login request has a Test script
- Check Postman Console for errors
- Manually copy token to `auth_token` variable

## 📚 Additional Resources

- **API Documentation**: See `POS_PLAN_IMPLEMENTATION_STATUS.md`
- **Backend Logs**: `docker logs moran-api --tail 100`
- **Frontend Logs**: `docker logs moran-frontend --tail 100`

## 🔄 Updating the Collection

If new endpoints are added:

1. Export the collection from Postman
2. Update the JSON file
3. Re-import or share with team

---

**Happy Testing! 🚀**
