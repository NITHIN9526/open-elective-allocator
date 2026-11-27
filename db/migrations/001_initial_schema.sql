-- Open Elective Portal relational schema (PostgreSQL)
-- Schema only: no real student records, passwords, or Semester 5 courses are seeded.

CREATE TABLE IF NOT EXISTS academic_terms (
  id BIGSERIAL PRIMARY KEY,
  semester SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 6),
  academic_year VARCHAR(7) NOT NULL CHECK (academic_year ~ '^[0-9]{4}-[0-9]{2}$'),
  starts_on DATE,
  ends_on DATE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (semester, academic_year)
);
CREATE UNIQUE INDEX IF NOT EXISTS academic_terms_one_active_idx
  ON academic_terms (is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS departments (
  code VARCHAR(12) PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  prn VARCHAR(40) NOT NULL UNIQUE,
  roll_no VARCHAR(40),
  admission_no VARCHAR(40),
  full_name VARCHAR(150) NOT NULL,
  department_code VARCHAR(12) NOT NULL REFERENCES departments(code),
  mobile VARCHAR(20),
  email VARCHAR(254),
  cgpa NUMERIC(4,2) CHECK (cgpa IS NULL OR cgpa BETWEEN 0 AND 10),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_row INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS students_department_idx ON students(department_code);
CREATE INDEX IF NOT EXISTS students_name_idx ON students USING gin (to_tsvector('simple', full_name));

CREATE TABLE IF NOT EXISTS student_enrollments (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  academic_term_id BIGINT NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (enrollment_status IN ('ACTIVE','COMPLETED','WITHDRAWN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, academic_term_id)
);

CREATE TABLE IF NOT EXISTS student_accounts (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  password_hash TEXT,
  account_status VARCHAR(20) NOT NULL DEFAULT 'NOT_REGISTERED'
    CHECK (account_status IN ('NOT_REGISTERED','PENDING','ACTIVE','REJECTED','SUSPENDED')),
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  profile_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','SUPER_ADMIN')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id BIGSERIAL PRIMARY KEY,
  course_code VARCHAR(40) NOT NULL,
  academic_term_id BIGINT NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  offered_by_department VARCHAR(12) NOT NULL REFERENCES departments(code),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 1000),
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_term_id, course_code)
);

CREATE TABLE IF NOT EXISTS course_preferences (
  id BIGSERIAL PRIMARY KEY,
  student_enrollment_id BIGINT NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  preference_rank SMALLINT NOT NULL CHECK (preference_rank BETWEEN 1 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_enrollment_id, preference_rank),
  UNIQUE (student_enrollment_id, course_id)
);

CREATE TABLE IF NOT EXISTS allocations (
  id BIGSERIAL PRIMARY KEY,
  student_enrollment_id BIGINT NOT NULL UNIQUE REFERENCES student_enrollments(id) ON DELETE CASCADE,
  course_id BIGINT REFERENCES courses(id) ON DELETE RESTRICT,
  cgpa_at_allocation NUMERIC(4,2) CHECK (cgpa_at_allocation IS NULL OR cgpa_at_allocation BETWEEN 0 AND 10),
  preference_rank SMALLINT CHECK (preference_rank IS NULL OR preference_rank BETWEEN 1 AND 6),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PROPOSED','APPROVED','REJECTED','UNALLOCATED')),
  tie_flag BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS allocations_course_status_idx ON allocations(course_id, status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(20) NOT NULL,
  actor_identifier VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS import_batches (
  id BIGSERIAL PRIMARY KEY,
  imported_by BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('xlsx','xls','csv')),
  academic_term_id BIGINT REFERENCES academic_terms(id) ON DELETE RESTRICT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PREVIEW'
    CHECK (status IN ('PREVIEW','COMPLETED','FAILED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS import_errors (
  id BIGSERIAL PRIMARY KEY,
  import_batch_id BIGINT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  source_row INTEGER NOT NULL,
  prn VARCHAR(40),
  error_messages TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS import_errors_batch_idx ON import_errors(import_batch_id);

-- express-session compatible persistent session table.
CREATE TABLE IF NOT EXISTS "session" (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON "session"(expire);
