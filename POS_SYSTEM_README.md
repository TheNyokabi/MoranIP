# MoranERP POS System Documentation

## Overview

The MoranERP POS (Point of Sale) System is a comprehensive, Kenya-optimized retail management solution built on FastAPI backend with React frontend. The system provides complete POS functionality with advanced features for modern retail operations.

## 🚀 Key Features

### Core Functionality
- ✅ **POS Profile Integration**: Multi-storefront support with warehouse mapping
- ✅ **VAT Calculation**: Automatic VAT calculation with non-VATable item support
- ✅ **GL Entry Distribution**: Proper accounting entries for all transactions
- ✅ **Multi-Storefront Support**: Isolated operations per POS profile
- ✅ **Account Validation**: Pre-validation of all accounting accounts
- ✅ **Error Handling**: Comprehensive error handling and validation

### Customer Experience
- ✅ **Quick Actions**: Frequent items, recent customers, barcode scanning
- ✅ **M-Pesa Integration**: STK Push, Till Number, Paybill support
- ✅ **Mobile Money**: Airtel Money, T-Kash integration
- ✅ **Loyalty Program**: Points earning and redemption
- ✅ **Layaway Support**: Installment plans for large purchases
- ✅ **Thermal Receipts**: Professional receipt printing
- ✅ **Swahili Localization**: Full Swahili language support

### Advanced Features
- ✅ **Offline-First**: Works without internet connectivity
- ✅ **Caching**: Redis-based performance optimization
- ✅ **Plugin Architecture**: Extensible via plugins
- ✅ **Event-Driven**: Real-time event processing
- ✅ **API Versioning**: Backward-compatible API evolution
- ✅ **Webhooks**: External system integration
- ✅ **Analytics Dashboard**: Real-time business insights

## 🏗️ Architecture

### Backend (FastAPI)
```
Backend/
├── app/
│   ├── routers/          # API endpoints
│   │   ├── pos.py       # Main POS operations
│   │   ├── pos_payments.py  # Payment processing
│   │   ├── pos_quick_actions.py  # Quick actions
│   │   ├── pos_receipts.py      # Receipt generation
│   │   ├── pos_sync.py         # Offline sync
│   │   ├── pos_analytics.py    # Analytics
│   │   └── pos_loyalty.py      # Loyalty program
│   ├── services/         # Business logic
│   │   ├── pos/         # POS-specific services
│   │   │   ├── vat_service.py          # VAT calculations
│   │   │   ├── gl_distribution_service.py  # Accounting
│   │   │   ├── offline_service.py      # Offline support
│   │   │   ├── plugin_registry.py      # Plugin system
│   │   │   ├── event_bus.py           # Event processing
│   │   │   └── webhook_service.py     # Webhooks
│   │   └── payments/   # Payment providers
│   │       ├── mpesa_service.py       # M-Pesa integration
│   │       └── mobile_money_service.py # Other providers
│   ├── middleware/      # HTTP middleware
│   │   └── pos_cache_middleware.py    # Caching
│   └── models/          # Database models
├── tests/              # Test suites
└── requirements.txt    # Dependencies
```

### Frontend (Next.js + React)
```
Frontend/src/
├── app/                # Next.js app router
│   └── t/[tenantSlug]/ # Multi-tenant pages
│       └── pos/       # POS interface
├── components/         # Reusable components
│   └── pos/          # POS-specific components
│       ├── POSInterface.tsx         # Main POS screen
│       ├── QuickActionsPanel.tsx    # Quick actions
│       ├── MpesaPaymentModal.tsx    # M-Pesa payments
│       ├── BarcodeScanner.tsx       # Barcode scanning
│       └── ReceiptPreview.tsx       # Receipt preview
├── services/          # Client-side services
│   ├── pos-offline-manager.ts      # Offline management
│   └── api.ts                      # API client
├── lib/               # Utilities
└── locales/           # Translations
```

## 📋 API Reference

### POS Operations

#### Create Invoice
```http
POST /api/pos/invoice
Content-Type: application/json
X-Tenant-ID: {tenant_id}

{
  "customer": "CUST001",
  "items": [
    {
      "item_code": "PHN-SAM-S23",
      "qty": 1,
      "rate": 45000.00,
      "warehouse": "Main Warehouse"
    }
  ],
  "payments": [
    {
      "mode_of_payment": "M-Pesa",
      "amount": 45000.00,
      "phone_number": "254712345678"
    }
  ],
  "pos_profile_id": "MAIN_STORE",
  "is_vatable": true
}
```

#### Quick Actions
```http
GET /api/pos/quick-actions/frequent-items?pos_profile_id=MAIN_STORE
GET /api/pos/quick-actions/recent-customers
POST /api/pos/quick-actions/quick-sale
```

#### M-Pesa Payments
```http
POST /api/pos/payments/mpesa/stk-push
{
  "phone_number": "254712345678",
  "amount": 1000.00,
  "account_reference": "INV001",
  "transaction_desc": "Payment for goods"
}
```

#### Offline Sync
```http
GET /api/pos/sync/status
POST /api/pos/sync/sync
POST /api/pos/sync/queue
```

### Analytics
```http
GET /api/pos/analytics/dashboard
GET /api/pos/analytics/sales?date_from=2024-01-01&date_to=2024-01-31
GET /api/pos/analytics/products
GET /api/pos/analytics/payments
```

## 🔧 Configuration

### Environment Variables
```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_USER=pos_user
POSTGRES_PASSWORD=pos_password
POSTGRES_DB=pos_database

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# ERPNext
ERPNEXT_URL=https://erp.example.com
ERPNEXT_API_KEY=your_api_key
ERPNEXT_API_SECRET=your_api_secret

# M-Pesa
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=123456
MPESA_PASSKEY=your_passkey
```

### POS Profile Configuration
```json
{
  "name": "Main Store - Nairobi",
  "warehouse": "Main Warehouse - NBI",
  "company": "Paint Shop Ltd",
  "currency": "KES",
  "payment_methods": [
    {
      "type": "Cash",
      "account": "Cash Account - Main",
      "enabled": true
    },
    {
      "type": "M-Pesa",
      "account": "M-Pesa Account - Till 12345",
      "enabled": true,
      "mpesa_config": {
        "till_number": "12345",
        "stk_push_enabled": true
      }
    }
  ],
  "vat_config": {
    "vat_account": "VAT Output - Paint Shop Ltd",
    "default_vat_rate": 16.0,
    "allow_non_vatable": true
  }
}
```

## 🧪 Testing

### Unit Tests
```bash
# Run VAT service tests
pytest Backend/tests/unit/test_vat_service.py -v

# Run GL distribution tests
pytest Backend/tests/unit/test_gl_distribution_service.py -v
```

### Integration Tests
```bash
# Run POS invoice integration tests
pytest Backend/tests/integration/test_pos_invoice_integration.py -v

# Run all tests
pytest Backend/tests/ -v --cov=app
```

### Manual Testing
```bash
# Test POS invoice creation
curl -X POST "http://localhost:8000/api/pos/invoice" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: test-tenant" \
  -d @test_invoice.json

# Test M-Pesa payment
curl -X POST "http://localhost:8000/api/pos/payments/mpesa/stk-push" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: test-tenant" \
  -d @test_mpesa_payment.json
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Scale POS services
docker-compose up -d --scale pos-api=3
```

### Manual Deployment
```bash
# Backend
cd Backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
cd Frontend
npm install
npm run build
npm start
```

## 🔒 Security

### Authentication
- JWT token-based authentication
- Tenant isolation via X-Tenant-ID header
- Role-based access control (RBAC)

### Data Protection
- Encrypted payment data
- Secure API key management
- Input validation and sanitization

### Compliance
- KRA VAT compliance
- PCI DSS for payment processing
- Data protection regulations

## 📊 Monitoring

### Key Metrics
- Transaction success rate
- Average transaction time
- Offline transaction queue size
- M-Pesa payment success rate
- Cache hit rate
- API response times

### Health Checks
```bash
# Application health
GET /health

# POS system health
GET /api/v2/pos/health

# Cache health
GET /api/pos/cache/health
```

## 🛠️ Troubleshooting

### Common Issues

#### 404 Errors
- Check router prefixes in main.py
- Verify X-Tenant-ID header
- Confirm POS profile exists

#### M-Pesa Failures
- Verify API credentials
- Check callback URL configuration
- Monitor API rate limits

#### Offline Sync Issues
- Check IndexedDB storage
- Verify network connectivity
- Review sync queue status

#### VAT Calculation Errors
- Validate item VAT settings
- Check VAT account configuration
- Review tax templates

### Logs
```bash
# View application logs
docker-compose logs pos-api

# View payment processing logs
docker-compose logs | grep -i mpesa

# View offline sync logs
docker-compose logs | grep -i sync
```

## 📈 Performance Optimization

### Caching Strategy
- Item catalog: 1 hour TTL
- Customer data: 30 minutes TTL
- POS profiles: 1 hour TTL
- Frequent items: 24 hours TTL

### Database Optimization
- Connection pooling
- Query optimization
- Index management
- Read replicas for analytics

### Frontend Optimization
- Code splitting
- Lazy loading
- Service worker caching
- Progressive Web App (PWA) features

## 🔮 Future Enhancements

### Phase 16: Advanced Payment Features
- Card payment integration
- Buy now, pay later (BNPL)
- Cryptocurrency payments
- Payment links and QR codes

### Phase 17: Advanced Analytics
- Predictive analytics
- Customer behavior analysis
- Inventory optimization
- Sales forecasting

### Phase 18: Mobile App
- React Native mobile POS
- Offline mobile operations
- Inventory management app
- Customer mobile app

### Phase 19: Multi-Channel Integration
- E-commerce integration
- Marketplace integration
- Social commerce
- Omnichannel inventory

### Phase 20: AI-Powered Features
- Smart product recommendations
- Automated pricing
- Fraud detection
- Voice ordering

## 📞 Support

### Documentation
- API Reference: `/docs`
- Interactive API docs: `/redoc`

### Community
- GitHub Issues: Report bugs and request features
- Discussions: Share ideas and best practices

### Enterprise Support
- 24/7 technical support
- Custom development
- Training and onboarding
- SLA guarantees

---

**MoranERP POS System** - Empowering Kenyan retail with world-class technology.