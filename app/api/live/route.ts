import { runLiveAction } from "@/lib/server/live-action";

// Keep the public Route Handler signature conventional. API adapters call
// runLiveAction() only after authenticating their machine credential.
export async function PATCH(request: Request) {
  return runLiveAction(request);
}
