/*
# SmartClass Zambia — Seed ECZ Mathematics Curriculum (Grades 8–12)

This migration populates the `topics`, `lessons`, and `practice_questions` tables
with curriculum-aligned Mathematics content for Grades 8 through 12, covering the
core topic areas defined in the SRS Section 1.2.

## Topics Seeded (by grade)
- Grade 8: Integers, Algebraic Expressions, Basic Geometry, Ratios & Proportion
- Grade 9: Linear Equations, Pythagoras' Theorem, Statistics Basics
- Grade 10: Quadratic Equations, Trigonometry, Probability
- Grade 11: Functions, Coordinate Geometry, Sequences & Series
- Grade 12: Calculus Basics, Advanced Trigonometry, ECZ Exam Practice

Each topic has 2 lessons with structured content (intro, steps, examples, summary)
and 3 practice questions (mix of multiple choice and numeric).

## Notes
- Uses `ON CONFLICT DO NOTHING` with a unique constraint on (grade, name) to be idempotent.
- Lesson content is stored as JSONB with a structured shape the frontend renders.
- All curriculum data is read-only from the client (SELECT-only RLS already in place).
*/

-- Keep this seed runnable before or after the Form 1-6 restructuring.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'topics'::regclass
			AND conname = 'topics_grade_check'
			AND pg_get_constraintdef(oid) LIKE '%BETWEEN 8 AND 12%'
	) THEN
		ALTER TABLE topics DROP CONSTRAINT topics_grade_check;
		ALTER TABLE topics ADD CONSTRAINT topics_grade_check CHECK (grade BETWEEN 1 AND 12);
	END IF;
END $$;

-- Add unique constraint for idempotent topic seeding
ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_grade_name_unique;
ALTER TABLE topics ADD CONSTRAINT topics_grade_name_unique UNIQUE (grade, name);

-- ============================================================
-- GRADE 8 TOPICS
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description) VALUES
(1, 'Integers', 'Number Theory', 'G8-1', 1, 'Operations with positive and negative whole numbers, including ordering, addition, subtraction, multiplication and division.'),
(1, 'Algebraic Expressions', 'Algebra', 'G8-2', 2, 'Simplifying algebraic expressions, collecting like terms, and substituting values into expressions.'),
(1, 'Basic Geometry', 'Geometry', 'G8-3', 3, 'Properties of angles, triangles, and quadrilaterals, including angle sums and basic constructions.'),
(1, 'Ratios and Proportion', 'Number Theory', 'G8-4', 4, 'Understanding ratios, direct proportion, and solving problems involving sharing and scaling.')
ON CONFLICT (grade, name) DO NOTHING;

-- GRADE 8 LESSONS: Integers
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Introduction to Integers',
'{"intro": "Integers are whole numbers that can be positive, negative, or zero. They extend the counting numbers to include numbers below zero, which we use for temperatures, bank balances, and more.", "steps": [{"title": "What are Integers?", "body": "An integer is any number from the set {..., -3, -2, -1, 0, 1, 2, 3, ...}. Positive integers are greater than zero. Negative integers are less than zero. Zero is neither positive nor negative.", "board": "Number line from -5 to 5"}, {"title": "Ordering Integers", "body": "On a number line, numbers to the right are greater. So -3 is greater than -5 because -3 is to the right of -5.", "board": "Number line: -5 < -3 < 0 < 3 < 5"}, {"title": "Absolute Value", "body": "The absolute value of an integer is its distance from zero. We write |x|. For example, |-4| = 4 and |4| = 4.", "board": "|−4| = 4, |4| = 4"}], "examples": [{"problem": "In Lusaka, the temperature was 25°C at noon and dropped to 12°C by evening. What is the change in temperature?", "solution": "Change = 12 − 25 = −13°C. The temperature dropped by 13 degrees."}], "summary": "Integers include positive numbers, negative numbers, and zero. Use a number line to compare and order them. Absolute value measures distance from zero."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 1 AND t.name = 'Integers'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Operations with Integers',
'{"intro": "Now we learn how to add, subtract, multiply, and divide integers using simple rules.", "steps": [{"title": "Adding Integers", "body": "Same signs: add the values and keep the sign. Different signs: subtract the smaller value from the larger and keep the sign of the larger.", "board": "3 + 5 = 8, −3 + (−5) = −8, −3 + 5 = 2"}, {"title": "Subtracting Integers", "body": "To subtract an integer, add its opposite. So a − b = a + (−b).", "board": "7 − 3 = 4, 7 − (−3) = 7 + 3 = 10"}, {"title": "Multiplying and Dividing", "body": "Same signs give a positive result. Different signs give a negative result.", "board": "−3 × −4 = 12, −3 × 4 = −12, −12 ÷ 3 = −4"}], "examples": [{"problem": "A minibus driver in Kitwe earns K120 on Monday but spends K45 on fuel and K30 on lunch. What is his net earning?", "solution": "Net = 120 − 45 − 30 = 45. He has K45 left."}], "summary": "Same sign addition: add and keep sign. Subtraction: add the opposite. Multiplication/Division: same signs = positive, different signs = negative."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 1 AND t.name = 'Integers'
ON CONFLICT DO NOTHING;

-- GRADE 8 LESSONS: Algebraic Expressions
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Simplifying Algebraic Expressions',
'{"intro": "Algebraic expressions use letters to represent numbers. We simplify them by collecting like terms — terms that have the same variable raised to the same power.", "steps": [{"title": "Terms and Like Terms", "body": "A term is a number, a variable, or a product of numbers and variables. Like terms have the same variable part. 3x and 5x are like terms; 3x and 3y are not.", "board": "Like terms: 3x, 5x, −2x. Unlike terms: 3x, 3y, 3"}, {"title": "Collecting Like Terms", "body": "To simplify, combine like terms by adding or subtracting their coefficients. 3x + 5x = 8x. 7y − 2y = 5y.", "board": "3x + 5x = 8x, 7y − 2y = 5y"}, {"title": "Removing Brackets", "body": "When a number or variable is outside brackets, multiply it by every term inside. 3(x + 2) = 3x + 6.", "board": "3(x + 2) = 3x + 6, −2(2x − 3) = −4x + 6"}], "examples": [{"problem": "A shop in Ndola sells x bags of mealie meal at K75 each and y bottles of cooking oil at K30 each. Write and simplify the expression for total sales.", "solution": "Total = 75x + 30y. This is already simplified since x and y are unlike terms."}], "summary": "Like terms have the same variable part. Simplify by collecting like terms. Expand brackets by multiplying the outside term by each term inside."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 1 AND t.name = 'Algebraic Expressions'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Substitution into Expressions',
'{"intro": "Substitution means replacing variables with numbers to find the value of an expression. This is one of the most useful skills in algebra.", "steps": [{"title": "How to Substitute", "body": "Replace each letter with the given number, then calculate following the order of operations (BODMAS).", "board": "If x = 3: 2x + 4 = 2(3) + 4 = 10"}, {"title": "Order of Operations", "body": "BODMAS: Brackets, Orders (powers), Division, Multiplication, Addition, Subtraction. Always work in this order.", "board": "2 + 3 × 4 = 2 + 12 = 14 (not 20)"}, {"title": "Negative Substitutions", "body": "Be careful with signs. If x = −2, then x² = (−2)² = 4, but −x² = −(2²) = −4.", "board": "x = −2: x² = 4, −x² = −4"}], "examples": [{"problem": "The cost of a taxi ride in Lusaka is K5 plus K2 per kilometre. If the expression is C = 5 + 2n, find C when n = 8 kilometres.", "solution": "C = 5 + 2(8) = 5 + 16 = 21. The ride costs K21."}], "summary": "Substitution replaces variables with numbers. Follow BODMAS for correct order. Be careful with negative values and powers."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 1 AND t.name = 'Algebraic Expressions'
ON CONFLICT DO NOTHING;

-- GRADE 8 LESSONS: Basic Geometry
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Angles and Triangles',
'{"intro": "Geometry is the study of shapes. We begin with angles — the amount of turn between two lines — and triangles, the simplest polygons.", "steps": [{"title": "Types of Angles", "body": "Acute: less than 90°. Right: exactly 90°. Obtuse: between 90° and 180°. Straight: exactly 180°. Reflex: between 180° and 360°.", "board": "Acute < 90°, Right = 90°, Obtuse: 90°–180°"}, {"title": "Angle Sum of a Triangle", "body": "The three interior angles of any triangle always add up to 180°. This is one of the most important facts in geometry.", "board": "Triangle: a + b + c = 180°"}, {"title": "Types of Triangles", "body": "Equilateral: all sides and angles equal (60° each). Isosceles: two sides and two angles equal. Scalene: all sides and angles different.", "board": "Equilateral: 60°, 60°, 60°"}], "examples": [{"problem": "A triangular school garden in Kabwe has two angles of 55° and 65°. Find the third angle.", "solution": "Third angle = 180° − 55° − 65° = 60°."}], "summary": "Angles are measured in degrees. A triangle''s angles sum to 180°. Know the types: acute, right, obtuse, reflex, and triangle types: equilateral, isosceles, scalene."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 1 AND t.name = 'Basic Geometry'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Quadrilaterals and Angle Properties',
'{"intro": "A quadrilateral is a four-sided shape. The interior angles of any quadrilateral add up to 360°.", "steps": [{"title": "Angle Sum of a Quadrilateral", "body": "The four interior angles of any quadrilateral always add up to 360°. You can prove this by splitting it into two triangles.", "board": "Quadrilateral: a + b + c + d = 360°"}, {"title": "Special Quadrilaterals", "body": "Square: all sides equal, all angles 90°. Rectangle: opposite sides equal, all angles 90°. Parallelogram: opposite sides parallel and equal. Rhombus: all sides equal, opposite angles equal.", "board": "Square: 90°, 90°, 90°, 90°"}, {"title": "Angles on a Straight Line", "body": "Angles on a straight line add up to 180°. Angles around a point add up to 360°.", "board": "Straight line: a + b = 180°"}], "examples": [{"problem": "A rectangular classroom door in Livingstone has angles a, b, c, d. If three angles are 90°, 90°, and 90°, find the fourth.", "solution": "Fourth = 360° − 90° − 90° − 90° = 90°. It is a rectangle, so all angles are 90°."}], "summary": "Quadrilateral angles sum to 360°. Know properties of square, rectangle, parallelogram, rhombus. Angles on a line = 180°, around a point = 360°."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 1 AND t.name = 'Basic Geometry'
ON CONFLICT DO NOTHING;

-- GRADE 8 LESSONS: Ratios and Proportion
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Introduction to Ratios',
'{"intro": "A ratio compares two or more quantities. We use ratios in everyday life — in recipes, sharing money, and mixing ingredients.", "steps": [{"title": "Writing Ratios", "body": "A ratio of 3 to 2 is written as 3:2. Ratios can be simplified by dividing both parts by their greatest common factor, just like fractions.", "board": "6:4 = 3:2 (divide both by 2)"}, {"title": "Sharing in a Ratio", "body": "To share an amount in a ratio, find the total number of parts, divide the amount by the total parts to get one part, then multiply by each ratio number.", "board": "Share K60 in ratio 2:3 → total 5 parts → 60÷5=12 → 24:36"}, {"title": "Equivalent Ratios", "body": "Two ratios are equivalent if they simplify to the same ratio. 4:6 and 2:3 are equivalent because both simplify to 2:3.", "board": "4:6 = 2:3, 10:15 = 2:3"}], "examples": [{"problem": "Two friends in Chipata share K450 in the ratio 2:3. How much does each person get?", "solution": "Total parts = 5. One part = 450 ÷ 5 = 90. Person 1: 2 × 90 = K180. Person 2: 3 × 90 = K270."}], "summary": "A ratio compares quantities. Simplify by dividing by common factors. To share: find total parts, divide, then multiply."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 1 AND t.name = 'Ratios and Proportion'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Direct Proportion',
'{"intro": "Two quantities are in direct proportion when they increase or decrease together at the same rate. If one doubles, the other doubles too.", "steps": [{"title": "What is Direct Proportion?", "body": "If y is directly proportional to x, then y = kx where k is a constant. The ratio y/x is always the same.", "board": "y = kx, k = y/x"}, {"title": "Finding the Constant", "body": "Use one pair of values to find k, then use k to find any other value.", "board": "If y = 10 when x = 2, then k = 5, so y = 5x"}, {"title": "Solving Proportion Problems", "body": "Set up a table of values, find the constant, then calculate the unknown.", "board": "3 pens cost K15 → 1 pen = K5 → 8 pens = K40"}], "examples": [{"problem": "If 5 bags of charcoal cost K250 in Mongu, how much do 8 bags cost?", "solution": "1 bag = 250 ÷ 5 = K50. 8 bags = 8 × 50 = K400."}], "summary": "Direct proportion: y = kx. Find k from one pair, then solve for any value. When one quantity doubles, the other doubles too."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 1 AND t.name = 'Ratios and Proportion'
ON CONFLICT DO NOTHING;

-- ============================================================
-- GRADE 9 TOPICS
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description) VALUES
(2, 'Linear Equations', 'Algebra', 'G9-1', 1, 'Solving linear equations with one variable, including equations with brackets and fractions.'),
(2, 'Pythagoras Theorem', 'Geometry', 'G9-2', 2, 'The relationship between the sides of a right-angled triangle and its applications.'),
(2, 'Statistics Basics', 'Statistics', 'G9-3', 3, 'Collecting, organising, and representing data using mean, median, mode, and range.')
ON CONFLICT (grade, name) DO NOTHING;

-- GRADE 9 LESSONS: Linear Equations
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Solving Linear Equations',
'{"intro": "A linear equation has variables raised to the power of 1 only. Solving it means finding the value of the variable that makes the equation true.", "steps": [{"title": "The Balance Method", "body": "Think of an equation as a balance. Whatever you do to one side, you must do to the other. The goal is to get the variable alone.", "board": "x + 5 = 12 → x = 12 − 5 = 7"}, {"title": "Equations with Brackets", "body": "First expand the brackets, then collect like terms, then solve. Example: 3(x + 2) = 15 → 3x + 6 = 15 → 3x = 9 → x = 3.", "board": "3(x + 2) = 15 → 3x = 9 → x = 3"}, {"title": "Equations with Fractions", "body": "Multiply every term by the LCM of the denominators to clear fractions first. Then solve normally.", "board": "x/2 + 3 = 5 → x + 6 = 10 → x = 4"}], "examples": [{"problem": "Chipo buys x mangoes at K2 each. She pays K30 and gets K4 change. Write and solve the equation.", "solution": "2x + 4 = 30 → 2x = 26 → x = 13. Chipo bought 13 mangoes."}], "summary": "Use the balance method: do the same to both sides. Expand brackets first. Clear fractions by multiplying by the LCM."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 2 AND t.name = 'Linear Equations'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Equations with Unknowns on Both Sides',
'{"intro": "Sometimes the variable appears on both sides of the equation. We collect the variable terms on one side and the numbers on the other.", "steps": [{"title": "Collecting Variables", "body": "Move all variable terms to one side by adding or subtracting. Move all constant terms to the other side.", "board": "5x − 3 = 2x + 6 → 3x = 9 → x = 3"}, {"title": "Dealing with Brackets", "body": "Expand brackets first, then collect like terms, then solve.", "board": "2(x + 3) = x + 8 → 2x + 6 = x + 8 → x = 2"}, {"title": "Checking Your Answer", "body": "Always substitute your answer back into the original equation to check it works on both sides.", "board": "Check: 5(3) − 3 = 12, 2(3) + 6 = 12 ✓"}], "examples": [{"problem": "A bus in Solwezi has x passengers. At the next stop, 5 get off and 3 get on. The bus now has the same number as 2(x − 5). Find x.", "solution": "x − 5 + 3 = 2(x − 5) → x − 2 = 2x − 10 → −x = −8 → x = 8."}], "summary": "Move variable terms to one side, constants to the other. Expand brackets first. Always check by substituting back."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 2 AND t.name = 'Linear Equations'
ON CONFLICT DO NOTHING;

-- GRADE 9 LESSONS: Pythagoras Theorem
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Pythagorean Theorem',
'{"intro": "Pythagoras'' Theorem is one of the most famous results in mathematics. It applies only to right-angled triangles and relates the three sides.", "steps": [{"title": "The Theorem", "body": "In a right-angled triangle, the square of the hypotenuse (longest side) equals the sum of the squares of the other two sides: a² + b² = c², where c is the hypotenuse.", "board": "a² + b² = c² (c = hypotenuse)"}, {"title": "Finding the Hypotenuse", "body": "If you know the two shorter sides, add their squares and take the square root: c = √(a² + b²).", "board": "3² + 4² = 9 + 16 = 25 → c = 5"}, {"title": "Finding a Shorter Side", "body": "If you know the hypotenuse and one side, subtract the square of the known side from the hypotenuse squared: a = √(c² − b²).", "board": "c = 13, b = 5 → a = √(169 − 25) = √144 = 12"}], "examples": [{"problem": "A ladder in Kasama leans against a wall. The bottom is 3m from the wall and the ladder is 5m long. How high up the wall does it reach?", "solution": "Height = √(5² − 3²) = √(25 − 9) = √16 = 4m."}], "summary": "Pythagoras: a² + b² = c². The hypotenuse is always opposite the right angle. Use it to find any missing side in a right-angled triangle."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 2 AND t.name = 'Pythagoras Theorem'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Applications of Pythagoras',
'{"intro": "Pythagoras'' Theorem has many real-world applications — from construction to navigation. Let''s solve some practical problems.", "steps": [{"title": "Is it a Right Triangle?", "body": "If a² + b² = c², the triangle is right-angled. Check by substituting the three sides and seeing if the equation holds.", "board": "3, 4, 5: 9 + 16 = 25 ✓ → Right triangle"}, {"title": "Diagonal of a Rectangle", "body": "The diagonal of a rectangle forms a right triangle with the length and width. Use Pythagoras to find it.", "board": "Diagonal = √(length² + width²)"}, {"title": "Distance Between Points", "body": "On a grid, the distance between two points forms the hypotenuse of a right triangle. Use Pythagoras to find the distance.", "board": "Distance = √((x₂−x₁)² + (y₂−y₁)²)"}], "examples": [{"problem": "A rectangular field in Mazabuka measures 60m by 80m. What is the length of the diagonal path across it?", "solution": "Diagonal = √(60² + 80²) = √(3600 + 6400) = √10000 = 100m."}], "summary": "Use Pythagoras to check for right triangles, find diagonals of rectangles, and calculate distances between points on a grid."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 2 AND t.name = 'Pythagoras Theorem'
ON CONFLICT DO NOTHING;

-- GRADE 9 LESSONS: Statistics Basics
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Mean, Median, Mode and Range',
'{"intro": "Statistics helps us understand data. The mean, median, mode, and range are called measures of central tendency and spread.", "steps": [{"title": "The Mean", "body": "The mean is the average. Add all the values and divide by how many values there are.", "board": "Mean = (sum of values) ÷ (number of values)"}, {"title": "The Median", "body": "The median is the middle value when data is arranged in order. If there are two middle values, the median is their average.", "board": "Data: 3, 5, 7, 9, 11 → Median = 7"}, {"title": "The Mode and Range", "body": "The mode is the most frequently occurring value. The range is the difference between the highest and lowest values.", "board": "Data: 2, 4, 4, 6, 8 → Mode = 4, Range = 8 − 2 = 6"}], "examples": [{"problem": "A Grade 9 class in Lundazi scored: 45, 60, 55, 70, 60 on a Maths test. Find the mean, median, mode, and range.", "solution": "Mean = 290 ÷ 5 = 58. Ordered: 45, 55, 60, 60, 70 → Median = 60. Mode = 60. Range = 70 − 45 = 25."}], "summary": "Mean = average. Median = middle value. Mode = most frequent. Range = highest minus lowest. Always order data before finding the median."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 2 AND t.name = 'Statistics Basics'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Representing Data',
'{"intro": "Data can be displayed in different ways. Bar charts, pie charts, and line graphs help us see patterns quickly.", "steps": [{"title": "Bar Charts", "body": "Bar charts use bars of different heights to show values. The height of each bar represents the frequency.", "board": "Bar chart: x-axis = categories, y-axis = frequency"}, {"title": "Pie Charts", "body": "Pie charts show data as slices of a circle. Each slice''s angle = (frequency ÷ total) × 360°.", "board": "If 25 out of 100: angle = 25/100 × 360 = 90°"}, {"title": "Choosing the Right Chart", "body": "Bar charts compare categories. Pie charts show proportions of a whole. Line graphs show changes over time.", "board": "Bar: comparison, Pie: proportion, Line: trend over time"}], "examples": [{"problem": "In a class of 30 pupils in Mansa, 12 like Maths, 10 like Science, and 8 like English. What angle represents Maths in a pie chart?", "solution": "Angle = (12 ÷ 30) × 360 = 144°."}], "summary": "Bar charts compare categories. Pie charts show proportions (angle = freq/total × 360°). Line graphs show trends over time."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 2 AND t.name = 'Statistics Basics'
ON CONFLICT DO NOTHING;

-- ============================================================
-- GRADE 10 TOPICS
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description) VALUES
(3, 'Quadratic Equations', 'Algebra', 'G10-1', 1, 'Solving quadratic equations by factorisation, completing the square, and the quadratic formula.'),
(3, 'Trigonometry', 'Trigonometry', 'G10-2', 2, 'Sine, cosine, and tangent ratios in right-angled triangles and their applications.'),
(3, 'Probability', 'Statistics', 'G10-3', 3, 'Basic probability, sample spaces, and calculating probabilities of simple and combined events.')
ON CONFLICT (grade, name) DO NOTHING;

-- GRADE 10 LESSONS: Quadratic Equations
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Introduction to Quadratic Equations',
'{"intro": "A quadratic equation is an equation of the form ax² + bx + c = 0, where a, b, and c are numbers and a is not zero. The x² term is what makes it quadratic.", "steps": [{"title": "Standard Form", "body": "The standard form is ax² + bx + c = 0. The values of a, b, and c determine the shape of the parabola when graphed.", "board": "ax² + bx + c = 0, a ≠ 0"}, {"title": "Solving by Factorisation", "body": "If the quadratic can be factored, write it as (x + p)(x + q) = 0. Then each factor gives a solution: x = −p or x = −q.", "board": "x² + 5x + 6 = 0 → (x + 2)(x + 3) = 0 → x = −2 or x = −3"}, {"title": "When Factorisation Fails", "body": "Not all quadratics factorise neatly. When they don''t, we use completing the square or the quadratic formula.", "board": "x² + 4x + 1 = 0 (does not factorise simply)"}], "examples": [{"problem": "The area of a rectangular garden in Kabwe is 24m². The length is 2m more than the width. Find the dimensions.", "solution": "w(w + 2) = 24 → w² + 2w − 24 = 0 → (w + 6)(w − 4) = 0 → w = 4 (positive). Length = 6m, width = 4m."}], "summary": "Quadratic: ax² + bx + c = 0. Factorise into (x + p)(x + q) = 0. Each factor gives a solution. Not all quadratics factorise — use the formula then."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Quadratic Equations'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Quadratic Formula',
'{"intro": "The quadratic formula solves any quadratic equation, even ones that don''t factorise. It is one of the most useful formulas in mathematics.", "steps": [{"title": "The Formula", "body": "For ax² + bx + c = 0, the solutions are: x = (−b ± √(b² − 4ac)) ÷ (2a). The ± gives two solutions.", "board": "x = (−b ± √(b² − 4ac)) / 2a"}, {"title": "The Discriminant", "body": "The value b² − 4ac is called the discriminant. If positive: two solutions. If zero: one solution. If negative: no real solutions.", "board": "Δ = b² − 4ac: Δ > 0 → two roots, Δ = 0 → one root, Δ < 0 → no real roots"}, {"title": "Applying the Formula", "body": "Identify a, b, and c from the equation. Substitute into the formula. Simplify carefully.", "board": "2x² + 3x − 2 = 0: a=2, b=3, c=−2"}], "examples": [{"problem": "A ball is thrown upward in Chingola. Its height h metres after t seconds is h = 20t − 5t². When does it hit the ground (h = 0)?", "solution": "5t² − 20t = 0 → 5t(t − 4) = 0 → t = 0 or t = 4. It hits the ground at t = 4 seconds."}], "summary": "The quadratic formula x = (−b ± √(b² − 4ac))/2a solves any quadratic. The discriminant b² − 4ac tells you how many real solutions to expect."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Quadratic Equations'
ON CONFLICT DO NOTHING;

-- GRADE 10 LESSONS: Trigonometry
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Trigonometric Ratios',
'{"intro": "Trigonometry connects angles and sides in right-angled triangles. The three main ratios are sine, cosine, and tangent — often remembered as SOH CAH TOA.", "steps": [{"title": "Naming the Sides", "body": "In a right triangle, the hypotenuse is opposite the right angle. The opposite side is across from the angle. The adjacent side is next to the angle.", "board": "Hypotenuse (longest), Opposite (across from angle θ), Adjacent (next to angle θ)"}, {"title": "The Three Ratios", "body": "sin θ = opposite/hypotenuse, cos θ = adjacent/hypotenuse, tan θ = opposite/adjacent. Remember: SOH CAH TOA.", "board": "sin θ = O/H, cos θ = A/H, tan θ = O/A"}, {"title": "Finding Sides", "body": "Choose the ratio that uses the side you know and the side you want. Substitute and solve.", "board": "If O = 5, H = 10: sin θ = 5/10 = 0.5 → θ = 30°"}], "examples": [{"problem": "A surveyor in Kapiri Mposhi stands 50m from a tree. The angle to the top of the tree is 35°. How tall is the tree (to the nearest metre)?", "solution": "tan 35° = height/50 → height = 50 × tan 35° ≈ 50 × 0.700 = 35m."}], "summary": "SOH CAH TOA: sin = O/H, cos = A/H, tan = O/A. Identify the sides relative to the angle, choose the right ratio, substitute and solve."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Trigonometry'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Trigonometry in Real Life',
'{"intro": "Trigonometry solves real problems involving heights, distances, and angles — from building construction to navigation.", "steps": [{"title": "Angles of Elevation", "body": "The angle of elevation is the angle from horizontal upward to an object. Use trig ratios with the horizontal distance and the height.", "board": "Angle of elevation: angle from ground up to object"}, {"title": "Angles of Depression", "body": "The angle of depression is the angle from horizontal downward to an object. It is measured from the horizontal downward.", "board": "Angle of depression: angle from horizontal down to object"}, {"title": "Bearings", "body": "A bearing is an angle measured clockwise from North. It is always written as three digits, e.g. 045°.", "board": "Bearing: clockwise from North, 000° to 360°"}], "examples": [{"problem": "From the top of a 30m tower in Mkushi, the angle of depression to a goat is 25°. How far is the goat from the base of the tower?", "solution": "tan 25° = 30/distance → distance = 30 ÷ tan 25° ≈ 30 ÷ 0.466 ≈ 64.4m."}], "summary": "Angle of elevation: up from horizontal. Angle of depression: down from horizontal. Bearings: clockwise from North. Use trig ratios to find unknown sides."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Trigonometry'
ON CONFLICT DO NOTHING;

-- GRADE 10 LESSONS: Probability
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Introduction to Probability',
'{"intro": "Probability measures how likely something is to happen. It ranges from 0 (impossible) to 1 (certain).", "steps": [{"title": "Basic Probability", "body": "Probability of an event = (number of favourable outcomes) ÷ (total number of possible outcomes). Always between 0 and 1.", "board": "P(event) = favourable outcomes / total outcomes"}, {"title": "Sample Space", "body": "The sample space is the list of all possible outcomes. For a die: {1, 2, 3, 4, 5, 6}. For a coin: {Heads, Tails}.", "board": "Die: 6 outcomes, Coin: 2 outcomes"}, {"title": "Complementary Events", "body": "The probability of something NOT happening is 1 minus the probability of it happening. P(not A) = 1 − P(A).", "board": "P(rain) = 0.3 → P(no rain) = 1 − 0.3 = 0.7"}], "examples": [{"problem": "A bag in a Kabwe shop has 5 red, 3 blue, and 2 green marbles. What is the probability of picking a blue marble?", "solution": "Total = 10. P(blue) = 3/10 = 0.3 or 30%."}], "summary": "Probability = favourable/total. Sample space = all possible outcomes. P(not A) = 1 − P(A). Probability ranges from 0 to 1."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Probability'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Combined Events and Tree Diagrams',
'{"intro": "When two events happen together, we use tree diagrams to find all possible outcomes and their probabilities.", "steps": [{"title": "Tree Diagrams", "body": "Draw branches for each event. Multiply along branches for combined probabilities. Add across branches for OR scenarios.", "board": "Multiply along, add across"}, {"title": "Independent Events", "body": "Two events are independent if one does not affect the other. P(A and B) = P(A) × P(B).", "board": "P(A and B) = P(A) × P(B)"}, {"title": "Mutually Exclusive Events", "body": "Two events are mutually exclusive if they cannot both happen. P(A or B) = P(A) + P(B).", "board": "P(A or B) = P(A) + P(B) (mutually exclusive)"}], "examples": [{"problem": "A pupil in Lusaka flips a coin and rolls a die. What is the probability of heads and a 6?", "solution": "P(H and 6) = P(H) × P(6) = 1/2 × 1/6 = 1/12."}], "summary": "Tree diagrams show all outcomes. Independent events: P(A and B) = P(A) × P(B). Mutually exclusive: P(A or B) = P(A) + P(B)."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Probability'
ON CONFLICT DO NOTHING;

-- ============================================================
-- GRADE 11 TOPICS
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description) VALUES
(4, 'Functions', 'Algebra', 'G11-1', 1, 'Understanding functions, domain and range, function notation, and graphing different types of functions.'),
(4, 'Coordinate Geometry', 'Geometry', 'G11-2', 2, 'The geometry of points, lines, and curves on a coordinate plane, including distance, midpoint, and gradient.'),
(4, 'Sequences and Series', 'Algebra', 'G11-3', 3, 'Arithmetic and geometric sequences, finding the nth term, and summing series.')
ON CONFLICT (grade, name) DO NOTHING;

-- GRADE 11 LESSONS: Functions
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Understanding Functions',
'{"intro": "A function is a rule that takes an input and gives exactly one output. We write f(x) to mean a function of x.", "steps": [{"title": "What is a Function?", "body": "A function maps each input to exactly one output. Think of it as a machine: you put in x, and it gives back f(x).", "board": "f(x) = 2x + 3: f(4) = 2(4) + 3 = 11"}, {"title": "Domain and Range", "body": "The domain is all valid inputs. The range is all possible outputs. For f(x) = √x, the domain is x ≥ 0.", "board": "Domain: valid inputs. Range: possible outputs."}, {"title": "Function Notation", "body": "f(x) means the output when the input is x. f(2) means substitute x = 2. This notation is used throughout mathematics.", "board": "f(x) = x² → f(3) = 9, f(−2) = 4"}], "examples": [{"problem": "The cost of a taxi in Lusaka is C(n) = 5 + 2n, where n is kilometres. Find C(10) and explain what it means.", "solution": "C(10) = 5 + 2(10) = 25. A 10-kilometre ride costs K25."}], "summary": "A function maps each input to one output. f(x) is function notation. Domain = valid inputs, range = possible outputs."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Functions'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Types of Functions and Their Graphs',
'{"intro": "Different functions produce different shapes when graphed. Recognising these shapes helps us understand the function''s behavior.", "steps": [{"title": "Linear Functions", "body": "f(x) = mx + c produces a straight line. m is the gradient (slope) and c is the y-intercept.", "board": "f(x) = 2x + 1 → straight line, slope = 2, y-intercept = 1"}, {"title": "Quadratic Functions", "body": "f(x) = ax² + bx + c produces a parabola. If a > 0, it opens upward. If a < 0, it opens downward.", "board": "f(x) = x² → upward parabola. f(x) = −x² → downward parabola"}, {"title": "Exponential Functions", "body": "f(x) = aˣ grows rapidly. The graph curves upward steeply. Used in population growth and compound interest.", "board": "f(x) = 2ˣ → rapid growth curve"}], "examples": [{"problem": "A population of bacteria in a lab in Lusaka doubles every hour: P(t) = 100 × 2ᵗ. How many bacteria after 3 hours?", "solution": "P(3) = 100 × 2³ = 100 × 8 = 800 bacteria."}], "summary": "Linear: straight line (y = mx + c). Quadratic: parabola (y = ax² + bx + c). Exponential: rapid growth curve (y = aˣ)."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 4 AND t.name = 'Functions'
ON CONFLICT DO NOTHING;

-- GRADE 11 LESSONS: Coordinate Geometry
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Distance, Midpoint, and Gradient',
'{"intro": "Coordinate geometry puts shapes on a grid with x and y axes. We can calculate distances, midpoints, and gradients between any two points.", "steps": [{"title": "Distance Formula", "body": "The distance between (x₁, y₁) and (x₂, y₂) is d = √((x₂−x₁)² + (y₂−y₁)²). This is Pythagoras in 2D.", "board": "d = √((x₂−x₁)² + (y₂−y₁)²)"}, {"title": "Midpoint Formula", "body": "The midpoint of a line segment is the average of the coordinates: M = ((x₁+x₂)/2, (y₁+y₂)/2).", "board": "Midpoint = ((x₁+x₂)/2, (y₁+y₂)/2)"}, {"title": "Gradient", "body": "The gradient (slope) between two points is m = (y₂−y₁)/(x₂−x₁). It measures steepness and direction.", "board": "m = (y₂−y₁)/(x₂−x₁)"}], "examples": [{"problem": "Two towns on a map have coordinates A(1, 2) and B(4, 6). Find the distance, midpoint, and gradient of the line AB.", "solution": "Distance = √(9+16) = 5. Midpoint = (2.5, 4). Gradient = 4/3."}], "summary": "Distance = √((x₂−x₁)² + (y₂−y₁)²). Midpoint = average of coordinates. Gradient = (y₂−y₁)/(x₂−x₁)."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Coordinate Geometry'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Equations of Lines',
'{"intro": "Every straight line on a coordinate plane can be described by an equation. The most useful forms are gradient-intercept and point-gradient.", "steps": [{"title": "Gradient-Intercept Form", "body": "y = mx + c, where m is the gradient and c is the y-intercept. This is the most common form.", "board": "y = 2x + 3 → gradient = 2, y-intercept = 3"}, {"title": "Point-Gradient Form", "body": "y − y₁ = m(x − x₁), where m is the gradient and (x₁, y₁) is a point on the line.", "board": "y − 5 = 2(x − 1) → y = 2x + 3"}, {"title": "Parallel and Perpendicular Lines", "body": "Parallel lines have the same gradient. Perpendicular lines have gradients that multiply to −1: m₁ × m₂ = −1.", "board": "Parallel: m₁ = m₂. Perpendicular: m₁ × m₂ = −1"}], "examples": [{"problem": "A road on a map passes through (1, 3) and (4, 9). Find the equation of the road in gradient-intercept form.", "solution": "m = (9−3)/(4−1) = 2. y − 3 = 2(x − 1) → y = 2x + 1."}], "summary": "y = mx + c (gradient-intercept). y − y₁ = m(x − x₁) (point-gradient). Parallel: same gradient. Perpendicular: m₁ × m₂ = −1."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 4 AND t.name = 'Coordinate Geometry'
ON CONFLICT DO NOTHING;

-- GRADE 11 LESSONS: Sequences and Series
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Arithmetic Sequences',
'{"intro": "An arithmetic sequence is a list of numbers where each term increases or decreases by a constant amount, called the common difference.", "steps": [{"title": "The Common Difference", "body": "In an arithmetic sequence, the difference between consecutive terms is constant. We call it d. Example: 3, 7, 11, 15, ... has d = 4.", "board": "d = a₂ − a₁ = 7 − 3 = 4"}, {"title": "The nth Term", "body": "The nth term is aₙ = a + (n−1)d, where a is the first term and d is the common difference.", "board": "aₙ = a + (n − 1)d"}, {"title": "Sum of n Terms", "body": "The sum of the first n terms is Sₙ = n/2 × (2a + (n−1)d) or Sₙ = n/2 × (first + last).", "board": "Sₙ = n/2 × (2a + (n−1)d)"}], "examples": [{"problem": "A pupil saves K50 in week 1, K60 in week 2, K70 in week 3, and so on. How much will they save in week 10? What is the total after 10 weeks?", "solution": "a = 50, d = 10. Week 10: a₁₀ = 50 + 9(10) = K140. Total: S₁₀ = 10/2 × (100 + 90) = 5 × 190 = K950."}], "summary": "Arithmetic: constant difference d. nth term: aₙ = a + (n−1)d. Sum: Sₙ = n/2 × (2a + (n−1)d)."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Sequences and Series'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Geometric Sequences',
'{"intro": "A geometric sequence is a list of numbers where each term is multiplied by a constant ratio to get the next term.", "steps": [{"title": "The Common Ratio", "body": "In a geometric sequence, each term is the previous term multiplied by a constant called the common ratio r. Example: 2, 6, 18, 54, ... has r = 3.", "board": "r = a₂/a₁ = 6/2 = 3"}, {"title": "The nth Term", "body": "The nth term is aₙ = a × r^(n−1), where a is the first term and r is the common ratio.", "board": "aₙ = a × r^(n−1)"}, {"title": "Sum of n Terms", "body": "The sum of the first n terms is Sₙ = a(r^n − 1)/(r − 1) when r ≠ 1.", "board": "Sₙ = a(rⁿ − 1)/(r − 1), r ≠ 1"}], "examples": [{"problem": "A business in Kitwe doubles its profit each year. If year 1 profit is K5,000, what is the profit in year 5? What is the total profit over 5 years?", "solution": "a = 5000, r = 2. Year 5: 5000 × 2⁴ = K80,000. Total: 5000(2⁵ − 1)/(2 − 1) = 5000 × 31 = K155,000."}], "summary": "Geometric: constant ratio r. nth term: aₙ = a × r^(n−1). Sum: Sₙ = a(rⁿ − 1)/(r − 1). Used for compound growth."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 4 AND t.name = 'Sequences and Series'
ON CONFLICT DO NOTHING;

-- ============================================================
-- GRADE 12 TOPICS
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description) VALUES
(5, 'Calculus Basics', 'Calculus', 'G12-1', 1, 'Differentiation from first principles, rules of differentiation, and applications to gradients and turning points.'),
(5, 'Advanced Trigonometry', 'Trigonometry', 'G12-2', 2, 'Trigonometric identities, compound angle formulas, and solving trigonometric equations.'),
(5, 'ECZ Exam Practice', 'Examination', 'G12-3', 3, 'Practice with ECZ past paper questions covering all Grade 12 Mathematics topics, with exam-style marking.')
ON CONFLICT (grade, name) DO NOTHING;

-- GRADE 12 LESSONS: Calculus Basics
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Introduction to Differentiation',
'{"intro": "Calculus is the mathematics of change. Differentiation is the first major branch — it measures how quickly a function is changing, giving us the gradient at any point.", "steps": [{"title": "The Derivative", "body": "The derivative of a function f(x) tells us the rate of change at any point. We write it as f''(x) or dy/dx. It gives the gradient of the tangent line.", "board": "f''(x) = dy/dx = gradient of tangent"}, {"title": "The Power Rule", "body": "For f(x) = xⁿ, the derivative is f''(x) = nx^(n−1). This is the most used differentiation rule.", "board": "f(x) = x³ → f''(x) = 3x²"}, {"title": "Differentiating Constants and Sums", "body": "The derivative of a constant is 0. The derivative of a sum is the sum of the derivatives. So d/dx(3x² + 5x + 2) = 6x + 5.", "board": "d/dx(3x² + 5x + 2) = 6x + 5"}], "examples": [{"problem": "The position of a minibus from Kabwe is s(t) = 5t² + 3t metres. Find the velocity (derivative of position) at t = 4 seconds.", "solution": "v(t) = s''(t) = 10t + 3. v(4) = 10(4) + 3 = 43 m/s."}], "summary": "The derivative measures rate of change. Power rule: d/dx(xⁿ) = nx^(n−1). Constants differentiate to 0. Differentiate term by term for sums."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'Calculus Basics'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Applications of Differentiation',
'{"intro": "Differentiation helps us find gradients of curves, identify turning points (maxima and minima), and solve optimisation problems.", "steps": [{"title": "Gradient of a Curve", "body": "The derivative f''(x) gives the gradient of the tangent to the curve at any point. Substitute x to get the gradient at that point.", "board": "f(x) = x² → f''(3) = 6 → gradient at x=3 is 6"}, {"title": "Turning Points", "body": "At a turning point, the gradient is 0. Set f''(x) = 0 and solve for x. Use the second derivative to check if it''s a maximum or minimum.", "board": "f''(x) = 0 → turning point. f''''(x) > 0 → min, f''''(x) < 0 → max"}, {"title": "Optimisation", "body": "To find the maximum or minimum of a real quantity, express it as a function, differentiate, set to zero, and solve.", "board": "Maximise area: dA/dx = 0 → solve for x"}], "examples": [{"problem": "A farmer in Monze has 100m of fencing for a rectangular field against a river (no fence needed on the river side). Find the dimensions that maximise the area.", "solution": "Let width = x, length = 100 − 2x. A = x(100 − 2x) = 100x − 2x². dA/dx = 100 − 4x = 0 → x = 25. Length = 50, width = 25. Area = 1250m²."}], "summary": "Gradient of curve = f''(x). Turning points: f''(x) = 0. Second derivative test: f''''(x) > 0 → minimum, f''''(x) < 0 → maximum. Use for optimisation."}'::jsonb,
'advanced', 2
FROM topics t WHERE t.grade = 5 AND t.name = 'Calculus Basics'
ON CONFLICT DO NOTHING;

-- GRADE 12 LESSONS: Advanced Trigonometry
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Trigonometric Identities',
'{"intro": "Trigonometric identities are equations that are true for all values of the variable. They are essential for simplifying expressions and solving equations.", "steps": [{"title": "The Pythagorean Identity", "body": "The most fundamental identity: sin²θ + cos²θ = 1. This is true for all values of θ and comes directly from Pythagoras'' theorem on the unit circle.", "board": "sin²θ + cos²θ = 1"}, {"title": "Related Identities", "body": "Dividing the Pythagorean identity by cos²θ gives tan²θ + 1 = sec²θ. Dividing by sin²θ gives 1 + cot²θ = cosec²θ.", "board": "tan²θ + 1 = sec²θ, 1 + cot²θ = cosec²θ"}, {"title": "Using Identities", "body": "Identities simplify expressions and solve equations. Replace one trig function with another to make the equation easier to solve.", "board": "Solve: 2sin²θ + cosθ − 1 = 0 → use sin²θ = 1 − cos²θ"}], "examples": [{"problem": "Simplify the expression: (sin²θ + cos²θ) × tan θ.", "solution": "Since sin²θ + cos²θ = 1, the expression simplifies to 1 × tan θ = tan θ."}], "summary": "sin²θ + cos²θ = 1 is the key identity. Related: tan²θ + 1 = sec²θ, 1 + cot²θ = cosec²θ. Use identities to simplify and solve trig equations."}'::jsonb,
'advanced', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'Advanced Trigonometry'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Compound Angle Formulas',
'{"intro": "Compound angle formulas allow us to find trig values of sums and differences of angles. They are heavily tested in ECZ exams.", "steps": [{"title": "Addition Formulas", "body": "sin(A + B) = sinA cosB + cosA sinB. cos(A + B) = cosA cosB − sinA sinB. tan(A + B) = (tanA + tanB)/(1 − tanA tanB).", "board": "sin(A+B) = sinAcosB + cosAsinB"}, {"title": "Double Angle Formulas", "body": "Setting A = B in the addition formulas gives: sin2A = 2sinAcosA, cos2A = cos²A − sin²A = 2cos²A − 1 = 1 − 2sin²A.", "board": "sin2A = 2sinAcosA, cos2A = cos²A − sin²A"}, {"title": "Solving Trig Equations", "body": "Use identities and compound angle formulas to rewrite equations in terms of a single trig function, then solve.", "board": "Solve: cos2θ = 0.5 → 2θ = 60° or 300° → θ = 30° or 150°"}], "examples": [{"problem": "Find the exact value of sin 75° using compound angle formulas.", "solution": "sin 75° = sin(45° + 30°) = sin45°cos30° + cos45°sin30° = (√2/2)(√3/2) + (√2/2)(1/2) = (√6 + √2)/4."}], "summary": "Addition: sin(A+B) = sinAcosB + cosAsinB. Double angle: sin2A = 2sinAcosA, cos2A = cos²A − sin²A. Use to solve trig equations in ECZ exams."}'::jsonb,
'advanced', 2
FROM topics t WHERE t.grade = 5 AND t.name = 'Advanced Trigonometry'
ON CONFLICT DO NOTHING;

-- GRADE 12 LESSONS: ECZ Exam Practice
INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'ECZ Past Paper Practice — Algebra and Calculus',
'{"intro": "This lesson covers ECZ-style exam questions from Algebra and Calculus topics. We work through past paper questions step by step, focusing on exam technique.", "steps": [{"title": "Exam Question 1 — Quadratic Equations", "body": "Solve the equation 3x² − 5x − 2 = 0 using the quadratic formula. Show all working clearly.", "board": "a=3, b=−5, c=−2. x = (5 ± √(25+24))/6 = (5 ± 7)/6 → x = 2 or x = −1/3"}, {"title": "Exam Question 2 — Differentiation", "body": "Find the coordinates of the turning point of y = x³ − 3x² + 2 and determine its nature.", "board": "dy/dx = 3x² − 6x = 0 → x = 0 or x = 2. At x=1: y=0. At x=2: y=−2. Second derivative: 6x − 6. At x=0: min, at x=2: max."}, {"title": "Exam Technique Tips", "body": "Always show your method. Write formulas before substituting. Check your answers make sense. Label final answers clearly.", "board": "Method marks matter! Show every step."}], "examples": [{"problem": "ECZ 2023: The function f(x) = 2x³ − 3x² − 12x + 5 has turning points. Find them and determine their nature.", "solution": "f''(x) = 6x² − 6x − 12 = 0 → x² − x − 2 = 0 → (x−2)(x+1) = 0 → x = 2 or x = −1. f(2) = −11 (min), f(−1) = 12 (max)."}], "summary": "ECZ exam questions require clear method. Show formulas, substitute carefully, label answers. Practice past papers to build speed and confidence."}'::jsonb,
'advanced', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Exam Practice'
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'ECZ Past Paper Practice — Trigonometry and Statistics',
'{"intro": "This lesson covers ECZ-style exam questions from Trigonometry and Statistics. These are commonly tested areas in the Grade 12 ECZ Mathematics exam.", "steps": [{"title": "Exam Question 1 — Trigonometry", "body": "Solve the equation 2sin²θ + sinθ − 1 = 0 for 0° ≤ θ ≤ 360°.", "board": "Let x = sinθ: 2x² + x − 1 = 0 → (2x − 1)(x + 1) = 0 → sinθ = 1/2 or sinθ = −1 → θ = 30°, 150°, 270°"}, {"title": "Exam Question 2 — Statistics", "body": "The mean of 5 numbers is 12. When a sixth number is added, the mean becomes 13. Find the sixth number.", "board": "Sum of 5 = 60. Sum of 6 = 78. Sixth number = 78 − 60 = 18."}, {"title": "Exam Technique Tips", "body": "For trig equations, use substitution to turn them into quadratics. For statistics, remember: mean = total/count, so total = mean × count.", "board": "Substitution trick: let x = sinθ to solve trig quadratics."}], "examples": [{"problem": "ECZ 2022: In a triangle, angle A = 60°, side b = 8cm, side c = 5cm. Find side a using the cosine rule.", "solution": "a² = b² + c² − 2bc cosA = 64 + 25 − 2(8)(5)(0.5) = 89 − 40 = 49. a = 7cm."}], "summary": "Trig equations: substitute to make quadratics. Statistics: mean × count = total. Cosine rule: a² = b² + c² − 2bc cosA. Practice ECZ past papers regularly."}'::jsonb,
'advanced', 2
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Exam Practice'
ON CONFLICT DO NOTHING;

-- ============================================================
-- PRACTICE QUESTIONS
-- ============================================================

-- Grade 8: Integers
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the value of −5 + 3?', 'multiple_choice',
'["−8","−2","2","8"]'::jsonb, '−2',
'−5 and +3 have different signs. Subtract: 5 − 3 = 2. The larger number is negative, so the answer is −2.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Integers'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Evaluate: −4 × −3', 'multiple_choice',
'["−12","−7","7","12"]'::jsonb, '12',
'Multiplying two negative numbers gives a positive result. −4 × −3 = 12.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Integers'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A shopkeeper in Ndola had K200. He spent K350 on supplies. What is his balance?', 'numeric',
'null'::jsonb, '−150',
'200 − 350 = −150. His balance is −K150 (he owes K150).', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Integers'
ON CONFLICT DO NOTHING;

-- Grade 8: Algebraic Expressions
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Simplify: 3x + 5x − 2x', 'multiple_choice',
'["4x","6x","8x","10x"]'::jsonb, '6x',
'Collect like terms: 3 + 5 − 2 = 6. So 3x + 5x − 2x = 6x.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Algebraic Expressions'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Expand: 4(x + 3)', 'multiple_choice',
'["4x + 3","4x + 7","4x + 12","x + 12"]'::jsonb, '4x + 12',
'Multiply 4 by each term inside the brackets: 4 × x = 4x, 4 × 3 = 12. So 4(x + 3) = 4x + 12.', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Algebraic Expressions'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'If x = 5, find the value of 3x − 7', 'numeric',
'null'::jsonb, '8',
'Substitute x = 5: 3(5) − 7 = 15 − 7 = 8.', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Algebraic Expressions'
ON CONFLICT DO NOTHING;

-- Grade 8: Basic Geometry
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Two angles of a triangle are 45° and 65°. What is the third angle?', 'multiple_choice',
'["60°","70°","80°","90°"]'::jsonb, '70°',
'Angles in a triangle sum to 180°. Third angle = 180° − 45° − 65° = 70°.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Basic Geometry'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'The angles of a quadrilateral are 80°, 100°, 90°, and x°. Find x.', 'numeric',
'null'::jsonb, '90',
'Quadrilateral angles sum to 360°. x = 360° − 80° − 100° − 90° = 90°.', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Basic Geometry'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which shape has all sides equal and all angles 90°?', 'multiple_choice',
'["Rectangle","Rhombus","Square","Parallelogram"]'::jsonb, 'Square',
'A square has all four sides equal and all four angles equal to 90°.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Basic Geometry'
ON CONFLICT DO NOTHING;

-- Grade 8: Ratios and Proportion
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Simplify the ratio 12:8', 'multiple_choice',
'["3:2","2:3","4:3","6:4"]'::jsonb, '3:2',
'Divide both by GCF(5,8) = 4. So 12:8 = 3:2.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Ratios and Proportion'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Share K300 in the ratio 2:3. How much does the smaller share get?', 'numeric',
'null'::jsonb, '120',
'Total parts = 5. One part = 300 ÷ 5 = 60. Smaller share = 2 × 60 = K120.', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Ratios and Proportion'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'If 4 pens cost K20, how much do 7 pens cost?', 'multiple_choice',
'["K25","K30","K35","K40"]'::jsonb, 'K35',
'1 pen = 20 ÷ 4 = K5. 7 pens = 7 × 5 = K35.', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Ratios and Proportion'
ON CONFLICT DO NOTHING;

-- Grade 9: Linear Equations
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Solve: 2x + 5 = 17', 'multiple_choice',
'["4","6","11","12"]'::jsonb, '6',
'2x + 5 = 17 → 2x = 12 → x = 6.', 'introductory'
FROM topics t WHERE t.grade = 2 AND t.name = 'Linear Equations'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Solve: 3(x − 2) = 9', 'numeric',
'null'::jsonb, '5',
'3(x − 2) = 9 → x − 2 = 3 → x = 5.', 'standard'
FROM topics t WHERE t.grade = 2 AND t.name = 'Linear Equations'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Solve: 5x − 3 = 2x + 9', 'multiple_choice',
'["2","3","4","5"]'::jsonb, '4',
'5x − 2x = 9 + 3 → 3x = 12 → x = 4.', 'standard'
FROM topics t WHERE t.grade = 2 AND t.name = 'Linear Equations'
ON CONFLICT DO NOTHING;

-- Grade 9: Pythagoras Theorem
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'In a right triangle, the two shorter sides are 6cm and 8cm. What is the hypotenuse?', 'multiple_choice',
'["10cm","12cm","14cm","15cm"]'::jsonb, '10cm',
'c = √(6² + 8²) = √(36 + 64) = √100 = 10cm.', 'introductory'
FROM topics t WHERE t.grade = 2 AND t.name = 'Pythagoras Theorem'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'The hypotenuse is 13cm and one side is 5cm. What is the other side?', 'numeric',
'null'::jsonb, '12',
'a = √(13² − 5²) = √(169 − 25) = √144 = 12cm.', 'standard'
FROM topics t WHERE t.grade = 2 AND t.name = 'Pythagoras Theorem'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A rectangle measures 9m by 12m. What is the length of the diagonal?', 'numeric',
'null'::jsonb, '15',
'Diagonal = √(9² + 12²) = √(81 + 144) = √225 = 15m.', 'standard'
FROM topics t WHERE t.grade = 2 AND t.name = 'Pythagoras Theorem'
ON CONFLICT DO NOTHING;

-- Grade 9: Statistics Basics
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the mean of: 4, 8, 6, 10, 2', 'numeric',
'null'::jsonb, '6',
'Mean = (4 + 8 + 6 + 10 + 2) ÷ 5 = 30 ÷ 5 = 6.', 'introductory'
FROM topics t WHERE t.grade = 2 AND t.name = 'Statistics Basics'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the median of: 3, 7, 9, 1, 5', 'numeric',
'null'::jsonb, '5',
'Ordered: 1, 3, 5, 7, 9. The middle value is 5.', 'standard'
FROM topics t WHERE t.grade = 2 AND t.name = 'Statistics Basics'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the mode of: 2, 5, 5, 7, 2, 5, 8', 'multiple_choice',
'["2","5","7","8"]'::jsonb, '5',
'The mode is the most frequent value. 5 appears three times, more than any other number.', 'introductory'
FROM topics t WHERE t.grade = 2 AND t.name = 'Statistics Basics'
ON CONFLICT DO NOTHING;

-- Grade 10: Quadratic Equations
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Solve: x² − 5x + 6 = 0', 'multiple_choice',
'["x = 1 or x = 6","x = 2 or x = 3","x = −2 or x = −3","x = 0 or x = 5"]'::jsonb, 'x = 2 or x = 3',
'Factorise: (x − 2)(x − 3) = 0 → x = 2 or x = 3.', 'introductory'
FROM topics t WHERE t.grade = 3 AND t.name = 'Quadratic Equations'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Using the quadratic formula, solve: x² + 4x + 1 = 0 (give exact answers)', 'short_answer',
'null'::jsonb, 'x = −2 ± √3',
'a=1, b=4, c=1. x = (−4 ± √(16−4))/2 = (−4 ± √12)/2 = (−4 ± 2√3)/2 = −2 ± √3.', 'advanced'
FROM topics t WHERE t.grade = 3 AND t.name = 'Quadratic Equations'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the discriminant of 2x² + 3x − 5 = 0?', 'numeric',
'null'::jsonb, '49',
'Δ = b² − 4ac = 9 − 4(2)(−5) = 9 + 40 = 49. Since Δ > 0, there are two real solutions.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Quadratic Equations'
ON CONFLICT DO NOTHING;

-- Grade 10: Trigonometry
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'In a right triangle, the opposite side is 3 and the hypotenuse is 5. What is sin θ?', 'multiple_choice',
'["3/5","5/3","4/5","3/4"]'::jsonb, '3/5',
'sin θ = opposite/hypotenuse = 3/5.', 'introductory'
FROM topics t WHERE t.grade = 3 AND t.name = 'Trigonometry'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'If cos θ = 0.8 and the hypotenuse is 10, what is the length of the adjacent side?', 'numeric',
'null'::jsonb, '8',
'cos θ = adjacent/hypotenuse → adjacent = 0.8 × 10 = 8.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Trigonometry'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A tree casts a shadow 20m long. The angle of elevation to the top is 35°. How tall is the tree? (Round to the nearest metre)', 'numeric',
'null'::jsonb, '14',
'Height = 20 × tan 35° ≈ 20 × 0.700 = 14m.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Trigonometry'
ON CONFLICT DO NOTHING;

-- Grade 10: Probability
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A die is rolled. What is the probability of rolling a number greater than 4?', 'multiple_choice',
'["1/6","2/6","3/6","4/6"]'::jsonb, '2/6',
'Numbers greater than 4: {5, 6}. That''s 2 out of 6 outcomes. P = 2/6 = 1/3.', 'introductory'
FROM topics t WHERE t.grade = 3 AND t.name = 'Probability'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A bag has 4 red and 6 blue marbles. What is the probability of picking a red marble?', 'short_answer',
'null'::jsonb, '4/10',
'Total = 10. P(red) = 4/10 = 2/5 = 0.4.', 'introductory'
FROM topics t WHERE t.grade = 3 AND t.name = 'Probability'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'P(A) = 0.6. What is P(not A)?', 'numeric',
'null'::jsonb, '0.4',
'P(not A) = 1 − P(A) = 1 − 0.6 = 0.4.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Probability'
ON CONFLICT DO NOTHING;

-- Grade 11: Functions
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'If f(x) = 3x² − 2x, find f(4)', 'numeric',
'null'::jsonb, '40',
'f(4) = 3(16) − 2(4) = 48 − 8 = 40.', 'introductory'
FROM topics t WHERE t.grade = 4 AND t.name = 'Functions'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the y-intercept of f(x) = 2x − 5?', 'multiple_choice',
'["−5","−2","2","5"]'::jsonb, '−5',
'In y = mx + c form, the y-intercept is c. Here c = −5.', 'introductory'
FROM topics t WHERE t.grade = 4 AND t.name = 'Functions'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A population doubles every hour: P(t) = 50 × 2ᵗ. Find P(4).', 'numeric',
'null'::jsonb, '800',
'P(4) = 50 × 2⁴ = 50 × 16 = 800.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Functions'
ON CONFLICT DO NOTHING;

-- Grade 11: Coordinate Geometry
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the distance between A(1, 2) and B(4, 6)', 'numeric',
'null'::jsonb, '5',
'd = √((4−1)² + (6−2)²) = √(9 + 16) = √25 = 5.', 'introductory'
FROM topics t WHERE t.grade = 4 AND t.name = 'Coordinate Geometry'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the midpoint of the line from (2, 4) to (6, 8)', 'short_answer',
'null'::jsonb, '(4, 6)',
'Midpoint = ((2+6)/2, (4+8)/2) = (4, 6).', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Coordinate Geometry'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the gradient of the line through (1, 3) and (4, 9)?', 'numeric',
'null'::jsonb, '2',
'm = (9−3)/(4−1) = 6/3 = 2.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Coordinate Geometry'
ON CONFLICT DO NOTHING;

-- Grade 11: Sequences and Series
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the 10th term of: 3, 7, 11, 15, ...', 'numeric',
'null'::jsonb, '39',
'a = 3, d = 4. a₁₀ = 3 + 9(4) = 3 + 36 = 39.', 'introductory'
FROM topics t WHERE t.grade = 4 AND t.name = 'Sequences and Series'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the sum of the first 20 terms of: 5, 8, 11, 14, ...', 'numeric',
'null'::jsonb, '670',
'a = 5, d = 3. S₂₀ = 20/2 × (2(5) + 19(3)) = 10 × (10 + 57) = 10 × 67 = 670.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Sequences and Series'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the 5th term of: 2, 6, 18, 54, ...', 'numeric',
'null'::jsonb, '162',
'a = 2, r = 3. a₅ = 2 × 3⁴ = 2 × 81 = 162.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Sequences and Series'
ON CONFLICT DO NOTHING;

-- Grade 12: Calculus Basics
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Differentiate: f(x) = 4x³', 'multiple_choice',
'["4x²","12x²","12x³","4x"]'::jsonb, '12x²',
'Power rule: d/dx(4x³) = 4 × 3x² = 12x².', 'introductory'
FROM topics t WHERE t.grade = 5 AND t.name = 'Calculus Basics'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the derivative of f(x) = 5x² − 3x + 7', 'short_answer',
'null'::jsonb, '10x − 3',
'd/dx(5x²) = 10x, d/dx(−3x) = −3, d/dx(7) = 0. So f''(x) = 10x − 3.', 'standard'
FROM topics t WHERE t.grade = 5 AND t.name = 'Calculus Basics'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Find the x-coordinate of the turning point of y = x² − 4x + 3', 'numeric',
'null'::jsonb, '2',
'dy/dx = 2x − 4 = 0 → x = 2. The turning point is at x = 2.', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'Calculus Basics'
ON CONFLICT DO NOTHING;

-- Grade 12: Advanced Trigonometry
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Simplify: sin²θ + cos²θ', 'multiple_choice',
'["0","1","sin θ","cos θ"]'::jsonb, '1',
'This is the Pythagorean identity: sin²θ + cos²θ = 1 for all θ.', 'introductory'
FROM topics t WHERE t.grade = 5 AND t.name = 'Advanced Trigonometry'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Express cos2θ in terms of cos θ only', 'short_answer',
'null'::jsonb, '2cos²θ − 1',
'cos2θ = cos²θ − sin²θ. Using sin²θ = 1 − cos²θ: cos2θ = cos²θ − (1 − cos²θ) = 2cos²θ − 1.', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'Advanced Trigonometry'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Solve 2sin²θ + sinθ − 1 = 0 for 0° ≤ θ ≤ 90°', 'numeric',
'null'::jsonb, '30',
'Let x = sinθ: 2x² + x − 1 = 0 → (2x − 1)(x + 1) = 0 → sinθ = 1/2 or sinθ = −1. In range: θ = 30°.', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'Advanced Trigonometry'
ON CONFLICT DO NOTHING;

-- Grade 12: ECZ Exam Practice
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'ECZ-style: Solve 3x² − 5x − 2 = 0 using the quadratic formula. What are the solutions?', 'short_answer',
'null'::jsonb, 'x = 2 or x = −1/3',
'a=3, b=−5, c=−2. x = (5 ± √(25+24))/6 = (5 ± 7)/6. x = 2 or x = −1/3.', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Exam Practice'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'ECZ-style: The mean of 5 numbers is 12. A sixth number is added and the mean becomes 13. What is the sixth number?', 'numeric',
'null'::jsonb, '18',
'Sum of 5 = 5 × 12 = 60. Sum of 6 = 6 × 13 = 78. Sixth number = 78 − 60 = 18.', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Exam Practice'
ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'ECZ-style: In a triangle, A = 60°, b = 8cm, c = 5cm. Using the cosine rule, find side a.', 'numeric',
'null'::jsonb, '7',
'a² = 64 + 25 − 2(8)(5)cos60° = 89 − 40 = 49. a = 7cm.', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Exam Practice'
ON CONFLICT DO NOTHING;
