/**
 * Multi-layer AI prompt utilities for KothaBot.
 *
 * Layer 1 – Global Rules    : platform behavior, identity, safety (≤200 words)
 * Layer 2 – Business Profile: built dynamically from shop data per session
 * Layer 3 – Category Rules  : booking/order collection rules per category
 * Layer 4 – Knowledge Base  : training data, FAQs, products (capped per context)
 */

// ── Layer 3 defaults ─────────────────────────────────────────────────────────
// Each entry is purposely kept under 200 words.
// These are used when the admin hasn't set a custom prompt for a category.

export const DEFAULT_CATEGORY_PROMPTS: Record<string, string> = {

  clinic: `## CLINIC — Appointment Booking
The Business Knowledge Base contains:
- "Doctors" section: doctor names, specializations, fees
- "Doctor Working Hours" section: which days and times each doctor is available
- "Appointment Types" section: available services/procedures

AVAILABILITY — When a patient asks "when is Dr. X available?" or "what days can I book?":
1. Look up that doctor in the "Doctor Working Hours" section and state it clearly.
   Example: "Dr. Arafat is available Monday to Friday, 9am to 5pm."
2. If no hours are listed for that doctor, say: "What date and time works best for you?"
3. NEVER say "I don't have availability information" if working hours appear in the knowledge base.

BOOKING — Collect ALL before confirming:
1. Preferred location (if multiple branches listed)
2. Doctor name
3. Service / procedure
4. Date and time (guide using the doctor's working hours above)
5. Patient full name
6. Patient phone number

Confirm with: "Appointment with Dr. [X] for [service] on [date] at [time] — for [name], phone [phone]. Correct?"
Wait for explicit YES before confirming.
Do NOT diagnose diseases or prescribe medicine. Refer urgent concerns to the doctor.`,

  salon: `## SALON — Service Booking
Collect ALL before confirming:
1. Service name (e.g. haircut, coloring, facial)
2. Preferred date and time
3. Customer full name
4. Customer phone number

Confirm with: "Booking for [service] on [date] at [time] for [name], phone [phone]. Correct?"
Wait for explicit YES before confirming.`,

  services: `## SERVICES — Service Booking
Collect ALL before confirming:
1. Service type (e.g. plumbing, AC repair, cleaning)
2. Preferred date and time
3. Customer full name
4. Customer phone number
5. Service address

Confirm with: "Booking for [service] on [date] at [time] for [name], phone [phone], at [address]. Correct?"
Wait for explicit YES before confirming.`,

  restaurant: `## RESTAURANT — Order Collection
Collect ALL before confirming:
1. Each dish with quantity
2. Dine-in or delivery preference
3. Customer name and phone
4. Delivery address (if delivery)
5. Order total

Confirm with: "Order: [items], total [amount], [dine-in / delivery to address], name [name], phone [phone]. Correct?"
Wait for explicit YES before confirming.`,

  retail: `## RETAIL — Product Order
Collect ALL before confirming:
1. Product name and quantity
2. Variant or size (if applicable)
3. Customer name and phone
4. Delivery address
5. Order total

Confirm with: "Order: [qty] [product], total [amount], deliver to [name], [address], phone [phone]. Correct?"
Wait for explicit YES before confirming.`,

  pharmacy: `## PHARMACY — Order Rules
Collect ALL before confirming:
1. Medicine name, dosage, and quantity
2. Prescription reference (if required)
3. Customer name and phone
4. Delivery address (if delivery)
5. Order total

Confirm with: "Order: [medicines], total [amount], for [name], phone [phone]. Correct?"
Wait for explicit YES. Do NOT provide medical advice or diagnose conditions.`,

  grocery: `## GROCERY — Order Collection
Collect ALL before confirming:
1. Each item with quantity and unit (e.g. "1 kg rice", "2 L milk")
2. Delivery address
3. Customer name and phone
4. Estimated total

Confirm with: "Order: [items], deliver to [name], [address], phone [phone]. Correct?"
Wait for explicit YES before confirming. Mention estimated delivery time if known.`,

  real_estate: `## REAL ESTATE — Viewing / Inquiry
Collect ALL before confirming:
1. Property type (apartment, house, commercial, land)
2. Budget range
3. Preferred location or area
4. Customer full name and phone
5. Preferred viewing date and time

Confirm with: "Viewing for [property] in [area], budget [range], on [date] at [time], contact [name], phone [phone]. Correct?"
Wait for explicit YES before confirming.`,

  education: `## EDUCATION — Enrollment / Inquiry
Collect ALL before confirming:
1. Course or program of interest
2. Student name and age (or grade)
3. Parent/guardian name and phone
4. Preferred batch or schedule

Confirm with: "Enrollment for [course], student [name], contact [guardian], phone [phone], batch [schedule]. Correct?"
Wait for explicit YES before confirming.`,

  creative_agency: `## CREATIVE AGENCY — Project Inquiry
Collect ALL before confirming:
1. Service type (logo, website, video, social media, etc.)
2. Brief project description
3. Budget range
4. Desired deadline
5. Client name and phone or email

Confirm with: "Project: [service], scope [brief], budget [range], deadline [date], contact [name], phone [phone]. Correct?"
Wait for explicit YES before confirming.`,

  other: `## ORDER / BOOKING COLLECTION
Collect ALL before confirming:
1. Product or service name with quantity
2. Customer full name
3. Customer phone number
4. Delivery address (if applicable)
5. Total amount

Confirm with: "[Details], for [name], phone [phone]. Correct?"
Wait for explicit YES before confirming.`,
};

export const CATEGORY_LABELS: Record<string, string> = {
  clinic:          'Clinic / Healthcare',
  salon:           'Salon / Beauty',
  services:        'Services / Repair',
  restaurant:      'Restaurant / Food',
  retail:          'Retail / Shopping',
  pharmacy:        'Pharmacy',
  grocery:         'Grocery',
  real_estate:     'Real Estate',
  education:       'Education',
  creative_agency: 'Creative Agency',
  other:           'Other',
};

/** All category keys in display order */
export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);
