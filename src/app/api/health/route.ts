import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type HealthStatus = {
  app: "ok";
  database: "ok" | "not_configured" | "error";
  detail?: string;
  timestamp: string;
};

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const base = { app: "ok" as const, timestamp: new Date().toISOString() };
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ ...base, database: "not_configured" });
  }

  const { error } = await supabase.from("health_check").select("id").limit(1);

  if (error) {
    return NextResponse.json(
      { ...base, database: "error", detail: error.message },
      { status: 503 },
    );
  }

  return NextResponse.json({ ...base, database: "ok" });
}
