# MoranERP UI Design Reference

## Design Philosophy

### Core Principles
1. **Mobile-First**: Design for mobile, enhance for desktop
2. **Clarity**: Clear visual hierarchy, readable typography
3. **Speed**: Fast interactions, minimal loading states
4. **Accessibility**: WCAG AA compliant, keyboard navigable
5. **Consistency**: Unified patterns across all modules

---

## Visual Identity

### Color System

#### Primary Palette
```
Primary Blue:    #3B82F6 (interactive elements, CTAs)
Primary Dark:    #1E40AF (hover states)
Primary Light:   #DBEAFE (backgrounds, highlights)
```

#### Semantic Colors
```
Success:         #10B981 (confirmations, positive)
Warning:         #F59E0B (alerts, caution)
Error:           #EF4444 (errors, destructive)
Info:            #3B82F6 (information, tips)
```

#### Neutral Palette
```
Gray 900:        #111827 (primary text)
Gray 700:        #374151 (secondary text)
Gray 500:        #6B7280 (muted text)
Gray 300:        #D1D5DB (borders)
Gray 100:        #F3F4F6 (backgrounds)
Gray 50:         #F9FAFB (subtle backgrounds)
```

### Typography

#### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

#### Type Scale
```
Display:    2.25rem (36px)  - Page titles
Heading 1:  1.875rem (30px) - Section headers
Heading 2:  1.5rem (24px)   - Card titles
Heading 3:  1.25rem (20px)  - Subsections
Body:       1rem (16px)     - Body text
Small:      0.875rem (14px) - Secondary text
Tiny:       0.75rem (12px)  - Labels, badges
```

### Spacing System
```
Space 1:    4px   (xs)
Space 2:    8px   (sm)
Space 3:    12px  (md)
Space 4:    16px  (lg)
Space 6:    24px  (xl)
Space 8:    32px  (2xl)
Space 12:   48px  (3xl)
Space 16:   64px  (4xl)
```

### Border Radius
```
Small:      4px   (buttons, inputs)
Medium:     8px   (cards, modals)
Large:      12px  (large cards)
XL:         16px  (panels)
Full:       9999px (pills, avatars)
```

### Shadows
```css
--shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md:  0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg:  0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl:  0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

---

## Component Specifications

### Buttons

#### Primary Button
```
Background:     Primary Blue (#3B82F6)
Text:           White
Padding:        12px 24px
Border Radius:  8px
Font Weight:    600
Min Height:     44px (touch target)

Hover:          Primary Dark (#1E40AF)
Active:         Scale 0.98
Disabled:       50% opacity
```

#### Secondary Button
```
Background:     Gray 100
Text:           Gray 900
Border:         1px Gray 300
```

#### Ghost Button
```
Background:     Transparent
Text:           Gray 700
Hover:          Gray 100 background
```

#### Destructive Button
```
Background:     Error Red (#EF4444)
Text:           White
```

### Cards

#### Standard Card
```
Background:     White (Light) / Gray 900 (Dark)
Border:         1px Gray 200 (Light) / Gray 700 (Dark)
Border Radius:  12px
Padding:        24px
Shadow:         shadow-sm
```

#### Interactive Card
```
Hover:          shadow-md, translateY(-2px)
Transition:     200ms ease-out
Cursor:         pointer
```

#### Stat Card
```
┌─────────────────────────────────┐
│  📈  Revenue                    │
│                                 │
│  KES 125,000                    │
│  ↑ 12.5% from last week         │
└─────────────────────────────────┘

Icon:           24x24, colored background
Title:          text-sm, muted
Value:          text-2xl, bold
Change:         text-sm, green/red
```

### Forms

#### Input Field
```
Height:         44px
Padding:        12px 16px
Border:         1px Gray 300
Border Radius:  8px
Font Size:      16px (prevents zoom on iOS)

Focus:          Blue ring, blue border
Error:          Red border, red ring
Disabled:       Gray background, 50% opacity
```

#### Label
```
Font Size:      14px
Font Weight:    500
Color:          Gray 700
Margin Bottom:  6px
```

#### Error Message
```
Font Size:      12px
Color:          Error Red
Margin Top:     4px
Icon:           ⚠ (optional)
```

### Tables (Desktop)

```
┌──────────────────────────────────────────────────────┐
│  Item Code    │  Name           │  Stock  │  Actions │
├──────────────────────────────────────────────────────┤
│  ITM-001      │  Widget A       │  100    │  ⚙ ✏ 🗑  │
│  ITM-002      │  Widget B       │  50     │  ⚙ ✏ 🗑  │
│  ITM-003      │  Widget C       │  0  ⚠   │  ⚙ ✏ 🗑  │
└──────────────────────────────────────────────────────┘

Header:         Gray 50 background, bold text
Row:            White background, hover Gray 50
Border:         1px Gray 200 between rows
Actions:        Icon buttons, 32x32, hover background
```

### Data Cards (Mobile)

```
┌─────────────────────────────────┐
│  Widget A                    ⋮  │
│  ITM-001                        │
│                                 │
│  Stock: 100  │  Price: KES 500  │
│                                 │
│  [Edit]  [Delete]               │
└─────────────────────────────────┘

Title:          text-lg, bold
Subtitle:       text-sm, muted
Metadata:       Grid, 2 columns
Actions:        Buttons or swipe actions
```

---

## Page Layouts

### Desktop Layout (>1024px)
```
┌────────────────────────────────────────────────────────────┐
│  ┌────────────┐  ┌──────────────────────────────────────┐ │
│  │            │  │  Header                              │ │
│  │  Sidebar   │  ├──────────────────────────────────────┤ │
│  │            │  │                                      │ │
│  │  • Home    │  │  Content Area                        │ │
│  │  • POS     │  │                                      │ │
│  │  • Inv     │  │  (scrollable)                        │ │
│  │  • Sales   │  │                                      │ │
│  │  • ...     │  │                                      │ │
│  │            │  │                                      │ │
│  └────────────┘  └──────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘

Sidebar:        256px fixed
Content:        Fluid
Header:         64px fixed
```

### Tablet Layout (768px-1024px)
```
┌──────────────────────────────────────────────────┐
│  ┌──────┐  ┌──────────────────────────────────┐ │
│  │      │  │  Header                          │ │
│  │ Icon │  ├──────────────────────────────────┤ │
│  │ Nav  │  │                                  │ │
│  │      │  │  Content Area                    │ │
│  │      │  │                                  │ │
│  │      │  │                                  │ │
│  │      │  │                                  │ │
│  └──────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────┘

Sidebar:        64px (icons only), expandable on hover
Content:        Fluid
```

### Mobile Layout (<768px)
```
┌──────────────────────────┐
│  Header             ≡    │
├──────────────────────────┤
│                          │
│  Content Area            │
│                          │
│  (scrollable)            │
│                          │
│                          │
├──────────────────────────┤
│  🏠  📦  💳  📊  ⚙      │
└──────────────────────────┘

Header:         56px fixed
Bottom Nav:     64px fixed + safe area
Content:        calc(100vh - 120px - safe-area)
```

---

## POS Interface Design

### Desktop POS
```
┌────────────────────────────────────────────────────────────────────┐
│  🔍 Search products...     │  Categories ▼  │  👤 Customer ▼  │ ≡ │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  ┌────────────────────┐ │
│  │  All  │ Food │ Drinks │ Paint │ More │  │  🛒 Cart (3)       │ │
│  ├──────────────────────────────────────┤  ├────────────────────┤ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │  │                    │ │
│  │  │  📷     │ │  📷     │ │  📷     │ │  │  ┌──────────────┐  │ │
│  │  │ Prod 1  │ │ Prod 2  │ │ Prod 3  │ │  │  │ Item 1    x2 │  │ │
│  │  │ KES 100 │ │ KES 150 │ │ KES 200 │ │  │  │ KES 200   ✕  │  │ │
│  │  │ In Stock│ │ Low ⚠   │ │ Out ✕   │ │  │  └──────────────┘  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ │  │  ┌──────────────┐  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ │  │  │ Item 2    x1 │  │ │
│  │  │  📷     │ │  📷     │ │  📷     │ │  │  │ KES 150   ✕  │  │ │
│  │  │ Prod 4  │ │ Prod 5  │ │ Prod 6  │ │  │  └──────────────┘  │ │
│  │  │ KES 250 │ │ KES 300 │ │ KES 350 │ │  │                    │ │
│  │  │ In Stock│ │ In Stock│ │ In Stock│ │  │  ────────────────  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ │  │  Subtotal  KES 350 │ │
│  │                                      │  │  VAT 16%    KES 56 │ │
│  │          [Load More...]              │  │  ────────────────  │ │
│  └──────────────────────────────────────┘  │  Total     KES 406 │ │
│                                            │                    │ │
│                                            │  ┌──────────────┐  │ │
│                                            │  │  💳 CASH     │  │ │
│                                            │  │  📱 M-PESA   │  │ │
│                                            │  │  💳 CARD     │  │ │
│                                            │  └──────────────┘  │ │
│                                            │                    │ │
│                                            │  [Complete Sale]   │ │
│                                            └────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### Mobile POS
```
┌─────────────────────────────┐
│  🔍      [Categories ▼]  ≡ │
├─────────────────────────────┤
│                             │
│  ┌─────────┐ ┌─────────┐   │
│  │  📷     │ │  📷     │   │
│  │ Prod 1  │ │ Prod 2  │   │
│  │ KES 100 │ │ KES 150 │   │
│  └─────────┘ └─────────┘   │
│                             │
│  ┌─────────┐ ┌─────────┐   │
│  │  📷     │ │  📷     │   │
│  │ Prod 3  │ │ Prod 4  │   │
│  │ KES 200 │ │ KES 250 │   │
│  └─────────┘ └─────────┘   │
│                             │
│  ┌─────────┐ ┌─────────┐   │
│  │  📷     │ │  📷     │   │
│  │ Prod 5  │ │ Prod 6  │   │
│  │ KES 300 │ │ KES 350 │   │
│  └─────────┘ └─────────┘   │
│                             │
├─────────────────────────────┤
│  🛒 Cart (3)      KES 406  │
│  [View Cart & Pay]         │
└─────────────────────────────┘

Cart opens as bottom sheet:

┌─────────────────────────────┐
│  ─────  (drag handle)       │
│                             │
│  🛒 Your Cart               │
│                             │
│  Item 1          x2  KES 200│
│  Item 2          x1  KES 150│
│                             │
│  ────────────────────────── │
│  Subtotal           KES 350 │
│  VAT 16%             KES 56 │
│  Total              KES 406 │
│                             │
│  Payment Method:            │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │CASH │ │MPESA│ │CARD │   │
│  └─────┘ └─────┘ └─────┘   │
│                             │
│  [Complete Sale]            │
└─────────────────────────────┘
```

### Product Card Component
```
┌─────────────────────┐
│  ┌───────────────┐  │
│  │               │  │
│  │     📷       │  │  Image: 1:1 ratio
│  │               │  │  Object-fit: cover
│  └───────────────┘  │
│                     │
│  Product Name       │  Font: 14px, medium
│                     │
│  KES 1,500          │  Font: 18px, bold
│                     │
│  ●●● In Stock       │  Stock indicator
│  ●●○ Low Stock      │  (green/yellow/red)
│  ○○○ Out of Stock   │
│                     │
│  [+ Add]            │  Quick add button
└─────────────────────┘

Dimensions:
- Card: 160px min-width
- Image: 120px height
- Padding: 12px
- Border Radius: 12px
```

---

## Dashboard Design

### Widgets

#### Metric Widget
```
┌─────────────────────────────────┐
│  📈  Today's Revenue            │
│                                 │
│  KES 125,450                    │
│                                 │
│  ↑ 12.5%  vs yesterday          │
│  ■■■■■■■■░░  75% of target      │
└─────────────────────────────────┘
```

#### Chart Widget
```
┌─────────────────────────────────────────┐
│  Sales Overview           [Week ▼]      │
├─────────────────────────────────────────┤
│                                         │
│    │    ╭─╮                            │
│    │   ╭╯ ╰╮  ╭──╮                     │
│    │  ╭╯   ╰──╯  ╰──╮╭──╮             │
│    │──╯              ╰╯  ╰──           │
│    └────────────────────────           │
│      Mon Tue Wed Thu Fri Sat Sun       │
│                                         │
└─────────────────────────────────────────┘
```

#### Activity Widget
```
┌─────────────────────────────────┐
│  Recent Activity                │
├─────────────────────────────────┤
│  🧾 Invoice #1234 created       │
│     2 minutes ago               │
│  ─────────────────────────────  │
│  👤 New customer: John Doe      │
│     15 minutes ago              │
│  ─────────────────────────────  │
│  📦 Stock received: 50 items    │
│     1 hour ago                  │
│  ─────────────────────────────  │
│  [View All Activity →]          │
└─────────────────────────────────┘
```

---

## Animation Guidelines

### Timing Functions
```css
--ease-in:      cubic-bezier(0.4, 0, 1, 1);
--ease-out:     cubic-bezier(0, 0, 0.2, 1);
--ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);
--spring:       cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Duration Scale
```
Instant:    100ms   (micro-interactions)
Fast:       150ms   (hover, focus)
Normal:     200ms   (toggles, reveals)
Slow:       300ms   (modals, page transitions)
Deliberate: 500ms   (complex animations)
```

### Animation Types

#### Micro-interactions
```
Button press:   scale(0.98), 100ms
Hover lift:     translateY(-2px), 150ms
Focus ring:     outline expand, 150ms
Toggle:         slide, 200ms
```

#### Page Transitions
```
Enter:          fadeIn + slideUp, 300ms
Exit:           fadeOut, 200ms
Modal:          fadeIn + scale(0.95→1), 300ms
Drawer:         slideIn, 300ms
```

#### Loading States
```
Skeleton:       shimmer animation, infinite
Spinner:        rotate, 1s linear infinite
Progress:       width transition, 200ms
```

---

## Accessibility Checklist

### Color Contrast
- [ ] Text contrast ratio ≥ 4.5:1 (normal)
- [ ] Text contrast ratio ≥ 3:1 (large text)
- [ ] UI component contrast ≥ 3:1
- [ ] Focus indicator contrast ≥ 3:1

### Keyboard Navigation
- [ ] All interactive elements focusable
- [ ] Visible focus indicators
- [ ] Logical tab order
- [ ] Skip links for main content
- [ ] Escape closes modals
- [ ] Arrow keys for menus

### Screen Readers
- [ ] Semantic HTML elements
- [ ] ARIA labels on icons/buttons
- [ ] ARIA live regions for updates
- [ ] Proper heading hierarchy
- [ ] Alt text for images

### Touch Targets
- [ ] Minimum 44x44px touch targets
- [ ] Adequate spacing between targets
- [ ] Touch feedback animations

---

## Responsive Breakpoints

```css
/* Mobile first approach */

/* Small phones */
@media (min-width: 320px) { }

/* Large phones */
@media (min-width: 480px) { }

/* Tablets */
@media (min-width: 768px) { }

/* Small desktops */
@media (min-width: 1024px) { }

/* Large desktops */
@media (min-width: 1280px) { }

/* Extra large */
@media (min-width: 1536px) { }
```

### Breakpoint Utilities (Tailwind)
```
sm:   640px   (small tablets)
md:   768px   (tablets)
lg:   1024px  (laptops)
xl:   1280px  (desktops)
2xl:  1536px  (large desktops)
```

---

## Dark Mode

### Automatic Switching
```typescript
// System preference detection
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

// Manual toggle with localStorage
const theme = localStorage.getItem('theme') || 'system';
```

### Color Adjustments
- Reduce brightness of pure white (#fff → #f9fafb)
- Soften shadows (reduce opacity)
- Adjust image brightness (filter: brightness(0.9))
- Invert semantic colors (success stays green, but different shade)

---

*This design reference should be used alongside the implementation plan to ensure consistent UI development.*
