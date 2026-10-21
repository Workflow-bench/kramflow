"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/components/ui/toast";

export function LockButton() {
  const { lock } = useAuth();
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        const ok = await lock();
        if (!ok) toast.error("Couldn't log out. Try again.");
      }}
    >
      <LogOut className="h-4 w-4" strokeWidth={2} />
      Log out
    </Button>
  );
}
