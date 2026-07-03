// ── Category-aware navigation labels ──────────────────────────────────────
// Used in Sidebar, BottomNav, page headers, and dashboard stats.

export interface CategoryNav {
  /** Nav label for the Products/Menu/Services route */
  productsLabel:  string;
  /** Nav label for the Orders/Appointments/Bookings route */
  ordersLabel:    string;
  /** Dashboard stat label for orders count */
  ordersStat:     string;
  /** Dashboard stat label for products count */
  productsStat:   string;
  /** Dashboard stat label for customers (e.g. "Patients" for clinic) */
  customersLabel: string;
  /** Singular label for one record (e.g. "Appointment", "Booking", "Order") */
  orderSingular:  string;
  /** Emoji for the products section */
  productsEmoji:  string;
  /** Emoji for the orders section */
  ordersEmoji:    string;
}

const NAV_CONFIG: Record<string, CategoryNav> = {
  restaurant: {
    productsLabel:  'Menu',
    ordersLabel:    'Orders',
    ordersStat:     'Orders',
    productsStat:   'Menu Items',
    customersLabel: 'Customers',
    orderSingular:  'Order',
    productsEmoji:  '🍽️',
    ordersEmoji:    '🛒',
  },
  retail: {
    productsLabel:  'Products',
    ordersLabel:    'Orders',
    ordersStat:     'Orders',
    productsStat:   'Products',
    customersLabel: 'Customers',
    orderSingular:  'Order',
    productsEmoji:  '🛍️',
    ordersEmoji:    '🛒',
  },
  grocery: {
    productsLabel:  'Products',
    ordersLabel:    'Orders',
    ordersStat:     'Orders',
    productsStat:   'Products',
    customersLabel: 'Customers',
    orderSingular:  'Order',
    productsEmoji:  '🛒',
    ordersEmoji:    '🛒',
  },
  clinic: {
    productsLabel:  'Tests',
    ordersLabel:    'Appointments',
    ordersStat:     'Appointments',
    productsStat:   'Tests',
    customersLabel: 'Patients',
    orderSingular:  'Appointment',
    productsEmoji:  '🧪',
    ordersEmoji:    '📅',
  },
  pharmacy: {
    productsLabel:  'Medicines',
    ordersLabel:    'Orders',
    ordersStat:     'Orders',
    productsStat:   'Medicines',
    customersLabel: 'Customers',
    orderSingular:  'Order',
    productsEmoji:  '💊',
    ordersEmoji:    '🛒',
  },
  salon: {
    productsLabel:  'Services',
    ordersLabel:    'Bookings',
    ordersStat:     'Bookings',
    productsStat:   'Services',
    customersLabel: 'Customers',
    orderSingular:  'Booking',
    productsEmoji:  '✂️',
    ordersEmoji:    '📅',
  },
  services: {
    productsLabel:  'Services',
    ordersLabel:    'Bookings',
    ordersStat:     'Bookings',
    productsStat:   'Services',
    customersLabel: 'Customers',
    orderSingular:  'Booking',
    productsEmoji:  '🔧',
    ordersEmoji:    '📅',
  },
  real_estate: {
    productsLabel:  'Properties',
    ordersLabel:    'Leads',
    ordersStat:     'Leads',
    productsStat:   'Properties',
    customersLabel: 'Clients',
    orderSingular:  'Lead',
    productsEmoji:  '🏠',
    ordersEmoji:    '📋',
  },
  education: {
    productsLabel:  'Courses',
    ordersLabel:    'Admissions',
    ordersStat:     'Admissions',
    productsStat:   'Courses',
    customersLabel: 'Students',
    orderSingular:  'Admission',
    productsEmoji:  '🎓',
    ordersEmoji:    '📝',
  },
  creative_agency: {
    productsLabel:  'Services',
    ordersLabel:    'Projects',
    ordersStat:     'Projects',
    productsStat:   'Services',
    customersLabel: 'Clients',
    orderSingular:  'Project',
    productsEmoji:  '🎨',
    ordersEmoji:    '💼',
  },
  other: {
    productsLabel:  'Products',
    ordersLabel:    'Orders',
    ordersStat:     'Orders',
    productsStat:   'Products',
    customersLabel: 'Customers',
    orderSingular:  'Order',
    productsEmoji:  '📦',
    ordersEmoji:    '🛒',
  },
};

export function getCategoryNav(category?: string | null): CategoryNav {
  return NAV_CONFIG[category ?? 'other'] ?? NAV_CONFIG.other;
}

const DOCS_CATEGORY_MAPPING: Record<string, string> = {
  clinic: 'clinic-healthcare',
  salon: 'salon-beauty',
  services: 'services-repair',
  restaurant: 'restaurant-food',
  retail: 'retail-shopping',
  pharmacy: 'pharmacy',
  real_estate: 'real-estate',
  education: 'education',
  creative_agency: 'creative-agency',
  grocery: 'grocery-mart',
  other: 'other-general'
};

export function getDocsCategory(category?: string | null): string {
  return DOCS_CATEGORY_MAPPING[category ?? 'other'] ?? 'other-general';
}
