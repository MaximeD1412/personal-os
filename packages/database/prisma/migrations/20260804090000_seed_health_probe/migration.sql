-- Pose la sonde technique lue par le fil traceur du squelette applicatif.
-- Conforme à l'ADR 0024 : cette migration ajoute, elle n'enlève rien.
INSERT INTO "HealthProbe" ("id", "label", "recordedAt")
SELECT gen_random_uuid(), 'Personal OS', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "HealthProbe");
