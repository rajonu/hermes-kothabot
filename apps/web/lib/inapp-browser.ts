export type InAppBrowserType = 'facebook' | 'messenger' | 'instagram' | null;

export function getInAppBrowserType(): InAppBrowserType {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/Messenger/i.test(ua)) return 'messenger';
  if (/FBAN|FBAV/i.test(ua)) return 'facebook';
  if (/Instagram/i.test(ua)) return 'instagram';
  return null;
}

export function isInAppBrowser(): boolean {
  return getInAppBrowserType() !== null;
}

export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function getAndroidIntentUrl(url: string): string {
  // Strip protocol to get path used in intent URL
  const withoutProtocol = url.replace(/^https?:\/\//, '');
  return `intent://${withoutProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
}
