"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const TVClient = dynamic(() => import("./TVClient"), { ssr: false });

export default function RoomTVPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <TVClient roomCode={code.toUpperCase()} />;
}
