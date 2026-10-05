import { notFound } from "next/navigation";
import { ConsoleStub } from "./stub";

// SYNTHETIC stub of the Console landing for the import harness. Development only
// (404 in production). Shows which session the controlled store has made live.
export default function ConsoleStubPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ConsoleStub />;
}
