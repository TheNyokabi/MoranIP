# Workspace Creation - Customer Journey

## Overview
This document describes the complete customer journey for creating a new workspace, from initial access to final workspace activation.

---

## 🎯 Entry Points

### Primary Entry Point
**Location:** `/dashboard` (Global User Dashboard)

**UI Element:** "Create Workspace" action card
- **Visual:** Blue gradient card with plus icon
- **Text:** "Start a new workspace and become the owner"
- **Action:** Clicking navigates to `/admin/workspaces`

### Alternative Entry Points
1. **Admin Dashboard:** `/admin/dashboard` → "New Workspace" button
2. **Global Sidebar:** "New Workspace" link in navigation
3. **Direct URL:** `/admin/workspaces`

---

## 📋 Step-by-Step Journey

### **Step 1: Access Creation Form**
**Route:** `/admin/workspaces`

**UI State:**
- Dark gradient background (slate-950 with purple accents)
- Header with back button and "Create New Workspace" title
- Single-page form in a glass-morphism card

**User Sees:**
- "Create New Workspace" heading
- "Onboard a new tenant to the platform" subtitle
- Form with two main sections:
  1. Workspace Information
  2. Administrator Account

---

### **Step 2: Fill Workspace Information**

#### **Required Fields:**
1. **Workspace Name** (text input)
   - Placeholder: "e.g., Durashield"
   - Required: Yes
   - Validation: None (free text)

2. **Category** (dropdown)
   - Options: Enterprise, SME, Startup, Non-Profit
   - Default: Enterprise
   - Required: Yes

3. **ERP Engine** (dropdown)
   - Options: ERPNext, Odoo
   - Default: ERPNext
   - Required: Yes
   - **Impact:** Determines which backend engine is provisioned

4. **Description** (textarea)
   - Placeholder: "Brief description of the business..."
   - Required: No
   - Rows: 3

5. **Country Code** (text input)
   - Placeholder: "KE"
   - Required: Yes
   - Max Length: 2
   - Format: 2-letter ISO country code (auto-uppercase)
   - **Impact:** Used for entity code generation and currency mapping

#### **Form Validation:**
- Client-side HTML5 validation
- All required fields must be filled
- Password minimum 8 characters

---

### **Step 3: Fill Administrator Account Details**

#### **Required Fields:**
1. **Admin Full Name** (text input)
   - Placeholder: "John Doe"
   - Required: Yes

2. **Admin Email** (text input)
   - Type: email
   - Placeholder: "admin@company.com"
   - Required: Yes
   - **Behavior:** 
     - If user exists → adds to workspace
     - If new → creates new user account

3. **Admin Password** (password input)
   - Placeholder: "••••••••"
   - Required: Yes
   - Min Length: 8 characters
   - **Note:** Only used if creating new user

---

### **Step 4: Submit Form**

**User Action:** Click "Create Workspace" button

**UI Feedback:**
- Button shows loading state: "Creating..." with spinner
- Form is disabled during submission
- Error messages appear if validation fails

**API Call:**
```http
POST http://localhost:9000/iam/tenants
Content-Type: application/json

{
  "name": "Workspace Name",
  "category": "Enterprise",
  "description": "Description text",
  "country_code": "KE",
  "admin_email": "admin@company.com",
  "admin_name": "Admin Name",
  "admin_password": "password123",
  "engine": "erpnext"
}
```

---

### **Step 5: Backend Processing**

The backend performs the following operations **sequentially**:

#### **5.1 User Creation/Retrieval**
- Checks if user with `admin_email` exists
- **If exists:** Reuses existing user
- **If new:** Creates new user with:
  - Generated user code (format: `USR-{COUNTRY}-{NUMBER}`)
  - Hashed password
  - KYC Tier: "KYC-T1" (basic tier)
  - Status: Active

#### **5.2 Tenant Creation**
- Creates new Tenant record with:
  - Generated tenant code (format: `TEN-{COUNTRY}-{NUMBER}-{RANDOM}`)
  - Name from form
  - Country code
  - Status: "ACTIVE" (immediately active)
  - Engine type (erpnext or odoo)

#### **5.3 ERPNext Company Creation** (if engine = "erpnext")
- **Country Mapping:**
  - KE → Kenya, KES
  - UG → Uganda, UGX
  - TZ → Tanzania, TZS
  - RW → Rwanda, RWF
  - ET → Ethiopia, ETB
- **Company Code:** Generated from tenant name (first 3 letters of each word, max 10 chars)
- **Company Data:**
  - Company name = Tenant name
  - Abbreviation = Generated code
  - Country = Mapped country name
  - Currency = Mapped currency
  - Type = Regular company (not group)
- **Note:** If ERPNext creation fails, tenant creation still succeeds (logged as warning)

#### **5.4 Membership Creation**
- Creates Membership record:
  - Links user to tenant
  - Role: "ADMIN" (legacy role)
  - Status: "ACTIVE"

#### **5.5 RBAC Role Assignment**
- Assigns "OWNER" role to creator:
  - Role code: "OWNER"
  - Assigned by: Self (user.id)
  - Assigned at: Current timestamp
  - Status: Active

#### **5.6 Platform Admin Auto-Add**
- Automatically adds `admin@moran.com` as OWNER:
  - Creates membership if not exists
  - Assigns OWNER role
  - Ensures platform admin has access to all workspaces

#### **5.7 Response Generation**
Backend returns:
```json
{
  "message": "Tenant created successfully",
  "tenant": {
    "id": "uuid",
    "code": "TEN-KE-26-XXXXX",
    "name": "Workspace Name",
    "category": "Enterprise",
    "engine": "erpnext",
    "status": "ACTIVE"
  },
  "admin": {
    "id": "uuid",
    "code": "USR-KE-XX",
    "email": "admin@company.com",
    "full_name": "Admin Name",
    "role": "OWNER"
  },
  "company_created": true,
  "company_name": "Workspace Name"
}
```

---

### **Step 6: Success Screen**

**UI State:** Success card replaces form

**Display Elements:**
1. **Success Icon:** Green checkmark in circular badge
2. **Title:** "Workspace Created Successfully!"
3. **Subtitle:** "Your workspace is now active and ready to use"

4. **Workspace Details Card:**
   - Name
   - Code (monospace font)
   - Category
   - Engine (uppercase)

5. **Admin User Details Card:**
   - Email
   - User Code (monospace font)
   - Role (highlighted in emerald)

6. **Action Buttons:**
   - **Manage Users** → `/admin/users?tenant={id}&name={name}`
   - **Configure Modules** → `/w/{code}/settings/modules`
   - **Go to Dashboard** → `/dashboard`

7. **Auto-redirect Notice:**
   - "Auto-redirecting in 3 seconds..."
   - Countdown timer

---

### **Step 7: Auto-Redirect**

**After 3 seconds:**
- Automatically navigates to `/dashboard`
- Workspace appears in user's workspace list
- Workspace status: **ACTIVE** (immediately available)
- Engine status: **Online** (if engine is running) or **Offline** (if not)

---

### **Step 8: Post-Creation State**

**On Dashboard:**
- New workspace appears in "Your Workspaces" section
- Shows with:
  - Workspace name
  - Workspace code
  - Role badge: "Owner" (cyan highlight)
  - Engine badge: "ERPNext" or "Odoo"
  - Status badge: "Active" (green)
  - Engine connectivity badge: "Online" / "Offline" / "Degraded"

**User Can:**
- Click workspace card to enter workspace
- Access workspace at `/w/{workspace-code}`
- Immediately start using the workspace (no setup required)

---

## 🔄 Error Handling

### **Validation Errors**
- Displayed in red alert box above form
- Shows specific error message from backend
- Form remains editable
- User can correct and resubmit

### **Backend Errors**
- Network errors: Generic "An error occurred" message
- API errors: Backend error detail displayed
- ERPNext creation failures: Logged but don't block tenant creation

### **User Experience:**
- Error messages are clear and actionable
- Form state is preserved (user doesn't lose data)
- User can retry immediately

---

## 🎨 UI/UX Details

### **Visual Design:**
- Dark theme with gradient backgrounds
- Glass-morphism cards with subtle borders
- Cyan/purple gradient accents
- Smooth transitions and animations

### **Loading States:**
- Button spinner during submission
- Form disabled during processing
- Clear visual feedback

### **Success States:**
- Green success indicators
- Detailed information display
- Multiple action options
- Auto-redirect with countdown

---

## 🔐 Security & Permissions

### **Access Control:**
- **Current:** No authentication required (should be added)
- **Should be:** Only authenticated users can create workspaces
- **Future:** Role-based access (e.g., only SUPER_ADMIN or specific roles)

### **Data Security:**
- Passwords are hashed using Argon2
- User emails are validated
- Entity codes are auto-generated (prevents conflicts)

---

## 📊 Data Flow Summary

```
User Input
    ↓
Frontend Form Validation
    ↓
POST /iam/tenants
    ↓
Backend Processing:
  1. Create/Find User
  2. Create Tenant
  3. Create ERPNext Company (if erpnext)
  4. Create Membership
  5. Assign OWNER Role
  6. Add Platform Admin
    ↓
Success Response
    ↓
Frontend Success Screen
    ↓
Auto-redirect to Dashboard
    ↓
Workspace Visible in List
```

---

## 🚀 Key Features

1. **Immediate Activation:** Workspace is ACTIVE immediately (no pending state)
2. **Auto-Provisioning:** ERPNext company created automatically if engine is erpnext
3. **Role Assignment:** Creator automatically becomes OWNER
4. **Platform Admin Access:** admin@moran.com automatically added to all workspaces
5. **Real-time Visibility:** Workspace appears in dashboard immediately
6. **No Setup Required:** Workspace is ready to use immediately

---

## 🔄 Current Limitations

1. **No Authentication Check:** Form is accessible without login
2. **Hardcoded API URL:** Uses `http://localhost:9000` directly
3. **No Workspace Limits:** No check for user's workspace creation limits
4. **No Email Verification:** Admin email not verified
5. **No Onboarding Flow:** No guided setup after creation
6. **No Error Recovery:** Limited error handling for partial failures

---

## 📝 Notes

- Workspace creation is **synchronous** (user waits for completion)
- ERPNext company creation is **best-effort** (tenant created even if company creation fails)
- All workspaces start with **ACTIVE** status
- Creator becomes **OWNER** with full permissions
- Platform admin (`admin@moran.com`) is automatically added to every workspace
