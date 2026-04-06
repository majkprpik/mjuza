import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export default async function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("code", code.toUpperCase())
    .single();

  if (!room) {
    notFound();
  }

  return <>{children}</>;
}
