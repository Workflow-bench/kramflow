"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";

export function LockButton() {
  const { lock } = useAuth();
  return (
    <Button variant="secondary" onClick={lock}>
      <LogOut className="h-4 w-4" strokeWidth={2} />
      Log Out
    </Button>
  );
}
