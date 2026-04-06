"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const AddClient = dynamic(() => import("./AddClient"), { ssr: false });

export default function AddPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <AddClient roomCode={code.toUpperCase()} />;
}
