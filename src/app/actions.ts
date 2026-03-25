"use server";

import { fetchTrackingInfo, getTrackingLink } from "@/lib/tracking";

// The Google Sheet sync function has been removed as per request.
// In the future, this file can be used for other server actions.

// Action to get tracking info - useful for Client Components
export async function getTrackingDetails(courier: string, trackingId: string) {
  const info = await fetchTrackingInfo(courier, trackingId);
  const link = getTrackingLink(courier, trackingId);
  return { info, link };
}
