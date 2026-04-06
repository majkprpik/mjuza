"use client";

import dynamic from "next/dynamic";

const LandingClient = dynamic(() => import("./LandingClient"), { ssr: false });

export default function Home() {
  return <LandingClient />;
}
