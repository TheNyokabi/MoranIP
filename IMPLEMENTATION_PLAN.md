# MoranERP Comprehensive Implementation Plan (Revised)

## Executive Summary

This plan addresses **47 critical issues**, **38 high-priority issues**, and includes a complete **UI/UX overhaul** with modern, mobile-first design, comprehensive pricing engine, cash reconciliation, and robust offline sync.

**Timeline:** 16 weeks (4 months)
**Phases:** 6 major phases
**Approach:** Mobile-first, Data-driven, User-centric

---

## Phase Overview (Revised Order)

| Phase | Weeks | Focus |
|-------|-------|-------|
| **Phase 1** | 1-2 | UI/UX Foundation & Design System |
| **Phase 2** | 3-5 | Core Functionality, Routes & Tenant Context |
| **Phase 3** | 6-8 | Pricing Engine, Cash Management & Tax Compliance |
| **Phase 4** | 9-11 | Dashboard & UI Modernization (Social Media Inspired) |
| **Phase 5** | 12-14 | Offline Sync, Testing & Performance |
| **Phase 6** | 15-16 | Security Hardening, i18n & Final Polish |

---

## Phase 1: UI/UX Foundation & Design System (Weeks 1-2)

### 1.1 Design System Creation (Week 1)

#### Day 1-2: Design Tokens & Theme System
- [ ] Create comprehensive CSS custom properties
- [ ] Define color palette (light/dark modes)
- [ ] Create spacing scale (4px base)
- [ ] Define typography scale
- [ ] Create shadow system
- [ ] Define border radius tokens
- [ ] Create animation tokens

**New file:** `Frontend/src/styles/design-tokens.css`

```css
:root {
  /* Colors - Primary */
  --color-primary: 221.2 83.2% 53.3%;
  --color-primary-hover: 221.2 83.2% 45%;
  --color-primary-light: 221.2 83.2% 95%;
  
  /* Colors - Semantic */
  --color-success: 142.1 76.2% 36.3%;
  --color-warning: 38 92% 50%;
  --color-error: 0 84.2% 60.2%;
  --color-info: 199 89% 48%;
  
  /* Colors - Neutral */
  --color-gray-50: 210 40% 98%;
  --color-gray-100: 210 40% 96%;
  --color-gray-200: 214 32% 91%;
  --color-gray-300: 213 27% 84%;
  --color-gray-400: 215 20% 65%;
  --color-gray-500: 215 16% 47%;
  --color-gray-600: 215 19% 35%;
  --color-gray-700: 215 25% 27%;
  --color-gray-800: 217 33% 17%;
  --color-gray-900: 222 47% 11%;
  
  /* Spacing Scale */
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  
  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
  --text-4xl: 2.25rem;    /* 36px */
  
  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  
  /* Border Radius */
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  --radius-2xl: 1.5rem;   /* 24px */
  --radius-full: 9999px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}
```

#### Day 3-4: Core Component Library
- [ ] Create `stat-card.tsx` - Statistics display
- [ ] Create `empty-state.tsx` - Empty content states
- [ ] Create `page-header.tsx` - Consistent headers
- [ ] Create `data-card.tsx` - Mobile data display
- [ ] Create `responsive-table.tsx` - Table/card toggle
- [ ] Create `notification-item.tsx` - Notification display
- [ ] Create `activity-feed.tsx` - Activity stream
- [ ] Update Button variants for consistency
- [ ] Document component usage

**Components structure:**
```
Frontend/src/components/
├── ui/
│   ├── stat-card.tsx
│   ├── empty-state.tsx
│   ├── page-header.tsx
│   ├── data-card.tsx
│   ├── responsive-table.tsx
│   ├── notification-item.tsx
│   ├── activity-feed.tsx
│   ├── metric-trend.tsx
│   ├── progress-ring.tsx
│   └── avatar-group.tsx
```

#### Day 5: Layout System
- [ ] Create `page-layout.tsx` - Main wrapper
- [ ] Create `content-area.tsx` - Content container
- [ ] Create `responsive-sidebar.tsx` - Adaptive sidebar
- [ ] Create `sticky-header.tsx` - Sticky headers
- [ ] Create `mobile-sheet.tsx` - Bottom sheets

### 1.2 Mobile-First Responsive Design (Week 2)

#### Day 1-2: Navigation Overhaul
- [ ] Redesign mobile bottom navigation (5 core items)
- [ ] Create slide-out mobile menu with gestures
- [ ] Add swipe navigation gestures
- [ ] Implement breadcrumb navigation
- [ ] Add FAB (Floating Action Button) for primary actions
- [ ] Create context-aware navigation

**Mobile Navigation Design:**
```
┌─────────────────────────────┐
│  Content Area               │
│                             │
│                             │
│                         [+] │  ← FAB
├─────────────────────────────┤
│  🏠   📦   💳   📊   👤    │  ← Bottom Nav
│ Home  Inv  POS  Stats  Me  │
└─────────────────────────────┘
```

#### Day 3-4: Touch-Optimized Data Display
- [ ] Create mobile card view for all data tables
- [ ] Implement list virtualization with `@tanstack/react-virtual`
- [ ] Add horizontal scroll with indicators
- [ ] Create responsive data grids
- [ ] Add pull-to-refresh everywhere
- [ ] Add swipe actions on list items (edit, delete)

**Data Card Pattern:**
```
┌─────────────────────────────┐
│  Product Name            ⋮  │  ← Tap for actions
│  SKU: ITM-001               │
│                             │
│  💰 KES 1,500  │  📦 Stock: 50 │
│                             │
│  [Swipe ← Edit] [Swipe → Del]│
└─────────────────────────────┘
```

#### Day 5: Touch Target Optimization
- [ ] Increase all touch targets to 44x44px minimum
- [ ] Add touch feedback animations (ripple effect)
- [ ] Implement haptic feedback hooks
- [ ] Add gesture hints for new users
- [ ] Test on real devices (iOS + Android)

---

## Phase 2: Core Functionality, Routes & Tenant Context (Weeks 3-5)

### 2.1 Route Consistency & Tenant Context (Week 3)

#### Day 1-2: Backend Route Audit & Fix
- [ ] Create route mapping document
- [ ] Fix all route inconsistencies:

| Frontend Calls | Backend Should Have | Action |
|----------------|---------------------|--------|
| `/api/accounting/journal-entries` | `/api/accounting/journal-entries` | Rename backend |
| `/api/hr/leave-applications` | `/api/hr/leave-applications` | Rename backend |
| `/api/projects/templates` | `/api/projects/templates` | Rename backend |
| `/inventory/*` | `/api/inventory/*` | Fix frontend prefix |
| `/pos/*` | `/api/pos/*` | Fix frontend prefix |
| `/purchases/*` | `/api/purchases/*` | Fix frontend prefix |

- [ ] Standardize all routes to `/api/tenants/{tenant_id}/...` pattern
- [ ] Create route constants file for frontend

**New file:** `Frontend/src/lib/api/routes.ts`
```typescript
export const API_ROUTES = {
  // Tenant-scoped routes
  INVENTORY: (tenantId: string) => `/api/tenants/${tenantId}/inventory`,
  POS: (tenantId: string) => `/api/tenants/${tenantId}/pos`,
  PURCHASES: (tenantId: string) => `/api/tenants/${tenantId}/purchases`,
  SALES: (tenantId: string) => `/api/tenants/${tenantId}/sales`,
  ACCOUNTING: (tenantId: string) => `/api/tenants/${tenantId}/accounting`,
  HR: (tenantId: string) => `/api/tenants/${tenantId}/hr`,
  CRM: (tenantId: string) => `/api/tenants/${tenantId}/crm`,
  // ... etc
};
```

#### Day 3-4: Frontend Tenant Context Enforcement
- [ ] Create `useTenantContext` hook
- [ ] Update all API calls to include tenant context
- [ ] Update all navigation links to include tenant slug
- [ ] Add tenant context validation on mount
- [ ] Create tenant context provider

**New hook:** `Frontend/src/hooks/use-tenant-context.ts`
```typescript
export function useTenantContext() {
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;
  const { currentTenant } = useTenantStore();
  
  // Validate tenant context
  useEffect(() => {
    if (!tenantSlug || !currentTenant) {
      redirect('/workspaces');
    }
  }, [tenantSlug, currentTenant]);
  
  const buildApiUrl = useCallback((path: string) => {
    return `/api/tenants/${currentTenant?.id}${path}`;
  }, [currentTenant]);
  
  const buildNavUrl = useCallback((path: string) => {
    return `/w/${tenantSlug}${path}`;
  }, [tenantSlug]);
  
  return { tenantSlug, tenantId: currentTenant?.id, buildApiUrl, buildNavUrl };
}
```

- [ ] Update all page components to use `useTenantContext`
- [ ] Update all API client functions to accept tenant context
- [ ] Update all `Link` components to use tenant-aware URLs

#### Day 5: Backend Tenant Context Middleware
- [ ] Create strict tenant context middleware
- [ ] Add tenant validation to all routes
- [ ] Add tenant ID logging for audit
- [ ] Create tenant context decorator for services

**Backend middleware enhancement:**
```python
# Backend/app/middleware/tenant_context.py
class TenantContextMiddleware:
    async def __call__(self, request: Request, call_next):
        tenant_id = self.extract_tenant_id(request)
        if not tenant_id:
            return JSONResponse(
                status_code=400,
                content={"error": "tenant_context_required", "message": "Tenant context is required"}
            )
        
        # Add to request state
        request.state.tenant_id = tenant_id
        
        # Log for audit
        logger.info(f"Request to {request.url.path}", extra={
            "tenant_id": tenant_id,
            "user_id": request.state.user_id if hasattr(request.state, 'user_id') else None
        })
        
        return await call_next(request)
```

### 2.2 POS Product Visibility & Purchase Flow (Week 4)

#### Day 1-2: POS Product Visibility Fix
- [ ] Remove hardcoded zero-stock filter
- [ ] Add tenant setting: `show_zero_stock_in_pos` (default: true)
- [ ] Add `disabled=0` filter to backend `/pos/items`
- [ ] Add POS Profile item group filtering
- [ ] Create stock indicator component (green/yellow/red)
- [ ] Add "Out of Stock" badge instead of hiding

**Stock indicator design:**
```
┌─────────────────────┐
│  Product Card       │
│                     │
│  KES 1,500          │
│  ●●● In Stock (50)  │  ← Green
│  ●●○ Low Stock (5)  │  ← Yellow  
│  ○○○ Out of Stock   │  ← Red (still visible!)
└─────────────────────┘
```

#### Day 3-4: Purchase Receipt & Inventory Flow
- [ ] Add `submit_purchase_receipt` to `PurchaseServiceBase`
- [ ] Implement in `ERPNextPurchaseService`
- [ ] Create `POST /purchases/receipts/{id}/submit` endpoint
- [ ] Fix `purchase_order_id` mapping in receipt creation
- [ ] Create purchase receipt submission UI
- [ ] Test full purchase → receipt → inventory flow

**Purchase flow diagram:**
```
Purchase Order (Draft) 
    ↓ Submit
Purchase Order (Submitted)
    ↓ Create Receipt
Purchase Receipt (Draft)
    ↓ Submit  ← THIS WAS MISSING!
Purchase Receipt (Submitted)
    ↓ Auto-triggered
Stock Ledger Entry Created
    ↓
Inventory Updated ✓
```

#### Day 5: Paint Module Inventory Fix
- [ ] Add Stock Entry creation in `/paint/sell`
- [ ] Deduct base paint from warehouse on sale
- [ ] Deduct tint components from warehouse
- [ ] Add stock validation before paint sale
- [ ] Add `DELETE /paint/color-codes/{id}`
- [ ] Add `DELETE /paint/formulas/{id}`
- [ ] Add `PUT /paint/formulas/{id}`

### 2.3 Generic CRUD & Code Deduplication (Week 5)

#### Day 1-2: Backend CRUD Factory
- [ ] Create generic CRUD router factory
- [ ] Implement for all module routers
- [ ] Extract shared permission utilities
- [ ] Extract shared tenant utilities

**New file:** `Backend/app/routers/crud_factory.py`
```python
def create_crud_router(
    doctype: str,
    prefix: str,
    tags: List[str],
    permission_prefix: str,
    response_model: Type[BaseModel],
    create_model: Type[BaseModel],
    update_model: Type[BaseModel],
):
    router = APIRouter(prefix=prefix, tags=tags)
    
    @router.get("/")
    async def list_items(
        tenant_id: str = Depends(require_tenant_access),
        current_user: dict = Depends(get_current_user),
        limit: int = Query(50, le=200),
        offset: int = 0,
    ):
        check_permission(current_user, f"{permission_prefix}.view")
        # ... standardized list logic
    
    # ... create, get, update, delete endpoints
    
    return router
```

#### Day 3-4: Frontend Generic Module Page
- [ ] Create `ModulePage` component
- [ ] Create `use-module-crud` hook
- [ ] Create generic CRUD API client
- [ ] Refactor existing module pages

**New component:** `Frontend/src/components/modules/ModulePage.tsx`
```typescript
interface ModulePageProps<T> {
  title: string;
  icon: LucideIcon;
  apiEndpoint: string;
  columns: ColumnConfig<T>[];
  formSchema: ZodSchema;
  stats?: StatConfig[];
  actions?: ActionConfig[];
}

export function ModulePage<T>({ title, icon, apiEndpoint, columns, formSchema, stats, actions }: ModulePageProps<T>) {
  const { tenantId, buildApiUrl } = useTenantContext();
  const { data, isLoading, create, update, remove } = useModuleCrud<T>(buildApiUrl(apiEndpoint));
  
  // ... standardized module page logic
}
```

#### Day 5: Refactor Module Pages
- [ ] Refactor CRM page to use `ModulePage`
- [ ] Refactor HR page
- [ ] Refactor Projects page
- [ ] Refactor Manufacturing page
- [ ] Refactor Quality page
- [ ] Refactor Support page
- [ ] Refactor Assets page

---

## Phase 3: Pricing Engine, Cash Management & Tax Compliance (Weeks 6-8)

### 3.1 Comprehensive Pricing Engine (Week 6)

#### Day 1-2: Pricing Data Models

**New models for pricing:**
```python
# Backend/app/models/pricing.py

class PricingTier(Base):
    """Defines pricing tiers (e.g., Retail, Wholesale, VIP)"""
    __tablename__ = "pricing_tiers"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    name = Column(String(100))  # "Retail", "Wholesale"
    description = Column(Text)
    discount_percentage = Column(Numeric(5, 2), default=0)
    is_default = Column(Boolean, default=False)

class ItemPrice(Base):
    """Item-specific pricing"""
    __tablename__ = "item_prices"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    item_code = Column(String(100))
    pricing_tier_id = Column(UUID, ForeignKey("pricing_tiers.id"), nullable=True)
    
    # Buying prices (from purchases)
    buying_price = Column(Numeric(15, 2))  # Current/latest
    avg_buying_price = Column(Numeric(15, 2))  # Weighted average
    last_buying_price = Column(Numeric(15, 2))  # From last purchase
    
    # Selling prices
    selling_price = Column(Numeric(15, 2))
    min_selling_price = Column(Numeric(15, 2))  # Floor price
    
    # Margin settings
    margin_type = Column(String(20))  # "percentage" or "fixed"
    margin_value = Column(Numeric(10, 2))  # e.g., 30 for 30%
    
    # Validity
    valid_from = Column(DateTime)
    valid_to = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

class BatchPricing(Base):
    """Track buying price per batch (for FIFO/LIFO costing)"""
    __tablename__ = "batch_pricing"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    item_code = Column(String(100))
    batch_no = Column(String(100))
    purchase_receipt_id = Column(String(100))
    
    quantity = Column(Numeric(15, 3))
    remaining_qty = Column(Numeric(15, 3))
    buying_price = Column(Numeric(15, 2))  # Price at which this batch was bought
    
    received_date = Column(DateTime)
    expiry_date = Column(DateTime, nullable=True)

class PricingSettings(Base):
    """Tenant-level pricing configuration"""
    __tablename__ = "pricing_settings"
    
    tenant_id = Column(UUID, ForeignKey("tenants.id"), primary_key=True)
    
    # Default currency
    default_currency = Column(String(3), default="KES")
    
    # Margin calculation method
    default_margin_type = Column(String(20), default="percentage")
    default_margin_value = Column(Numeric(10, 2), default=30)  # 30%
    
    # For items with multiple batch prices
    selling_price_calculation = Column(String(20), default="percentile")  # "average", "percentile", "latest", "highest"
    selling_price_percentile = Column(Integer, default=90)  # 90th percentile
    
    # Price rounding
    round_prices = Column(Boolean, default=True)
    rounding_method = Column(String(20), default="nearest")  # "up", "down", "nearest"
    rounding_precision = Column(Integer, default=0)  # Decimal places
    
    # Allow selling below cost
    allow_below_cost_sale = Column(Boolean, default=False)
    below_cost_approval_required = Column(Boolean, default=True)
```

#### Day 3-4: Pricing Service Implementation
- [ ] Create `PricingService` class
- [ ] Implement buying price tracking from purchases
- [ ] Implement batch-aware buying prices
- [ ] Implement selling price calculation (with percentile)
- [ ] Implement margin calculations
- [ ] Create price suggestion endpoint

**New service:** `Backend/app/services/pricing_service.py`
```python
class PricingService:
    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.settings = self._get_settings()
    
    def calculate_suggested_selling_price(self, item_code: str) -> SuggestedPrice:
        """Calculate selling price based on buying prices and settings"""
        
        # Get all batch prices for this item
        batches = self.db.query(BatchPricing).filter(
            BatchPricing.tenant_id == self.tenant_id,
            BatchPricing.item_code == item_code,
            BatchPricing.remaining_qty > 0
        ).order_by(BatchPricing.buying_price).all()
        
        if not batches:
            return None
        
        # Calculate base cost based on method
        if self.settings.selling_price_calculation == "percentile":
            base_cost = self._calculate_percentile_price(
                batches, 
                self.settings.selling_price_percentile
            )
        elif self.settings.selling_price_calculation == "average":
            base_cost = self._calculate_weighted_average(batches)
        elif self.settings.selling_price_calculation == "latest":
            base_cost = batches[-1].buying_price  # Most recent
        elif self.settings.selling_price_calculation == "highest":
            base_cost = max(b.buying_price for b in batches)
        
        # Apply margin
        if self.settings.default_margin_type == "percentage":
            suggested_price = base_cost * (1 + self.settings.default_margin_value / 100)
        else:
            suggested_price = base_cost + self.settings.default_margin_value
        
        # Round if configured
        if self.settings.round_prices:
            suggested_price = self._round_price(suggested_price)
        
        return SuggestedPrice(
            item_code=item_code,
            base_cost=base_cost,
            suggested_price=suggested_price,
            margin_percentage=((suggested_price - base_cost) / base_cost) * 100,
            batch_count=len(batches),
            lowest_batch_price=min(b.buying_price for b in batches),
            highest_batch_price=max(b.buying_price for b in batches)
        )
    
    def _calculate_percentile_price(self, batches: List[BatchPricing], percentile: int) -> Decimal:
        """Calculate the nth percentile price weighted by remaining quantity"""
        # Sort by price and calculate cumulative quantity
        sorted_batches = sorted(batches, key=lambda b: b.buying_price)
        total_qty = sum(b.remaining_qty for b in sorted_batches)
        target_qty = total_qty * (percentile / 100)
        
        cumulative = 0
        for batch in sorted_batches:
            cumulative += batch.remaining_qty
            if cumulative >= target_qty:
                return batch.buying_price
        
        return sorted_batches[-1].buying_price
    
    def record_purchase_price(self, item_code: str, batch_no: str, 
                              quantity: Decimal, buying_price: Decimal,
                              purchase_receipt_id: str):
        """Record buying price from a purchase receipt"""
        batch = BatchPricing(
            tenant_id=self.tenant_id,
            item_code=item_code,
            batch_no=batch_no,
            purchase_receipt_id=purchase_receipt_id,
            quantity=quantity,
            remaining_qty=quantity,
            buying_price=buying_price,
            received_date=datetime.utcnow()
        )
        self.db.add(batch)
        
        # Update item's latest buying price
        item_price = self.db.query(ItemPrice).filter(
            ItemPrice.tenant_id == self.tenant_id,
            ItemPrice.item_code == item_code
        ).first()
        
        if item_price:
            item_price.last_buying_price = item_price.buying_price
            item_price.buying_price = buying_price
            item_price.avg_buying_price = self._calculate_weighted_average_for_item(item_code)
        
        self.db.commit()
```

#### Day 5: Pricing API & UI
- [ ] Create pricing endpoints
- [ ] Create price setting UI
- [ ] Create price suggestion display
- [ ] Add bulk price update feature

**API endpoints:**
```
GET  /api/tenants/{tenant_id}/pricing/settings
PUT  /api/tenants/{tenant_id}/pricing/settings
GET  /api/tenants/{tenant_id}/pricing/items/{item_code}
PUT  /api/tenants/{tenant_id}/pricing/items/{item_code}
GET  /api/tenants/{tenant_id}/pricing/items/{item_code}/suggested
POST /api/tenants/{tenant_id}/pricing/items/bulk-update
GET  /api/tenants/{tenant_id}/pricing/batches/{item_code}
```

### 3.2 POS Cash Management & Reconciliation (Week 7)

#### Day 1-2: Cash Tracking Models

**New models:**
```python
# Backend/app/models/cash_management.py

class POSSession(Base):
    """Extended POS session with cash tracking"""
    __tablename__ = "pos_sessions"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    pos_profile_id = Column(String(100))
    user_id = Column(UUID, ForeignKey("users.id"))
    
    # Session timing
    opening_time = Column(DateTime)
    closing_time = Column(DateTime, nullable=True)
    status = Column(String(20))  # "open", "closing", "closed"
    
    # Cash tracking
    opening_cash = Column(Numeric(15, 2))  # Cash in drawer at start
    
    # Calculated fields (from transactions)
    total_cash_sales = Column(Numeric(15, 2), default=0)
    total_cash_refunds = Column(Numeric(15, 2), default=0)
    total_cash_in = Column(Numeric(15, 2), default=0)  # Additional cash added
    total_cash_out = Column(Numeric(15, 2), default=0)  # Cash removed (e.g., bank deposit)
    
    # Closing
    expected_cash = Column(Numeric(15, 2))  # Calculated: opening + sales - refunds + in - out
    actual_cash = Column(Numeric(15, 2))  # Counted by employee
    cash_difference = Column(Numeric(15, 2))  # actual - expected
    
    # Other payment methods
    total_mpesa = Column(Numeric(15, 2), default=0)
    total_card = Column(Numeric(15, 2), default=0)
    total_credit = Column(Numeric(15, 2), default=0)
    
    # Notes
    opening_notes = Column(Text)
    closing_notes = Column(Text)

class CashMovement(Base):
    """Track all cash movements during a session"""
    __tablename__ = "cash_movements"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    session_id = Column(UUID, ForeignKey("pos_sessions.id"))
    
    movement_type = Column(String(20))  # "sale", "refund", "cash_in", "cash_out"
    amount = Column(Numeric(15, 2))
    reference_type = Column(String(50))  # "POS Invoice", "Manual", etc.
    reference_id = Column(String(100))
    
    notes = Column(Text)
    created_by = Column(UUID, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

class CashDiscrepancy(Base):
    """Log discrepancies for accountability"""
    __tablename__ = "cash_discrepancies"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    session_id = Column(UUID, ForeignKey("pos_sessions.id"))
    
    employee_id = Column(UUID, ForeignKey("users.id"))
    expected_amount = Column(Numeric(15, 2))
    actual_amount = Column(Numeric(15, 2))
    difference = Column(Numeric(15, 2))  # negative = shortage, positive = overage
    
    # Resolution
    status = Column(String(20))  # "pending", "acknowledged", "resolved", "disciplinary"
    resolution_type = Column(String(50))  # "employee_paid", "written_off", "investigated"
    resolution_notes = Column(Text)
    resolved_by = Column(UUID, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Disciplinary action
    disciplinary_action = Column(String(100), nullable=True)
    disciplinary_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class DenominationCount(Base):
    """Track cash denomination during counting"""
    __tablename__ = "denomination_counts"
    
    id = Column(UUID, primary_key=True)
    session_id = Column(UUID, ForeignKey("pos_sessions.id"))
    count_type = Column(String(20))  # "opening" or "closing"
    
    # Denominations (customize per currency)
    d_1000 = Column(Integer, default=0)  # KES 1000 notes
    d_500 = Column(Integer, default=0)
    d_200 = Column(Integer, default=0)
    d_100 = Column(Integer, default=0)
    d_50 = Column(Integer, default=0)
    d_40 = Column(Integer, default=0)  # Coins
    d_20 = Column(Integer, default=0)
    d_10 = Column(Integer, default=0)
    d_5 = Column(Integer, default=0)
    d_1 = Column(Integer, default=0)
    
    total_amount = Column(Numeric(15, 2))
    counted_by = Column(UUID, ForeignKey("users.id"))
    counted_at = Column(DateTime, default=datetime.utcnow)
```

#### Day 3-4: Cash Management Service
- [ ] Create `CashManagementService`
- [ ] Implement session opening with cash count
- [ ] Implement cash movement tracking
- [ ] Implement session closing with reconciliation
- [ ] Implement discrepancy logging
- [ ] Create notification for discrepancies

**Service implementation:**
```python
class CashManagementService:
    def open_session(self, pos_profile_id: str, opening_cash: Decimal, 
                     denomination_count: Dict, notes: str = None) -> POSSession:
        """Open a new POS session with cash count"""
        session = POSSession(
            tenant_id=self.tenant_id,
            pos_profile_id=pos_profile_id,
            user_id=self.current_user_id,
            opening_time=datetime.utcnow(),
            opening_cash=opening_cash,
            status="open",
            opening_notes=notes
        )
        self.db.add(session)
        
        # Record denomination count
        denom = DenominationCount(
            session_id=session.id,
            count_type="opening",
            total_amount=opening_cash,
            counted_by=self.current_user_id,
            **denomination_count
        )
        self.db.add(denom)
        self.db.commit()
        return session
    
    def record_cash_sale(self, session_id: str, amount: Decimal, invoice_id: str):
        """Record a cash sale in the session"""
        session = self._get_session(session_id)
        session.total_cash_sales += amount
        
        movement = CashMovement(
            tenant_id=self.tenant_id,
            session_id=session_id,
            movement_type="sale",
            amount=amount,
            reference_type="POS Invoice",
            reference_id=invoice_id,
            created_by=self.current_user_id
        )
        self.db.add(movement)
        self.db.commit()
    
    def close_session(self, session_id: str, actual_cash: Decimal,
                      denomination_count: Dict, notes: str = None) -> SessionCloseResult:
        """Close session and handle discrepancy"""
        session = self._get_session(session_id)
        
        # Calculate expected cash
        expected_cash = (
            session.opening_cash +
            session.total_cash_sales -
            session.total_cash_refunds +
            session.total_cash_in -
            session.total_cash_out
        )
        
        difference = actual_cash - expected_cash
        
        session.closing_time = datetime.utcnow()
        session.expected_cash = expected_cash
        session.actual_cash = actual_cash
        session.cash_difference = difference
        session.status = "closed"
        session.closing_notes = notes
        
        # Record closing denomination
        denom = DenominationCount(
            session_id=session_id,
            count_type="closing",
            total_amount=actual_cash,
            counted_by=self.current_user_id,
            **denomination_count
        )
        self.db.add(denom)
        
        # If discrepancy exists, log it
        result = SessionCloseResult(session=session, has_discrepancy=False)
        
        if abs(difference) > Decimal("0.50"):  # Tolerance of 0.50
            discrepancy = CashDiscrepancy(
                tenant_id=self.tenant_id,
                session_id=session_id,
                employee_id=session.user_id,
                expected_amount=expected_cash,
                actual_amount=actual_cash,
                difference=difference,
                status="pending"
            )
            self.db.add(discrepancy)
            result.has_discrepancy = True
            result.discrepancy = discrepancy
            
            # Send notification to manager
            self._notify_manager_of_discrepancy(discrepancy)
        
        self.db.commit()
        return result
```

#### Day 5: Cash Management UI
- [ ] Create session opening dialog with denomination count
- [ ] Create cash drawer status display
- [ ] Create cash in/out recording
- [ ] Create session closing wizard
- [ ] Create discrepancy acknowledgment UI
- [ ] Create manager discrepancy review dashboard

### 3.3 Tax Compliance System (Week 8)

#### Day 1-2: Tax Configuration Models

```python
# Backend/app/models/tax.py

class TaxType(Base):
    """Different types of taxes"""
    __tablename__ = "tax_types"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    
    code = Column(String(20))  # "VAT", "CORPORATE", "WITHHOLDING", etc.
    name = Column(String(100))  # "Value Added Tax"
    description = Column(Text)
    
    rate = Column(Numeric(5, 2))  # e.g., 16.00 for 16%
    is_percentage = Column(Boolean, default=True)
    
    # Chart of Accounts linkage
    tax_account_id = Column(String(100))  # Account for tax payable/receivable
    expense_account_id = Column(String(100))  # For non-recoverable taxes
    
    # Applicability
    applies_to = Column(String(50))  # "sales", "purchases", "both", "income"
    is_recoverable = Column(Boolean, default=True)  # Can be claimed back
    
    # Regulatory
    tax_authority = Column(String(100))  # "KRA", "URA", etc.
    filing_frequency = Column(String(20))  # "monthly", "quarterly", "annually"
    
    is_active = Column(Boolean, default=True)

class TaxTemplate(Base):
    """Templates for combining multiple taxes"""
    __tablename__ = "tax_templates"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    
    name = Column(String(100))  # "Standard VAT", "Zero Rated", "Exempt"
    description = Column(Text)
    
    is_default_sales = Column(Boolean, default=False)
    is_default_purchase = Column(Boolean, default=False)

class TaxTemplateItem(Base):
    """Taxes included in a template"""
    __tablename__ = "tax_template_items"
    
    id = Column(UUID, primary_key=True)
    template_id = Column(UUID, ForeignKey("tax_templates.id"))
    tax_type_id = Column(UUID, ForeignKey("tax_types.id"))
    
    sequence = Column(Integer)  # Order of application
    is_included_in_price = Column(Boolean, default=False)  # Tax inclusive pricing

class TaxTransaction(Base):
    """Record of tax on each transaction"""
    __tablename__ = "tax_transactions"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    
    transaction_type = Column(String(50))  # "POS Invoice", "Sales Invoice", "Purchase Invoice"
    transaction_id = Column(String(100))
    
    tax_type_id = Column(UUID, ForeignKey("tax_types.id"))
    taxable_amount = Column(Numeric(15, 2))
    tax_rate = Column(Numeric(5, 2))
    tax_amount = Column(Numeric(15, 2))
    
    # CoA entries
    debit_account = Column(String(100))
    credit_account = Column(String(100))
    
    transaction_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### Day 3-4: Tax Service Implementation
- [ ] Create `TaxService` class
- [ ] Implement tax calculation for sales
- [ ] Implement tax calculation for purchases
- [ ] Implement corporate tax calculation
- [ ] Implement withholding tax
- [ ] Create tax report generation

**Tax calculation flow:**
```python
class TaxService:
    def calculate_taxes(self, amount: Decimal, tax_template_id: str, 
                        is_inclusive: bool = False) -> TaxCalculation:
        """Calculate taxes based on template"""
        template = self._get_template(tax_template_id)
        taxes = []
        total_tax = Decimal(0)
        
        for item in template.items:
            tax_type = item.tax_type
            
            if is_inclusive or item.is_included_in_price:
                # Extract tax from inclusive amount
                taxable = amount / (1 + tax_type.rate / 100)
                tax_amount = amount - taxable
            else:
                # Add tax on top
                taxable = amount
                tax_amount = taxable * (tax_type.rate / 100)
            
            taxes.append(TaxLineItem(
                tax_type=tax_type,
                taxable_amount=taxable,
                rate=tax_type.rate,
                tax_amount=tax_amount,
                debit_account=tax_type.tax_account_id,
                credit_account=tax_type.expense_account_id
            ))
            total_tax += tax_amount
        
        return TaxCalculation(
            subtotal=amount if not is_inclusive else amount - total_tax,
            total_tax=total_tax,
            grand_total=amount if is_inclusive else amount + total_tax,
            tax_lines=taxes
        )
    
    def record_tax_transaction(self, invoice_type: str, invoice_id: str,
                               tax_calculation: TaxCalculation):
        """Record tax entries for reporting"""
        for tax_line in tax_calculation.tax_lines:
            transaction = TaxTransaction(
                tenant_id=self.tenant_id,
                transaction_type=invoice_type,
                transaction_id=invoice_id,
                tax_type_id=tax_line.tax_type.id,
                taxable_amount=tax_line.taxable_amount,
                tax_rate=tax_line.rate,
                tax_amount=tax_line.tax_amount,
                debit_account=tax_line.debit_account,
                credit_account=tax_line.credit_account,
                transaction_date=datetime.utcnow()
            )
            self.db.add(transaction)
        self.db.commit()
```

#### Day 5: Tax UI & Reports
- [ ] Create tax configuration UI
- [ ] Create tax template management
- [ ] Add tax selection to invoices
- [ ] Create VAT report
- [ ] Create tax liability report
- [ ] Create tax filing helper

---

## Phase 4: Dashboard & UI Modernization - Social Media Inspired (Weeks 9-11)

### 4.1 Global Dashboard (Week 9) - Social Media Inspired

The main dashboard should feel like a social feed where users see what matters to them across all tenants.

#### Day 1-2: Feed-Based Dashboard Architecture

**Design concept:**
```
┌─────────────────────────────────────────────────────────────┐
│  MoranERP                      🔔 5  👤 John                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Good morning, John! Here's what's happening...            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🏪 Moran Paint Shop                    2 min ago   │   │
│  │  ──────────────────────────────────────────────────  │   │
│  │  💰 New sale: KES 15,000                            │   │
│  │  Customer: Jane Doe                                  │   │
│  │  Items: 5L Dulux White, 2L Sadolin Blue             │   │
│  │                                                      │   │
│  │  [View Details]  [Open POS]                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⚠️ Alert                               5 min ago    │   │
│  │  ──────────────────────────────────────────────────  │   │
│  │  Low stock: Dulux Weather Shield (5 units left)     │   │
│  │  @ Moran Paint Shop                                 │   │
│  │                                                      │   │
│  │  [Reorder]  [View Stock]                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🏪 Moran Hardware                      15 min ago  │   │
│  │  ──────────────────────────────────────────────────  │   │
│  │  📊 Daily Summary                                    │   │
│  │  Sales: KES 125,000  ↑ 12%                          │   │
│  │  Orders: 24  ↑ 5                                     │   │
│  │  New Customers: 3                                    │   │
│  │                                                      │   │
│  │  [View Dashboard]                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✅ Task Completed                      30 min ago   │   │
│  │  ──────────────────────────────────────────────────  │   │
│  │  Stock Reconciliation @ Moran Paint Shop            │   │
│  │  Completed by: Admin                                 │   │
│  │  Discrepancy: 0 items                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Load More...]                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Components to create:**
```
Frontend/src/components/dashboard/
├── GlobalFeed.tsx           # Main feed component
├── FeedItem.tsx             # Base feed item
├── SaleFeedItem.tsx         # Sale notification
├── AlertFeedItem.tsx        # Alert/warning item
├── SummaryFeedItem.tsx      # Daily summary item
├── TaskFeedItem.tsx         # Task completion item
├── StockAlertItem.tsx       # Low stock alert
├── DiscrepancyItem.tsx      # Cash discrepancy alert
├── TenantQuickAccess.tsx    # Quick tenant switcher
└── NotificationBell.tsx     # Notification dropdown
```

#### Day 3-4: Notification System
- [ ] Create notification data model
- [ ] Create notification service (backend)
- [ ] Implement real-time notifications (WebSocket/SSE)
- [ ] Create notification preferences
- [ ] Create notification center UI

**Notification model:**
```python
class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey("users.id"))
    tenant_id = Column(UUID, ForeignKey("tenants.id"), nullable=True)
    
    type = Column(String(50))  # "sale", "alert", "task", "system"
    title = Column(String(200))
    message = Column(Text)
    
    # Link to source
    source_type = Column(String(50))  # "POS Invoice", "Stock Entry", etc.
    source_id = Column(String(100))
    
    # Metadata for feed display
    metadata = Column(JSON)  # Amount, customer name, etc.
    
    # Status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    # Priority for ordering
    priority = Column(Integer, default=5)  # 1=highest, 10=lowest
    
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### Day 5: Global Dashboard Polish
- [ ] Add infinite scroll for feed
- [ ] Add real-time updates
- [ ] Add quick actions from feed items
- [ ] Add feed filtering (by tenant, type)
- [ ] Add tenant quick-switch widget

### 4.2 Tenant Dashboard (Week 10)

The tenant dashboard should be functional, data-driven, and show performance at a glance.

#### Day 1-2: Tenant Dashboard Layout

**Desktop Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  🏪 Moran Paint Shop                              [Today ▼] [⚙]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Revenue │ │ Orders  │ │ Profit  │ │ Stock   │ │  Tasks  │      │
│  │ 125,000 │ │   24    │ │ 35,000  │ │ 5 low   │ │  3 due  │      │
│  │ ↑ 12%   │ │ ↑ 5     │ │ ↑ 8%    │ │ ⚠       │ │  ●●●    │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                                     │
│  ┌─────────────────────────────────┐ ┌───────────────────────────┐ │
│  │  Sales Trend (7 days)          │ │  Quick Actions            │ │
│  │  ┌──────────────────────────┐  │ │                           │ │
│  │  │    ╭─╮                   │  │ │  [💳 New Sale]            │ │
│  │  │   ╭╯ ╰╮  ╭──╮           │  │ │  [📦 Stock Entry]         │ │
│  │  │  ╭╯   ╰──╯  ╰──╮╭──     │  │ │  [🧾 New Invoice]         │ │
│  │  │──╯              ╰╯      │  │ │  [👤 New Customer]         │ │
│  │  └──────────────────────────┘  │ │  [📋 View Reports]        │ │
│  └─────────────────────────────────┘ └───────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────┐ ┌───────────────────────────┐ │
│  │  Recent Sales                   │ │  Pending Tasks            │ │
│  │  ─────────────────────────────  │ │  ─────────────────────    │ │
│  │  INV-001  Jane Doe    15,000   │ │  □ Review purchase order  │ │
│  │  INV-002  John Smith   8,500   │ │  □ Approve stock transfer │ │
│  │  INV-003  Mary Jane   12,000   │ │  □ Close POS session      │ │
│  │  [View All Sales →]             │ │  [View All Tasks →]       │ │
│  └─────────────────────────────────┘ └───────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Low Stock Items                                               │ │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ │ │
│  │  │ Dulux White 5L   │ │ Sadolin Blue 2L  │ │ Brush Set      │ │ │
│  │  │ 5 left ⚠         │ │ 3 left ⚠         │ │ 8 left         │ │ │
│  │  │ [Reorder]        │ │ [Reorder]        │ │ [Reorder]      │ │ │
│  │  └──────────────────┘ └──────────────────┘ └────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Mobile Layout:**
```
┌─────────────────────────┐
│  🏪 Moran Paint Shop  ⚙│
├─────────────────────────┤
│  Today's Performance    │
│                         │
│  ┌─────────┐ ┌────────┐│
│  │ Revenue │ │ Orders ││
│  │ 125,000 │ │   24   ││
│  │ ↑ 12%   │ │ ↑ 5    ││
│  └─────────┘ └────────┘│
│                         │
│  [💳 New Sale] [📦 +]  │
│                         │
│  Attention Required     │
│  ──────────────────    │
│  ⚠ 5 items low stock   │
│  ⏰ 3 tasks due today   │
│  💰 1 payment pending   │
│                         │
│  Recent Activity        │
│  ──────────────────    │
│  • Sale: KES 15,000    │
│  • Stock received      │
│  • New customer added  │
│                         │
├─────────────────────────┤
│ 🏠  📦  💳  📊  👤    │
└─────────────────────────┘
```

#### Day 3-4: Dashboard Components
- [ ] Create `TenantDashboard.tsx`
- [ ] Create `MetricCard.tsx` with trends
- [ ] Create `QuickActions.tsx` widget
- [ ] Create `RecentSales.tsx` widget
- [ ] Create `PendingTasks.tsx` widget
- [ ] Create `LowStockAlert.tsx` widget
- [ ] Create `SalesTrendChart.tsx`
- [ ] Implement responsive grid layout

#### Day 5: Dashboard Data & Performance
- [ ] Create dashboard API endpoint
- [ ] Implement dashboard data aggregation
- [ ] Add caching for dashboard queries
- [ ] Add real-time metric updates
- [ ] Add date range selector

### 4.3 POS Interface Complete Overhaul (Week 11)

The POS interface needs a comprehensive redesign to improve mobile usability, speed, and user experience. This section details specific UI changes from the current implementation to the new design.

#### Current State Analysis

The current POS page (`Frontend/src/app/w/[tenantSlug]/pos/page.tsx`) has:
- Fixed two-panel desktop layout (products left, cart right)
- Session start modal with warehouse/profile selection
- Quick Actions sidebar (hidden on mobile)
- Product grid with search
- Custom paint tab
- Cart panel with customer selection, payment modes
- Multiple modals (confirmation, success, end session, receipt)

**Current Issues:**
1. **Mobile Layout**: Cart takes 50vh which is too restrictive
2. **No Touch Gestures**: Missing swipe-to-add, swipe-to-remove
3. **No Product Images**: All products show generic Package icon
4. **Slow Category Navigation**: No quick category filters at top
5. **Hidden Quick Actions on Mobile**: Sidebar not accessible
6. **No Barcode Camera Integration**: Scanner button exists but no camera
7. **Complex Checkout Flow**: Too many steps/modals
8. **No Keyboard Shortcuts**: Power users can't use shortcuts
9. **No Recent Items**: Must search every time
10. **Session Modal Blocks Entry**: Must enter opening cash even for quick check

#### Day 1: Mobile-First Layout Restructure

**New Layout Architecture:**

```
MOBILE (< 768px):
┌─────────────────────────┐
│ ☰  MoranPOS   🔔 ◎ 💳  │  ← Compact header
├─────────────────────────┤
│ 🔍 [Search or scan...]  │  ← Always visible search
├─────────────────────────┤
│ [Recent] [Paint] [Tools]│  ← Horizontal scroll tabs
├─────────────────────────┤
│                         │
│  ┌─────┐ ┌─────┐ ┌─────┐│
│  │ IMG │ │ IMG │ │ IMG ││  ← 3-col product grid
│  │Name │ │Name │ │Name ││
│  │$$$  │ │$$$  │ │$$$  ││
│  └─────┘ └─────┘ └─────┘│
│  ...virtualized list... │
│                         │
├─────────────────────────┤
│ 🛒 3 items • KES 5,300 →│  ← Sticky cart bar (tap to expand)
└─────────────────────────┘

CART EXPANDED (Bottom Sheet):
┌─────────────────────────┐
│ ━━━━━━ (drag handle)    │  ← Drag to resize
│                         │
│ Your Cart          [×]  │
│ ────────────────────── │
│ ← Swipe to delete →     │
│ ┌───────────────────┐   │
│ │ 🖼 Dulux 5L   x2   │   │  ← Swipeable item cards
│ │     KES 3,000 [-][+]│  │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 🖼 Brush Set  x1   │   │
│ │     KES 500  [-][+] │  │
│ └───────────────────┘   │
│                         │
│ Subtotal     KES 3,500  │
│ VAT (16%)      KES 560  │
│ ──────────────────────  │
│ TOTAL        KES 4,060  │
│                         │
│ [Cash] [M-Pesa] [Card]  │  ← Large touch targets
│                         │
│ ████████████████████████│  ← Full-width pay button
│ │    PAY KES 4,060    │ │
│ ████████████████████████│
└─────────────────────────┘

TABLET/DESKTOP (≥ 768px):
┌─────────────────────────────────────────────────────────┐
│ ☰  MoranPOS - Moran Paint Shop           🔔 ◎ John [⚙]│
├────────────────────────────┬────────────────────────────┤
│ 🔍 Search or scan...    [📷]│  🛒 Cart (3)         [🗑] │
├────────────────────────────┤                            │
│ [All][Recent][Paint][Tools]│  Dulux White 5L       x2  │
├────────────────────────────┤  KES 3,000        [−] [+] │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐│  ────────────────────────│
│ │IMG │ │IMG │ │IMG │ │IMG ││  Brush Set           x1  │
│ │Name│ │Name│ │Name│ │Name││  KES 500           [−] [+] │
│ │$$$ │ │$$$ │ │$$$ │ │$$$ ││                            │
│ │●●● │ │●●○ │ │●●● │ │○○○ ││  ────────────────────────│
│ └────┘ └────┘ └────┘ └────┘│  Customer: [Walk-in ▼]    │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐│  Payment:                 │
│ │IMG │ │IMG │ │IMG │ │IMG ││  [💵 Cash] [📱] [💳]     │
│ └────┘ └────┘ └────┘ └────┘│                            │
│ ... more products ...      │  Subtotal      KES 3,500  │
│                            │  VAT 16%         KES 560  │
│                            │  ────────────────────     │
│                            │  TOTAL         KES 4,060  │
├────────────────────────────┤                            │
│ [F1 New] [F2 Hold] [F3 Pay]│  [██ COMPLETE SALE ██]   │
└────────────────────────────┴────────────────────────────┘
```

**Tasks:**
- [ ] Create new `POSLayout.tsx` component with responsive breakpoints
- [ ] Implement `StickyCartBar.tsx` for mobile (shows item count, total, tap to expand)
- [ ] Create `BottomSheetCart.tsx` using `@radix-ui/react-dialog` with drag gesture
- [ ] Update grid to 3-col on mobile, 4-col on tablet, 5-col on desktop
- [ ] Add horizontal scroll `CategoryTabs.tsx` component
- [ ] Implement `CompactHeader.tsx` for mobile with session status
- [ ] Add keyboard shortcuts display for desktop (`F1`, `F2`, `F3`, etc.)

#### Day 2: Product Card & Grid Improvements

**New Product Card Design:**

```tsx
// Frontend/src/components/pos/ProductCard.tsx
interface ProductCardProps {
  item: POSItem;
  onAdd: () => void;
  onLongPress?: () => void;  // For quick details
  isInCart?: boolean;
  cartQty?: number;
}
```

**Visual Improvements:**
```
┌─────────────────────┐
│  ┌───────────────┐  │
│  │   Product     │  │  ← Image placeholder or actual image
│  │    Image      │  │
│  │    📦        │  │
│  └───────────────┘  │
│                     │
│  Paint Brush Set    │  ← Product name (max 2 lines)
│  SKU: PNT-BRS-001  │  ← SKU in smaller text
│                     │
│  KES 1,500         │  ← Price (bold, primary color)
│                     │
│  ●●● 45 in stock   │  ← Stock indicator
│  [  +  Add  ]       │  ← Add button (or quantity controls if in cart)
└─────────────────────┘

If in cart:
│  [−]    2    [+]   │  ← Quantity controls replace Add button
```

**Stock Indicators:**
- `●●●` Green (>10 stock): In Stock
- `●●○` Yellow (1-10 stock): Low Stock (5 left)  
- `○○○` Red (0 stock): Out of Stock - Card is dimmed but visible
- `●●●` Blue (undefined stock): Stock Unknown - Still clickable

**Tasks:**
- [ ] Create new `ProductCard.tsx` with image support
- [ ] Add long-press handler for quick product details (mobile)
- [ ] Implement hover card for product details (desktop)
- [ ] Create `StockIndicator.tsx` component with color coding
- [ ] Add quantity controls directly on card when item is in cart
- [ ] Implement "Add" animation (subtle scale + checkmark)
- [ ] Add product image placeholder with gradient based on category
- [ ] Implement `@tanstack/react-virtual` for grid virtualization

#### Day 3: Cart & Checkout Experience

**Cart Improvements:**

```tsx
// Swipeable cart item
interface CartItemProps {
  item: CartItem;
  onRemove: () => void;
  onQuantityChange: (qty: number) => void;
  onSwipeRight?: () => void;  // Edit
  onSwipeLeft?: () => void;   // Delete
}
```

**Swipe Actions:**
- Swipe left → Reveal delete button (red)
- Swipe right → Reveal edit button (blue) for manual price/discount
- Tap quantity → Open numpad for direct entry

**Checkout Flow Simplification:**

Current flow: Cart → Click "Complete Sale" → Confirmation Modal → Process → Success Modal → Close
New flow: Cart → Payment Selection → Tap "PAY" → Processing overlay → Success toast + Receipt

```
SIMPLIFIED CHECKOUT:
┌─────────────────────────┐
│      Processing...      │
│                         │
│         ◐             │  ← Spinner
│                         │
│  Creating invoice...    │
└─────────────────────────┘
        ↓ (1-2 seconds)
┌─────────────────────────┐
│  ✓ Sale Complete!       │  ← Success toast (auto-dismiss)
│  INV-2024-0042          │
│  [View Receipt] [New]   │
└─────────────────────────┘
```

**Tasks:**
- [ ] Create `SwipeableCartItem.tsx` with gesture support
- [ ] Implement inline quantity numpad (tap to open)
- [ ] Remove confirmation modal - use single-tap checkout
- [ ] Create processing overlay instead of modal
- [ ] Replace success modal with toast + inline receipt option
- [ ] Add haptic feedback on successful sale (mobile)
- [ ] Create `QuickReceipt.tsx` component (prints automatically if configured)

#### Day 4: Session Management & Quick Actions

**Session Start Redesign:**

Current: Modal blocks entire screen until opening cash entered
New: Optional quick-start, session banner visible but not blocking

```
NEW SESSION BANNER (collapsible):
┌─────────────────────────────────────────────┐
│ ⚠️ No active session                    [▼] │
│ [Start Session] or [Continue without]       │
└─────────────────────────────────────────────┘
       ↓ Tapping "Start Session"
┌─────────────────────────────────────────────┐
│ Start POS Session                           │
│                                             │
│ Warehouse: [Moran Main Store ▼]            │
│ Opening Cash: [KES 0.00        ]           │
│                                             │
│ [Cancel]              [Start Session]       │
└─────────────────────────────────────────────┘
```

**Mobile Quick Actions (Bottom Sheet):**

```
TAP HAMBURGER MENU:
┌─────────────────────────┐
│ ━━━━━━                  │
│                         │
│ Quick Actions           │
│ ────────────────────── │
│ 📷  Scan Barcode        │
│ 👤  Select Customer     │
│ 🏷️  Apply Discount      │
│ ⏸️  Hold Sale           │
│ 📜  Held Sales (3)      │
│ 🧾  Recent Sales        │
│ 🎨  Paint Mixing        │
│ ⚙️  Settings            │
│ 🚪  End Session         │
└─────────────────────────┘
```

**Tasks:**
- [ ] Create `SessionBanner.tsx` - collapsible, non-blocking
- [ ] Add "Continue without session" option for quick checks
- [ ] Create `MobileQuickActionsSheet.tsx` (hamburger menu)
- [ ] Move paint tab to quick actions menu
- [ ] Add "Hold Sale" feature (save cart for later)
- [ ] Create "Held Sales" list view
- [ ] Add recent sales quick access

#### Day 5: Barcode Scanner & Keyboard Shortcuts

**Camera Barcode Scanner:**

```tsx
// Frontend/src/components/pos/CameraScanner.tsx
interface CameraScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}
```

```
CAMERA SCANNER OVERLAY:
┌─────────────────────────┐
│                    [×]  │
│                         │
│  ┌─────────────────┐   │
│  │                 │   │
│  │    [  |  ]      │   │  ← Camera view with scan line
│  │                 │   │
│  └─────────────────┘   │
│                         │
│  Point camera at        │
│  barcode to scan        │
│                         │
│  [🔦 Light] [📷 Switch] │
└─────────────────────────┘
```

**Keyboard Shortcuts (Desktop):**

| Key | Action |
|-----|--------|
| `F1` | New sale (clear cart) |
| `F2` | Hold current sale |
| `F3` | Retrieve held sale |
| `F4` | Select customer |
| `F5` | Apply discount |
| `F8` | Open cash drawer |
| `F10` | Complete sale |
| `F12` | End session |
| `/` | Focus search |
| `Esc` | Close modals/cancel |
| `+` | Increase qty of last item |
| `-` | Decrease qty of last item |

**Tasks:**
- [ ] Integrate `@zxing/browser` for camera barcode scanning
- [ ] Create `CameraScanner.tsx` with torch toggle
- [ ] Implement keyboard shortcuts using `useHotkeys` hook
- [ ] Add shortcut hints overlay (press `?` to show)
- [ ] Create `ShortcutsHelp.tsx` modal
- [ ] Add barcode input field auto-focus on external scanner input

#### POS Component File Structure:

```
Frontend/src/components/pos/
├── layout/
│   ├── POSLayout.tsx           # Main responsive layout
│   ├── CompactHeader.tsx       # Mobile header
│   ├── DesktopHeader.tsx       # Desktop header with stats
│   ├── StickyCartBar.tsx       # Mobile cart summary bar
│   └── SessionBanner.tsx       # Session status banner
├── products/
│   ├── ProductGrid.tsx         # Virtualized product grid
│   ├── ProductCard.tsx         # Individual product card
│   ├── CategoryTabs.tsx        # Category filter tabs
│   ├── ProductSearch.tsx       # Search with voice input
│   └── StockIndicator.tsx      # Stock level indicator
├── cart/
│   ├── BottomSheetCart.tsx     # Mobile cart bottom sheet
│   ├── DesktopCart.tsx         # Desktop cart panel
│   ├── SwipeableCartItem.tsx   # Swipeable cart item
│   ├── QuantityNumpad.tsx      # Numpad for quantity entry
│   └── CartTotals.tsx          # Subtotal, VAT, total display
├── checkout/
│   ├── PaymentSelector.tsx     # Payment method buttons
│   ├── ProcessingOverlay.tsx   # Processing state overlay
│   ├── QuickReceipt.tsx        # Inline receipt preview
│   └── SuccessToast.tsx        # Sale success notification
├── scanner/
│   ├── CameraScanner.tsx       # Camera barcode scanner
│   └── ScannerOverlay.tsx      # Scanner UI overlay
├── actions/
│   ├── MobileQuickActionsSheet.tsx  # Mobile menu
│   ├── HeldSalesList.tsx       # Held sales view
│   └── RecentSalesList.tsx     # Recent sales view
├── keyboard/
│   ├── ShortcutsProvider.tsx   # Keyboard shortcuts context
│   └── ShortcutsHelp.tsx       # Shortcuts reference modal
└── index.ts                    # Barrel exports
```

#### Day 4-5: Form & Settings Redesign
- [ ] Create form wizard component
- [ ] Create multi-step forms
- [ ] Create settings page with tabs
- [ ] Add visual toggles for features
- [ ] Create preview for changes

---

## Phase 5: Offline Sync, Testing & Performance (Weeks 12-14)

### 5.1 Robust Offline Sync System (Week 12)

#### Day 1-2: Enhanced Offline Data Model

```python
# Backend/app/models/offline_sync.py

class OfflineTransaction(Base):
    """Queue for offline transactions"""
    __tablename__ = "offline_transactions"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    device_id = Column(String(100))  # Unique device identifier
    
    transaction_type = Column(String(50))  # "pos_invoice", "stock_entry", etc.
    payload = Column(JSON)  # Full transaction data
    
    # Sync tracking
    local_id = Column(String(100))  # Client-generated ID
    server_id = Column(String(100), nullable=True)  # Assigned after sync
    
    version = Column(Integer, default=1)
    checksum = Column(String(64))  # SHA256 of payload for integrity
    
    status = Column(String(20))  # "pending", "processing", "synced", "conflict", "failed"
    sync_attempts = Column(Integer, default=0)
    last_sync_attempt = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_offline_at = Column(DateTime)  # When created on client
    synced_at = Column(DateTime, nullable=True)

class SyncConflict(Base):
    """Track conflicts for manual resolution"""
    __tablename__ = "sync_conflicts"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    offline_transaction_id = Column(UUID, ForeignKey("offline_transactions.id"))
    
    conflict_type = Column(String(50))  # "duplicate", "version_mismatch", "data_conflict"
    
    local_data = Column(JSON)
    server_data = Column(JSON)
    
    resolution_status = Column(String(20))  # "pending", "local_wins", "server_wins", "merged", "discarded"
    resolved_by = Column(UUID, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class SyncException(Base):
    """Exceptions that require manual reconciliation"""
    __tablename__ = "sync_exceptions"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, ForeignKey("tenants.id"))
    
    exception_type = Column(String(50))  # "data_loss_risk", "integrity_error", "business_rule_violation"
    severity = Column(String(20))  # "low", "medium", "high", "critical"
    
    source_type = Column(String(50))
    source_id = Column(String(100))
    
    description = Column(Text)
    technical_details = Column(JSON)
    
    # Resolution
    status = Column(String(20))  # "open", "investigating", "resolved", "accepted"
    assigned_to = Column(UUID, ForeignKey("users.id"), nullable=True)
    resolution = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### Day 3-4: Sync Service with Reconciliation

```python
class OfflineSyncService:
    def sync_transaction(self, transaction: OfflineTransaction) -> SyncResult:
        """Sync a single offline transaction with conflict detection"""
        
        # Verify checksum
        if not self._verify_checksum(transaction):
            return self._create_exception(
                transaction, 
                "integrity_error",
                "Transaction checksum mismatch - possible data corruption"
            )
        
        # Check for conflicts
        conflict = self._detect_conflict(transaction)
        if conflict:
            return SyncResult(
                status="conflict",
                conflict=conflict,
                needs_manual_resolution=True
            )
        
        # Process transaction
        try:
            result = self._process_transaction(transaction)
            transaction.status = "synced"
            transaction.server_id = result.id
            transaction.synced_at = datetime.utcnow()
            
            return SyncResult(status="success", server_id=result.id)
            
        except BusinessRuleViolation as e:
            return self._create_exception(
                transaction,
                "business_rule_violation",
                str(e)
            )
        except Exception as e:
            transaction.sync_attempts += 1
            transaction.last_sync_attempt = datetime.utcnow()
            transaction.error_message = str(e)
            
            if transaction.sync_attempts >= 3:
                transaction.status = "failed"
                return self._create_exception(
                    transaction,
                    "data_loss_risk",
                    f"Transaction failed after 3 attempts: {e}"
                )
            
            return SyncResult(status="retry", error=str(e))
    
    def reconcile_with_live(self, device_id: str) -> ReconciliationReport:
        """Reconcile offline data with live server data"""
        
        report = ReconciliationReport()
        
        # Get all pending transactions for device
        pending = self.db.query(OfflineTransaction).filter(
            OfflineTransaction.device_id == device_id,
            OfflineTransaction.status.in_(["pending", "processing"])
        ).all()
        
        for transaction in pending:
            result = self.sync_transaction(transaction)
            
            if result.status == "success":
                report.synced.append(transaction.local_id)
            elif result.status == "conflict":
                report.conflicts.append({
                    "local_id": transaction.local_id,
                    "conflict": result.conflict
                })
            elif result.status == "retry":
                report.pending.append(transaction.local_id)
            else:
                report.failed.append({
                    "local_id": transaction.local_id,
                    "error": result.error
                })
        
        # Check for data that exists on server but not in offline queue
        # (transactions created on other devices)
        server_transactions = self._get_recent_server_transactions(device_id)
        for server_tx in server_transactions:
            if not self._exists_in_local(server_tx, pending):
                report.server_only.append(server_tx.id)
        
        return report
```

#### Day 5: Offline UI & Exception Management
- [ ] Create sync status dashboard
- [ ] Create conflict resolution UI
- [ ] Create exception list view
- [ ] Add exception assignment workflow
- [ ] Create reconciliation report view

### 5.2 Testing Infrastructure (Week 13)

#### Day 1-2: Frontend Testing Setup
- [ ] Configure Jest with React Testing Library
- [ ] Create test utilities and mocks
- [ ] Write component tests for new UI components
- [ ] Write hook tests
- [ ] Set up snapshot testing

#### Day 3-4: Backend Testing Completion
- [ ] Add tests for pricing service
- [ ] Add tests for cash management
- [ ] Add tests for tax service
- [ ] Add tests for offline sync
- [ ] Add integration tests for critical flows

#### Day 5: CI/CD Pipeline
- [ ] Create GitHub Actions workflow
- [ ] Add test automation
- [ ] Add lint checks
- [ ] Add build verification
- [ ] Add deployment automation

### 5.3 Performance Optimization (Week 14)

#### Day 1-2: Database Optimization
- [ ] Add connection pooling
- [ ] Add missing indexes
- [ ] Optimize N+1 queries
- [ ] Add query caching

#### Day 3-4: Frontend Performance
- [ ] Implement list virtualization everywhere
- [ ] Add code splitting
- [ ] Optimize bundle size
- [ ] Add image optimization
- [ ] Implement lazy loading

#### Day 5: API Performance
- [ ] Add response caching
- [ ] Implement pagination everywhere
- [ ] Add request batching
- [ ] Optimize payload sizes

---

## Phase 6: Security Hardening, i18n & Final Polish (Weeks 15-16)

### 6.1 Security Hardening (Week 15)

#### Day 1-2: Authentication Security
- [ ] Remove hardcoded `SECRET_KEY = "secret"` from `config.py`
- [ ] Remove hardcoded `ERPNEXT_PASSWORD = "admin"`
- [ ] Implement environment variable validation (fail if missing)
- [ ] Move JWT tokens from localStorage to HttpOnly cookies
- [ ] Add `secure` and `samesite=strict` cookie flags
- [ ] Implement token refresh mechanism

#### Day 3-4: Rate Limiting & Input Validation
- [ ] Install and configure `slowapi` for rate limiting
- [ ] Add rate limits: login (5/min), API (100/min), file upload (10/min)
- [ ] Fix SQL injection in `cleanup_database.py`
- [ ] Add MIME type validation for file uploads
- [ ] Sanitize `dangerouslySetInnerHTML` usage with `bleach`

#### Day 5: Error Handling & Audit
- [ ] Create error sanitization middleware
- [ ] Remove stack traces from production responses
- [ ] Implement structured error responses
- [ ] Add comprehensive audit logging

### 6.2 Internationalization & Final Polish (Week 16)

#### Day 1-2: i18n Setup
- [ ] Install next-intl
- [ ] Create translation structure
- [ ] Set up language detection
- [ ] Create language switcher
- [ ] Extract hardcoded strings

#### Day 3-4: Monitoring Setup
- [ ] Configure Prometheus metrics
- [ ] Create Grafana dashboards
- [ ] Set up alerting rules
- [ ] Add Sentry integration

#### Day 5: Final Polish & Launch
- [ ] Animation polish
- [ ] Loading state consistency
- [ ] Error message review
- [ ] Final responsive testing
- [ ] Performance audit
- [ ] Security audit
- [ ] Documentation review
- [ ] Deployment checklist

---

## Summary: Key Deliverables by Phase

| Phase | Key Deliverables |
|-------|------------------|
| **Phase 1** | Design system, mobile-first components, responsive navigation |
| **Phase 2** | Tenant context everywhere, route consistency, POS visibility fix, purchase flow fix |
| **Phase 3** | Pricing engine with batch costing, cash reconciliation with discrepancy tracking, multi-tax support |
| **Phase 4** | Social media-inspired global feed, data-driven tenant dashboard, modern POS UI |
| **Phase 5** | Robust offline sync with exception handling, comprehensive tests, performance optimization |
| **Phase 6** | Security hardening, i18n, monitoring, final polish |

---

## Success Metrics

### Technical
- [ ] All critical bugs fixed (0 P0 issues)
- [ ] Test coverage >80%
- [ ] Lighthouse score >90
- [ ] Core Web Vitals: Green

### User Experience
- [ ] Mobile usability score >90
- [ ] Accessibility score >90 (WCAG AA)
- [ ] Page load time <3s

### Business
- [ ] POS transaction success rate >99%
- [ ] Offline transaction sync rate >99%
- [ ] Cash discrepancy visibility 100%
- [ ] Pricing accuracy 100%

---

*This implementation plan provides a structured approach to building a modern, functional, and robust ERP system.*
