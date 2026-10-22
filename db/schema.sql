CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, username VARCHAR(20) UNIQUE NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
 email VARCHAR(254) UNIQUE, phone VARCHAR(11) UNIQUE, password_hash TEXT NOT NULL, display_name VARCHAR(40) NOT NULL,
 avatar_color VARCHAR(7) NOT NULL DEFAULT '#35b86b', role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 is_verified BOOLEAN NOT NULL DEFAULT false, is_banned BOOLEAN NOT NULL DEFAULT false, banned_reason TEXT, banned_at TIMESTAMPTZ,
 xp INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 1, hearts INTEGER NOT NULL DEFAULT 5, hearts_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 streak INTEGER NOT NULL DEFAULT 0, longest_streak INTEGER NOT NULL DEFAULT 0, last_active_date DATE, last_login_at TIMESTAMPTZ,
 hide_from_leaderboard BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS courses (id BIGSERIAL PRIMARY KEY, slug VARCHAR(80) UNIQUE NOT NULL, title VARCHAR(120) NOT NULL, description TEXT NOT NULL DEFAULT '', icon VARCHAR(20) NOT NULL DEFAULT '📘', order_index INTEGER NOT NULL DEFAULT 0, is_published BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS units (id BIGSERIAL PRIMARY KEY, course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE, title VARCHAR(120) NOT NULL, description TEXT NOT NULL DEFAULT '', order_index INTEGER NOT NULL DEFAULT 0, is_published BOOLEAN NOT NULL DEFAULT true, UNIQUE(course_id, order_index));
CREATE TABLE IF NOT EXISTS lessons (id BIGSERIAL PRIMARY KEY, unit_id BIGINT NOT NULL REFERENCES units(id) ON DELETE CASCADE, title VARCHAR(160) NOT NULL, intro TEXT NOT NULL, exercises JSONB NOT NULL DEFAULT '[]', xp_reward INTEGER NOT NULL DEFAULT 15, order_index INTEGER NOT NULL DEFAULT 0, is_published BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS lesson_progress (user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, completed BOOLEAN NOT NULL DEFAULT false, best_score INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, completed_at TIMESTAMPTZ, PRIMARY KEY(user_id, lesson_id));
CREATE TABLE IF NOT EXISTS xp_log (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS announcements (id BIGSERIAL PRIMARY KEY, title VARCHAR(160) NOT NULL, body TEXT NOT NULL, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS notifications (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(160) NOT NULL, body TEXT NOT NULL, is_read BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_log (id BIGSERIAL PRIMARY KEY, admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(80) NOT NULL, target_type VARCHAR(80), target_id TEXT, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS settings (key VARCHAR(80) PRIMARY KEY, value JSONB NOT NULL);
CREATE INDEX IF NOT EXISTS users_xp_idx ON users(xp DESC);
CREATE INDEX IF NOT EXISTS xp_log_created_idx ON xp_log(created_at);
CREATE INDEX IF NOT EXISTS xp_log_user_idx ON xp_log(user_id);
CREATE INDEX IF NOT EXISTS lesson_progress_user_idx ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);
INSERT INTO settings(key,value) VALUES ('max_hearts','5'),('heart_regen_minutes','30'),('xp_per_lesson','15'),('xp_perfect_bonus','5'),('registration_open','true'),('maintenance_mode','false')
ON CONFLICT(key) DO NOTHING;


-- قابلیت‌های تکمیلی Python، پلی‌گراند، ماموریت و دستاوردها
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_goal INTEGER NOT NULL DEFAULT 20 CHECK (daily_goal IN (10,20,30));
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS confetti_enabled BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS playground_snippets (
 id BIGSERIAL PRIMARY KEY, short_id CHAR(8) UNIQUE NOT NULL, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(100) NOT NULL, language VARCHAR(16) NOT NULL CHECK(language IN ('python','javascript','web')),
 files JSONB NOT NULL DEFAULT '{}'::jsonb, is_public BOOLEAN NOT NULL DEFAULT false, is_hidden BOOLEAN NOT NULL DEFAULT false,
 runs_count INTEGER NOT NULL DEFAULT 0, forked_from BIGINT REFERENCES playground_snippets(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS playground_snippets_user_idx ON playground_snippets(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS playground_snippets_public_idx ON playground_snippets(is_public,created_at DESC);
CREATE TABLE IF NOT EXISTS achievements(code VARCHAR(50) PRIMARY KEY,title VARCHAR(100) NOT NULL,description TEXT NOT NULL,icon VARCHAR(20) NOT NULL DEFAULT '🏅');
CREATE TABLE IF NOT EXISTS user_achievements(user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,achievement_code VARCHAR(50) NOT NULL REFERENCES achievements(code) ON DELETE CASCADE,earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(user_id,achievement_code));
CREATE TABLE IF NOT EXISTS daily_quests(user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,quest_date DATE NOT NULL,quest_key VARCHAR(40) NOT NULL,progress INTEGER NOT NULL DEFAULT 0,target INTEGER NOT NULL,completed BOOLEAN NOT NULL DEFAULT false,xp_reward INTEGER NOT NULL DEFAULT 5,PRIMARY KEY(user_id,quest_date,quest_key));
CREATE TABLE IF NOT EXISTS mistakes(user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,exercise_index INTEGER NOT NULL,last_wrong_at TIMESTAMPTZ NOT NULL DEFAULT now(),resolved BOOLEAN NOT NULL DEFAULT false,PRIMARY KEY(user_id,lesson_id,exercise_index));
INSERT INTO settings(key,value) VALUES
 ('python_enabled','true'::jsonb),('playground_enabled','true'::jsonb),('js_timeout_seconds','3'::jsonb),
 ('py_timeout_seconds','8'::jsonb),('daily_quests_enabled','true'::jsonb)
ON CONFLICT(key) DO NOTHING;
INSERT INTO achievements(code,title,description,icon) VALUES
 ('first_lesson','قدم اول','اولین درس را کامل کردی.','🌱'),
 ('first_code','اولین کد','اولین بار کد اجرا کردی.','💻'),
 ('five_lessons','پنج درس','پنج درس را کامل کردی.','📚'),
 ('ten_lessons','ده درس','ده درس را کامل کردی.','🎯'),
 ('course_complete','پایان دوره','یک دوره را کامل کردی.','🏆'),
 ('streak_3','سه روز پیاپی','سه روز پشت‌سرهم تمرین کردی.','🔥'),
 ('streak_7','هفت روز پیاپی','یک هفته استمرار داشتی.','🗓️'),
 ('streak_30','سی روز پیاپی','سی روز تمرین را ادامه دادی.','🌟'),
 ('perfect_lesson','بدون خطا','یک درس را بدون اشتباه گذراندی.','✨'),
 ('first_snippet','ذخیره‌ساز','اولین اسنیپت را ذخیره کردی.','📝'),
 ('first_share','هم‌رسانی','اولین اسنیپت را عمومی کردی.','🔗'),
 ('runs_10','ده اجرا','ده بار کد را اجرا کردی.','▶️'),
 ('runs_100','صد اجرا','صد بار کد را اجرا کردی.','🚀'),
 ('xp_100','صد XP','به ۱۰۰ امتیاز رسیدی.','💚'),
 ('xp_1000','هزار XP','به ۱۰۰۰ امتیاز رسیدی.','💎'),
 ('review_five','مرور عالی','پنج تمرین اشتباه را مرور کردی.','🧠')
ON CONFLICT(code) DO NOTHING;
