# Category System

KothaBot adapts its entire UI and AI behavior to each merchant's business type. Category is set once during onboarding and drives labels, AI prompts, product fields, and more.

---

## 11 Supported Categories

| Category ID | Display Name | Typical Business |
|---|---|---|
| `clinic` | Clinic / Hospital | Medical practices, dental clinics |
| `salon` | Salon / Spa | Hair salons, beauty spas, nail studios |
| `services` | Services | Repair shops, cleaning, home services |
| `restaurant` | Restaurant / Café | Food service, catering |
| `retail` | Retail / Shop | General merchandise stores |
| `pharmacy` | Pharmacy | Drug stores, medical supplies |
| `real_estate` | Real Estate | Property sales, rentals, agencies |
| `education` | Education | Tutoring, coaching centres, schools |
| `creative_agency` | Creative Agency | Design studios, marketing agencies |
| `grocery` | Grocery Store | Supermarkets, food shops |
| `other` | Other Business | Everything else |

---

## Category-Aware Labels

`lib/category-nav.ts` → `getCategoryNav(category)` returns a `CategoryNav` object:

```typescript
interface CategoryNav {
  productsLabel: string;   // e.g. "Medicines", "Services", "Menu Items"
  ordersLabel:   string;   // e.g. "Appointments", "Orders", "Bookings"
  customersLabel: string;  // e.g. "Patients", "Clients", "Customers"
}
```

### Label Mappings

| Category | Products | Orders | Customers |
|---|---|---|---|
| `clinic` | Treatments | Appointments | Patients |
| `salon` | Services | Appointments | Clients |
| `services` | Services | Bookings | Clients |
| `restaurant` | Menu Items | Orders | Customers |
| `retail` | Products | Orders | Customers |
| `pharmacy` | Medicines | Orders | Customers |
| `real_estate` | Properties | Viewings | Clients |
| `education` | Courses | Enrollments | Students |
| `creative_agency` | Services | Projects | Clients |
| `grocery` | Products | Orders | Customers |
| `other` | Products | Orders | Customers |

---

## Booking Categories

Categories `clinic`, `salon`, and `services` are treated as **booking categories**. This triggers:

- Orders icon swaps to a **Calendar** icon (instead of ShoppingBag)
- Order label becomes **"Appointments"** or **"Bookings"**
- Google Calendar integration is shown (clinic/salon/services only)
- AI is instructed to collect appointment date/time during the call

Check: `catNav?.ordersLabel === 'Appointments' || catNav?.ordersLabel === 'Bookings'`

---

## Category-Aware UI Components

### Sidebar / BottomNav
Both use `labelFor(item)` and `iconFor(item)` helpers that read from the `CategoryNav` object passed as a prop from the dashboard layout.

### Products Page
`app/(dashboard)/products/page.tsx` has a `CATEGORY_CONFIG` map:

```typescript
CATEGORY_CONFIG[category] = {
  productName: 'Medicine',      // singular label
  addLabel: 'Add Medicine',
  fields: ['dosage', 'manufacturer', 'prescription_required'],
  // ... category-specific form fields
}
```

Supported extra fields per category include: `dosage`, `duration`, `prescription_required` (pharmacy/clinic), `cuisine`, `dietary` (restaurant), `property_type`, `bedrooms`, `area_sqft` (real_estate), `subject`, `grade_level` (education), etc.

### Customers Page
Customer list header, empty state message, and form labels adapt based on `customersLabel`.

### Orders Page
Order list header and "New Order" prompt adapt based on `ordersLabel`.

---

## AI Prompt System per Category

`lib/prompt-layers.ts` → `DEFAULT_CATEGORY_PROMPTS` contains a base system prompt for each category:

| Category | Prompt Focus |
|---|---|
| `clinic` | Collect patient name, symptoms, preferred doctor, appointment time |
| `salon` | Collect service type, stylist preference, appointment date/time |
| `restaurant` | Take food/drink orders, note dietary restrictions, table/delivery preference |
| `retail` | Help find products, check availability, process orders |
| `pharmacy` | Verify prescription needs, check stock, process medicine orders |
| `real_estate` | Qualify buyer/renter, note property requirements, book viewings |
| `education` | Explain courses, collect enrollment info, schedule trial classes |
| `creative_agency` | Understand project scope, collect brief, schedule discovery calls |
| `grocery` | Help build grocery list, check availability, arrange delivery/pickup |
| `services` | Understand service need, schedule booking, collect location |
| `other` | General order/inquiry handling |

These are Layer 3 of the [AI 4-Layer Prompt System](AI_SYSTEM.md).

---

## Docs URL per Category

`lib/category-nav.ts` → `getDocsCategory(category)` maps to a docs URL slug:

```
clinic        → clinic
salon         → salon
services      → services
restaurant    → restaurant
retail        → retail
pharmacy      → pharmacy
real_estate   → real-estate
education     → education
creative_agency → creative-agency
grocery       → grocery
other         → other
```

Used in `PageHeader` `docsUrl` prop to link to the right section of `https://kothabot.ai.bd/docs/`.
