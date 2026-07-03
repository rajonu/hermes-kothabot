import { NextResponse } from "next/server";
import { APP_VERSION, BUILD_NUMBER, RELEASE_DATE } from "@/lib/version";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: APP_VERSION,
    build: BUILD_NUMBER,
    released: RELEASE_DATE,
    timestamp: new Date().toISOString(),
  });
}
