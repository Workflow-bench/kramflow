import { notFound } from "next/navigation";

// SYNTHETIC stub of the Console landing for the import harness. Development only
// (404 in production). Shows which session the controlled store has made live.

// Production build: the stub module is not imported (see the dev branch).
export default async function ConsoleStubPage() {
  if (process.env.NODE_ENV !== "production") {
    const { ConsoleStub } = await import("./stub");
    return <ConsoleStub />;
  }
  notFound();
}
