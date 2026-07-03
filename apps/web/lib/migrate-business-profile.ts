/**
 * One-time migration script to consolidate training_data into business_profile
 * Run this once after deploying the business_profile column
 */

import { createServerClient } from '@/lib/supabase/server';

async function migrateTrainingDataToBusinessProfile() {
  const supabase = await createServerClient();
  
  // Get all shops
  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id, name')
    .not('onboarding_done', 'is', false); // Only migrated shops
    
  if (shopsError) {
    console.error('Error fetching shops:', shopsError);
    return;
  }
  
  console.log(`Found ${shops?.length ?? 0} shops to process`);
  
  for (const shop of shops ?? []) {
    // Get all training data for this shop
    const { data: trainingData, error: trainingError } = await supabase
      .from('training_data')
      .select<{ extracted_text: string; source_type: string }>('extracted_text, source_type')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: true });
      
    if (trainingError) {
      console.error(`Error fetching training data for shop ${shop.id}:`, trainingError);
      continue;
    }
    
    if (!trainingData || trainingData.length === 0) {
      console.log(`No training data found for shop ${shop.id} (${shop.name})`);
      continue;
    }
    
    // Combine all training data into a business profile
    // We'll organize it by source type for clarity
    const websiteContent = trainingData
      .filter((item: any) => item.source_type === 'website')
      .map((item: any) => item.extracted_text)
      .join('\n\n');
      
    const facebookContent = trainingData
      .filter((item: any) => item.source_type === 'facebook')
      .map((item: any) => item.extracted_text)
      .join('\n\n');
      
    const manualContent = trainingData
      .filter((item: any) => item.source_type === 'manual' || item.source_type === 'faq')
      .map((item: any) => item.extracted_text)
      .join('\n\n');
      
    // Build the business profile with sections
    const businessProfileParts: string[] = [];
    
    if (websiteContent.trim()) {
      businessProfileParts.push(`## Business Information\n${websiteContent}`);
    }
    
    if (facebookContent.trim()) {
      businessProfileParts.push(`## Additional Information (from Facebook)\n${facebookContent}`);
    }
    
    if (manualContent.trim()) {
      businessProfileParts.push(`## Notes & FAQ\n${manualContent}`);
    }
    
    const businessProfile = businessProfileParts.join('\n\n---\n\n');
    
    // Update the shop with the business profile
    const { error: updateError } = await supabase
      .from('shops')
      .update({ business_profile: businessProfile || null })
      .eq('id', shop.id);
      
    if (updateError) {
      console.error(`Error updating shop ${shop.id}:`, updateError);
    } else {
      console.log(`Successfully updated shop ${shop.id} (${shop.name})`);
    }
  }
  
  console.log('Migration completed!');
}

// Run the migration
migrateTrainingDataToBusinessProfile().catch(console.error);