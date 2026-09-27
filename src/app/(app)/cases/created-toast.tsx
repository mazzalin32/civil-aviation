"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toast } from "@/components/ui/toast";

export function CreatedToast({ reference }: { reference: string }) {
  const router = useRouter();
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <Toast
      message={`Case ${reference} created.`}
      onDismiss={() => {
        setShow(false);
        router.replace("/cases");
      }}
    />
  );
}
