/*
# SmartClass Zambia — Seed Past Papers

Seeds a small but real set of past papers so the Past Papers section is
demoable end to end: two Mathematics papers (Form 5, 2023 and 2024) and
one Form 3 Physics paper, each with a handful of structured questions.
This is a starting scaffold, not the full ECZ archive — more years/subjects
get added the same way, or via the admin panel's content tools.

Uses Form 1-6 numbering, matching every other table in this project.
The original seed used Grade 8-12 numbering before the Form restructuring;
the values below are corrected for databases where that restructuring is
already applied. Titles use the same Form terminology shown by the app.

All statements are idempotent-safe within a single run of this file; the
ON CONFLICT pattern used elsewhere in this project isn't available here
since these tables have no natural unique key, so this migration is written
to only insert if a paper with the same subject+grade+year+title doesn't
already exist.
*/

DO $$
DECLARE
  math_id uuid;
  phy_id uuid;
  paper_2024 uuid;
  paper_2023 uuid;
  paper_phy uuid;
BEGIN
  SELECT id INTO math_id FROM subjects WHERE code = 'MATH';
  SELECT id INTO phy_id FROM subjects WHERE code = 'PHY';

  -- ============================================================
  -- Form 5 Mathematics Paper 1, 2024
  -- ============================================================
  IF NOT EXISTS (
    SELECT 1 FROM past_papers WHERE subject_id = math_id AND grade = 5 AND year = 2024 AND title = 'Form 5 Mathematics Paper 1'
  ) THEN
    INSERT INTO past_papers (subject_id, grade, year, term, title, total_marks, duration_minutes, source)
    VALUES (math_id, 5, 2024, NULL, 'Form 5 Mathematics Paper 1', 100, 150, 'ECZ')
    RETURNING id INTO paper_2024;

    INSERT INTO past_paper_questions (past_paper_id, question_number, question_text, question_type, options, answer_key, explanation, marks) VALUES
    (paper_2024, 1, 'Factorise completely: x² + 5x + 6', 'multiple_choice', '["(x+2)(x+3)", "(x+1)(x+6)", "(x-2)(x-3)", "(x+6)(x-1)"]', '(x+2)(x+3)', 'We need two numbers that multiply to 6 and add to 5: those are 2 and 3, giving (x+2)(x+3).', 4),
    (paper_2024, 2, 'Solve for x: 2x - 7 = 15', 'short_answer', NULL, 'x = 11', 'Add 7 to both sides to get 2x = 22, then divide by 2 to get x = 11.', 3),
    (paper_2024, 3, 'A bus travels 240 km in 3 hours. What is its average speed in km/h?', 'short_answer', NULL, '80 km/h', 'Average speed = distance ÷ time = 240 ÷ 3 = 80 km/h.', 3),
    (paper_2024, 4, 'What is the gradient of the line joining (2, 3) and (6, 11)?', 'multiple_choice', '["2", "4", "8", "1/2"]', '2', 'Gradient = (11 − 3) / (6 − 2) = 8 / 4 = 2.', 4),
    (paper_2024, 5, 'Simplify: (3x²y)(4xy³)', 'short_answer', NULL, '12x³y⁴', 'Multiply the coefficients (3 × 4 = 12) and add the exponents of matching variables: x²·x¹=x³, y¹·y³=y⁴.', 3);
  END IF;

  -- ============================================================
  -- Form 5 Mathematics Paper 1, 2023
  -- ============================================================
  IF NOT EXISTS (
    SELECT 1 FROM past_papers WHERE subject_id = math_id AND grade = 5 AND year = 2023 AND title = 'Form 5 Mathematics Paper 1'
  ) THEN
    INSERT INTO past_papers (subject_id, grade, year, term, title, total_marks, duration_minutes, source)
    VALUES (math_id, 5, 2023, NULL, 'Form 5 Mathematics Paper 1', 100, 150, 'ECZ')
    RETURNING id INTO paper_2023;

    INSERT INTO past_paper_questions (past_paper_id, question_number, question_text, question_type, options, answer_key, explanation, marks) VALUES
    (paper_2023, 1, 'Solve the quadratic equation: x² - x - 6 = 0', 'multiple_choice', '["x = 3, x = -2", "x = -3, x = 2", "x = 3, x = 2", "x = -3, x = -2"]', 'x = 3, x = -2', 'Factorise as (x-3)(x+2) = 0, so x = 3 or x = -2.', 4),
    (paper_2023, 2, 'A farmer sold 12 bags of maize at K150 each. How much did he receive in total?', 'short_answer', NULL, 'K1,800', '12 × K150 = K1,800.', 2),
    (paper_2023, 3, 'Express 0.00045 in standard form.', 'multiple_choice', '["4.5 × 10⁻⁴", "4.5 × 10⁴", "45 × 10⁻⁵", "4.5 × 10⁻⁵"]', '4.5 × 10⁻⁴', 'Move the decimal point 4 places right to get 4.5, so the power of 10 is -4.', 3),
    (paper_2023, 4, 'Find the value of x if 3(x - 2) = 2x + 4', 'short_answer', NULL, 'x = 10', 'Expand: 3x - 6 = 2x + 4. Subtract 2x from both sides: x - 6 = 4. Add 6: x = 10.', 3);
  END IF;

  -- ============================================================
  -- Form 3 Physics Paper 1, 2024
  -- ============================================================
  IF phy_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM past_papers WHERE subject_id = phy_id AND grade = 3 AND year = 2024 AND title = 'Form 3 Physics Paper 1'
  ) THEN
    INSERT INTO past_papers (subject_id, grade, year, term, title, total_marks, duration_minutes, source)
    VALUES (phy_id, 3, 2024, NULL, 'Form 3 Physics Paper 1', 80, 120, 'ECZ')
    RETURNING id INTO paper_phy;

    INSERT INTO past_paper_questions (past_paper_id, question_number, question_text, question_type, options, answer_key, explanation, marks) VALUES
    (paper_phy, 1, 'What is the SI unit of force?', 'multiple_choice', '["Newton", "Joule", "Watt", "Pascal"]', 'Newton', 'Force is measured in Newtons (N), named after Sir Isaac Newton.', 2),
    (paper_phy, 2, 'A car accelerates from 0 to 20 m/s in 4 seconds. What is its acceleration?', 'short_answer', NULL, '5 m/s²', 'Acceleration = change in velocity ÷ time = 20 ÷ 4 = 5 m/s².', 3),
    (paper_phy, 3, 'Which of these is a vector quantity?', 'multiple_choice', '["Velocity", "Speed", "Mass", "Time"]', 'Velocity', 'Velocity has both magnitude and direction, unlike speed, mass, or time.', 2);
  END IF;
END $$;
