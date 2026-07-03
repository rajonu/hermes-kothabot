import { getPlatformSettings } from '@/lib/platform-settings';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const settings = await getPlatformSettings();
  return <OnboardingForm enabledCategories={settings.enabled_categories} />;
}
