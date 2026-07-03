declare namespace NodeJS {
  interface ProcessEnv {
    readonly GOOGLE_CALENDAR_CLIENT_ID: string;
    readonly GOOGLE_CALENDAR_CLIENT_SECRET: string;
    readonly NEXT_PUBLIC_APP_URL: string;
  }
}
