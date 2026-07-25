import { AuthProvider } from "@/components/auth/auth-context";
import { PinGate } from "@/components/auth/pin-gate";
import { CommandPalette } from "@/components/operator/command-palette";

export default function OperatorGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PinGate>{children}</PinGate>
      <CommandPalette />
    </AuthProvider>
  );
}
