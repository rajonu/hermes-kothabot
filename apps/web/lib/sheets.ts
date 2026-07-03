/**
 * Google Sheets integration module for KothaBot Lite
 *
 * Features:
 * - OAuth flow using existing Google Calendar plumbing
 * - Read sync: every 5 minutes, pull products + schedule from sheet → upsert into products table
 * - Write-back: when AI books an appointment/order, append a row to the client's sheet
 * - Integrations page UI: connect button, sheet picker, column mapping
 */

export type SheetIntegration = {
  id: string;
  shop_id: string;
  sheet_id: string;
  refresh_token: string; // encrypted
  tab_name: string;
  columns: {
    product_name?: string;
    product_price?: string;
    product_description?: string;
    product_category?: string;
    schedule_date?: string;
    schedule_time?: string;
    schedule_doctor?: string;
    order_customer?: string;
    order_items?: string;
    order_total?: string;
    order_status?: string;
  };
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export const SHEET_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
];

export const DEFAULT_COLUMN_MAPPING = {
  product_name: 'Product Name',
  product_price: 'Price',
  product_description: 'Description',
  product_category: 'Category',
  schedule_date: 'Date',
  schedule_time: 'Time',
  schedule_doctor: 'Doctor',
  order_customer: 'Customer',
  order_items: 'Items',
  order_total: 'Total',
  order_status: 'Status',
};
