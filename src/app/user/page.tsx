"use client";

import dynamic from "next/dynamic";

const UserClient = dynamic(() => import("./UserClient"), { ssr: false });

export default function UserPage() {
  return <UserClient />;
}
