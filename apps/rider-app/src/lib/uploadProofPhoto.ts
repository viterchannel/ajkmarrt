import { api } from "./api";

/**
 * Upload a proof photo file to the server via the dedicated /uploads/proof
 * endpoint (riderAuth-gated, multipart/form-data).
 *
 * Returns the public URL of the stored image, which should be passed as
 * `proofPhotoUrl` to the order/ride status update call instead of inlining
 * the raw base64 data URI.
 *
 * Throws if the upload fails or if the server returns no URL.
 */
export async function uploadProofPhoto(file: File): Promise<string> {
  const result = await api.uploadProof(file);
  if (typeof result?.url !== "string" || !result.url.trim()) {
    throw new Error(
      "Photo upload succeeded but server returned no URL — please retake the photo and try again."
    );
  }
  return result.url;
}
