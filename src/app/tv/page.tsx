"use client";

import dynamic from "next/dynamic";

const TVClient = dynamic(() => import("./TVClient"), { ssr: false });

export default function TVPage() {
  return <TVClient />;
}
