-- Insert default achievements
INSERT INTO public.achievements (name, description, icon, xp_reward) VALUES
  ('Note Master', 'Created 50 notes', 'BookOpen', 100),
  ('Study Streak', 'Maintained a 7-day study streak', 'Flame', 150),
  ('Quiz Champion', 'Completed 20 practice quizzes', 'Trophy', 200),
  ('Perfect Score', 'Achieved 100% on a practice quiz', 'Star', 75),
  ('Dedicated Scholar', 'Studied for 30 days total', 'Award', 300),
  ('Consistent Learner', 'Added notes for 5 consecutive days', 'Calendar', 125),
  ('First Steps', 'Created your first note', 'BookOpen', 25),
  ('Class Organizer', 'Created 5 different classes', 'BarChart', 100),
  ('AI Explorer', 'Used AI assistance 10 times', 'Brain', 75),
  ('Summary Master', 'Generated 25 AI summaries', 'FileText', 150)
ON CONFLICT (name) DO NOTHING;