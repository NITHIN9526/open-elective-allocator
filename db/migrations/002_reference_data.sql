-- Reference data for Government Polytechnic College, Palakkad.
INSERT INTO departments (code, name) VALUES
 ('CE','Civil Engineering'),
 ('ME','Mechanical Engineering'),
 ('EL','Electronics Engineering'),
 ('CM','Computer Hardware Engineering'),
 ('IE','Instrumentation Engineering'),
 ('EE','Electrical & Electronics Engineering')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Semester 6 is the confirmed project term. No courses are seeded until the
-- official Semester 6 course list is supplied and verified.
INSERT INTO academic_terms (semester, academic_year, is_active)
VALUES (6, '2026-27', TRUE)
ON CONFLICT (semester, academic_year) DO UPDATE SET is_active = TRUE;
