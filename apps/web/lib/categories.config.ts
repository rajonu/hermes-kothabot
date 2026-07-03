// To enable a category: set enabled: true
// To disable: set enabled: false
// Admin override can still assign any category regardless of this toggle.

export const CATEGORIES_CONFIG = [
  { value: 'clinic',          label: 'Clinic / Healthcare',  emoji: '🏥', enabled: true },
  { value: 'salon',           label: 'Salon / Beauty',       emoji: '💇', enabled: true },
  { value: 'services',        label: 'Services / Repair',    emoji: '🔧', enabled: true },
  { value: 'restaurant',      label: 'Restaurant / Food',    emoji: '🍽️', enabled: true },
  { value: 'retail',          label: 'Retail / Shopping',    emoji: '🛍️', enabled: true },
  { value: 'pharmacy',        label: 'Pharmacy',             emoji: '💊', enabled: true },
  { value: 'real_estate',     label: 'Real Estate',          emoji: '🏠', enabled: true },
  { value: 'education',       label: 'Education',            emoji: '🎓', enabled: true },
  { value: 'creative_agency', label: 'Creative Agency',      emoji: '🎨', enabled: true },
  { value: 'grocery',         label: 'Grocery / Mart',       emoji: '🛒', enabled: true },
  { value: 'other',           label: 'Other',                emoji: '📦', enabled: true },
] as const;

// Only categories shown on the signup form
export const ENABLED_CATEGORIES = CATEGORIES_CONFIG.filter(c => c.enabled);

// All category values (used by admin override — can assign any)
export const ALL_CATEGORY_VALUES = CATEGORIES_CONFIG.map(c => c.value);
