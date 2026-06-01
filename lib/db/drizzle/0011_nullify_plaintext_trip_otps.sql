-- After the trip OTP hashing fix, existing rides with plaintext OTPs
-- (4-digit numeric strings) will fail verification because the rider app
-- now hashes the entered OTP before comparing.
--
-- Any ride that still has a short (≤10 chars) trip_otp is plaintext.
-- SHA-256 hex digests are always exactly 64 hex characters.
-- Setting trip_otp = NULL forces the customer to request a fresh OTP,
-- which will be stored as a proper hash going forward.
UPDATE "rides"
SET trip_otp = NULL
WHERE trip_otp IS NOT NULL
  AND length(trip_otp) < 64;
