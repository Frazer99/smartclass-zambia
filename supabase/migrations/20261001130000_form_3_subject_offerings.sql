/*
# Form 3 subject offering

Form 3 follows the Mathematics, Physics, and Chemistry pathway. Science
remains available for Forms 1-2, while Physics and Chemistry begin at Form 3.
*/

UPDATE subjects SET grades = '{1,2}' WHERE code = 'SCI';
UPDATE subjects SET grades = '{3,4,5,6}' WHERE code IN ('PHY', 'CHEM');
UPDATE subjects SET grades = '{1,2,3,4,5,6}' WHERE code = 'MATH';
