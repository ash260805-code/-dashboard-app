import { handlers } from "@/lib/auth";

// Force Node.js runtime for this route (not Edge)
export const runtime = "nodejs";

export const { GET, POST } = handlers;
