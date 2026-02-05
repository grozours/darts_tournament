-- Replace unique email index with composite (email, phone)
DROP INDEX IF EXISTS "persons_email_key";
CREATE UNIQUE INDEX "persons_email_phone_key" ON "persons"("email", "phone");
