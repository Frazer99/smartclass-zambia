/*
# SmartClass Zambia — Seed Subjects, Science/Physics/Chemistry Curriculum (Re-run)

Re-runs the full multi-subject seed after the search index function was fixed.
All statements use ON CONFLICT DO NOTHING for idempotency.
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
	IF EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'content_materials'::regclass
			AND conname = 'content_materials_grade_check'
			AND pg_get_constraintdef(oid) LIKE '%BETWEEN 8 AND 12%'
	) THEN
		ALTER TABLE content_materials DROP CONSTRAINT content_materials_grade_check;
		ALTER TABLE content_materials ADD CONSTRAINT content_materials_grade_check
			CHECK (grade IS NULL OR (grade BETWEEN 1 AND 12));
	END IF;
END $$;

-- ============================================================
-- SEED SUBJECTS
-- ============================================================
INSERT INTO subjects (name, code, grades, icon, color, display_order) VALUES
('Mathematics', 'MATH', '{1,2,3,4,5}', 'Calculator', '#E8B94B', 1),
('Science', 'SCI', '{1,2}', 'FlaskConical', '#3E7C6B', 2),
('Physics', 'PHY', '{3,4,5}', 'Atom', '#5B8FD9', 3),
('Chemistry', 'CHEM', '{3,4,5}', 'Vial', '#B5562F', 4)
ON CONFLICT (code) DO NOTHING;

-- Link existing Mathematics topics to Mathematics subject
UPDATE topics SET subject_id = (SELECT id FROM subjects WHERE code = 'MATH')
WHERE subject_id IS NULL AND grade BETWEEN 1 AND 5;

-- ============================================================
-- SCIENCE GRADE 8
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description, subject_id) VALUES
(1, 'Matter and States', 'Chemistry', 'S8-1', 1, 'Understanding the three states of matter, their properties, and changes of state.', (SELECT id FROM subjects WHERE code = 'SCI')),
(1, 'Living Things', 'Biology', 'S8-2', 2, 'Characteristics of living things, classification, and basic cell structure.', (SELECT id FROM subjects WHERE code = 'SCI')),
(1, 'Energy Forms', 'Physics', 'S8-3', 3, 'Different forms of energy, energy transfers, and conservation of energy.', (SELECT id FROM subjects WHERE code = 'SCI')),
(1, 'Earth and Space', 'Earth Science', 'S8-4', 4, 'The solar system, Earth structure, and basic geological processes.', (SELECT id FROM subjects WHERE code = 'SCI'))
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'States of Matter',
'{"intro": "Everything around us is made of matter. Matter can exist in three main states: solid, liquid, and gas. Each state has different properties.", "steps": [{"title": "What is Matter?", "body": "Matter is anything that has mass and takes up space. A book, water, and air are all matter. Matter is made up of tiny particles called atoms and molecules.", "board": "Solid → Liquid → Gas"}, {"title": "Properties of States", "body": "Solids have a fixed shape and volume. Liquids have a fixed volume but take the shape of their container. Gases have no fixed shape or volume and fill any container.", "board": "Solid: fixed shape, fixed volume. Liquid: takes container shape, fixed volume. Gas: fills container, no fixed volume."}, {"title": "Changes of State", "body": "Melting: solid to liquid. Freezing: liquid to solid. Evaporation: liquid to gas. Condensation: gas to liquid. Sublimation: solid directly to gas.", "board": "Melting, Freezing, Evaporation, Condensation, Sublimation"}], "examples": [{"problem": "In a Zambian home, water boils at 100 degrees Celsius and turns to steam. What change of state is this?", "solution": "Evaporation (or boiling) — liquid water changing to gas (steam)."}], "summary": "Matter exists as solid, liquid, or gas. Each state has distinct properties. Changes of state include melting, freezing, evaporation, and condensation."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 1 AND t.name = 'Matter and States' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI')
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Particle Model',
'{"intro": "The particle model explains the behavior of matter. Particles in solids are packed tightly, in liquids they can move, and in gases they spread out freely.", "steps": [{"title": "Particle Arrangement", "body": "In solids, particles are close together in a fixed pattern. In liquids, particles are close but can slide past each other. In gases, particles are far apart and move quickly.", "board": "Solid: tight pack. Liquid: loose pack. Gas: far apart."}, {"title": "Particle Movement", "body": "As temperature increases, particles gain energy and move faster. This is why heating causes solids to melt and liquids to evaporate.", "board": "More heat = faster particles = state change"}], "examples": [{"problem": "Why does an ice cream melt when left outside in Lusaka?", "solution": "Heat from the surroundings transfers energy to the ice cream particles, making them move faster and break their solid structure, turning to liquid."}], "summary": "The particle model explains matter: solids have tightly packed particles, liquids have sliding particles, gases have freely moving particles. Heat increases particle movement."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 1 AND t.name = 'Matter and States' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI')
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Characteristics of Living Things',
'{"intro": "All living things share certain characteristics that distinguish them from non-living things. These are called the life processes.", "steps": [{"title": "MRS GREN", "body": "Movement, Respiration, Sensitivity, Growth, Reproduction, Excretion, Nutrition. All living organisms carry out these seven processes.", "board": "MRS GREN: Movement, Respiration, Sensitivity, Growth, Reproduction, Excretion, Nutrition"}, {"title": "Cell Structure", "body": "All living things are made of cells. A cell has a nucleus, cytoplasm, and a cell membrane. Plant cells also have a cell wall and chloroplasts.", "board": "Cell: nucleus, cytoplasm, membrane. Plant cell also: cell wall, chloroplasts"}], "examples": [{"problem": "A goat in a Zambian village eats grass, grows, and produces waste. Which life processes is it showing?", "solution": "Nutrition (eating), Growth, Excretion (waste). These are three of the MRS GREN processes."}], "summary": "Living things show seven characteristics (MRS GREN). All are made of cells with a nucleus, cytoplasm, and membrane. Plant cells have additional structures."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 1 AND t.name = 'Living Things' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI')
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Classification of Living Things',
'{"intro": "Scientists classify living things into groups based on shared characteristics. The main groups are called kingdoms.", "steps": [{"title": "The Five Kingdoms", "body": "Living things are classified into: Animals, Plants, Fungi, Bacteria (Monera), and Protists. Each kingdom has distinct features.", "board": "Kingdoms: Animalia, Plantae, Fungi, Monera, Protista"}, {"title": "Vertebrates and Invertebrates", "body": "Animals with backbones are vertebrates (fish, amphibians, reptiles, birds, mammals). Animals without backbones are invertebrates (insects, worms, spiders).", "board": "Vertebrates: backbone. Invertebrates: no backbone."}], "examples": [{"problem": "A child in Chipata finds a creature with a backbone and feathers. Which kingdom and group does it belong to?", "solution": "Kingdom: Animalia. Group: Vertebrates (bird — has feathers and a backbone)."}], "summary": "Living things are classified into five kingdoms. Animals are divided into vertebrates (with backbone) and invertebrates (without backbone)."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 1 AND t.name = 'Living Things' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI')
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Forms of Energy',
'{"intro": "Energy is the ability to do work or cause change. It exists in many forms and can be transferred from one form to another.", "steps": [{"title": "Types of Energy", "body": "Kinetic (movement), Potential (stored), Thermal (heat), Chemical, Electrical, Light, Sound, Nuclear. Energy can change from one form to another.", "board": "Kinetic, Potential, Thermal, Chemical, Electrical, Light, Sound, Nuclear"}, {"title": "Energy Transfers", "body": "Energy cannot be created or destroyed, only transferred. A torch converts chemical energy in the battery to electrical energy to light energy.", "board": "Battery (chemical) → electrical → light + heat"}], "examples": [{"problem": "A woman in Kabwe cooks nshima using a charcoal stove. What energy transfers take place?", "solution": "Chemical energy in charcoal → thermal (heat) energy → cooks the food. Some heat is lost to the surroundings."}], "summary": "Energy exists in many forms: kinetic, potential, thermal, chemical, electrical, light, sound, nuclear. Energy is conserved — it transfers but is never created or destroyed."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 1 AND t.name = 'Energy Forms' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI')
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Conservation of Energy',
'{"intro": "The law of conservation of energy states that energy cannot be created or destroyed, only changed from one form to another.", "steps": [{"title": "The Law", "body": "Total energy before and after any process is the same. Some energy is always lost as heat, but it is not destroyed — it is transferred to the surroundings.", "board": "Energy in = Energy out (total is conserved)"}, {"title": "Efficiency", "body": "Not all energy is usefully transferred. A light bulb converts some energy to light but much to heat. Efficiency = useful energy out / total energy in.", "board": "Efficiency = useful output / total input"}], "examples": [{"problem": "A solar panel on a Zambian school roof converts 200J of solar energy to 40J of electrical energy. What is its efficiency?", "solution": "Efficiency = 40/200 = 0.2 = 20%. The remaining 80% is lost as heat."}], "summary": "Energy is conserved: it transfers between forms but is never created or destroyed. Efficiency measures how much input energy becomes useful output."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 1 AND t.name = 'Energy Forms' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI')
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Solar System',
'{"intro": "Our solar system consists of the Sun and everything that orbits it, including eight planets, moons, asteroids, and comets.", "steps": [{"title": "The Eight Planets", "body": "In order from the Sun: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune. The first four are rocky planets, the last four are gas giants.", "board": "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune"}, {"title": "Orbits and Gravity", "body": "Planets orbit the Sun in elliptical paths. Gravity from the Sun keeps planets in orbit. The closer a planet is to the Sun, the faster it orbits.", "board": "Gravity holds planets in orbit. Closer = faster orbit."}], "examples": [{"problem": "Why does Mercury take only 88 days to orbit the Sun while Neptune takes 165 years?", "solution": "Mercury is closest to the Sun, so the gravitational pull is strongest and its orbit is shortest. Neptune is farthest, so it has a much longer orbit."}], "summary": "The solar system has eight planets orbiting the Sun. Gravity keeps them in orbit. Inner planets are rocky, outer planets are gas giants."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 1 AND t.name = 'Earth and Space' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI')
ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Earth Structure and Rocks',
'{"intro": "The Earth is made up of layers. Rocks on the surface are constantly being formed, broken down, and reformed in the rock cycle.", "steps": [{"title": "Earth Layers", "body": "The Earth has four main layers: crust (outermost, thin), mantle (semi-molten rock), outer core (liquid metal), inner core (solid metal).", "board": "Crust → Mantle → Outer Core → Inner Core"}, {"title": "The Rock Cycle", "body": "Igneous rocks form from cooled magma. Sedimentary rocks form from compressed sediments. Metamorphic rocks form when rocks are changed by heat and pressure.", "board": "Igneous, Sedimentary, Metamorphic — the rock cycle"}], "examples": [{"problem": "In the Copperbelt, miners dig deep to find copper ore. Which Earth layer are they mining?", "solution": "They mine in the crust — the outermost layer of the Earth where mineral deposits are found."}], "summary": "Earth has four layers: crust, mantle, outer core, inner core. Rocks cycle between igneous, sedimentary, and metamorphic forms."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 1 AND t.name = 'Earth and Space' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI')
ON CONFLICT DO NOTHING;

-- Science G8 practice questions
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which state of matter has a fixed shape and fixed volume?', 'multiple_choice', '["Solid","Liquid","Gas","Plasma"]'::jsonb, 'Solid', 'Solids have both a fixed shape and a fixed volume. The particles are tightly packed and cannot move freely.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Matter and States' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the change of state from liquid to gas called?', 'multiple_choice', '["Melting","Freezing","Evaporation","Condensation"]'::jsonb, 'Evaporation', 'Evaporation is when a liquid changes to a gas. The reverse (gas to liquid) is condensation.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Matter and States' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What does MRS GREN stand for?', 'multiple_choice', '["The seven life processes","The five kingdoms","The three states of matter","The rock cycle"]'::jsonb, 'The seven life processes', 'MRS GREN: Movement, Respiration, Sensitivity, Growth, Reproduction, Excretion, Nutrition — the seven characteristics of all living things.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Living Things' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which of these is a vertebrate?', 'multiple_choice', '["Insect","Worm","Fish","Spider"]'::jsonb, 'Fish', 'Vertebrates have backbones. Fish have a backbone, while insects, worms, and spiders are invertebrates (no backbone).', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Living Things' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What energy transfer happens when a torch is switched on?', 'multiple_choice', '["Electrical to light","Chemical to electrical to light","Thermal to light","Kinetic to light"]'::jsonb, 'Chemical to electrical to light', 'The battery stores chemical energy, which is converted to electrical energy, then to light (and some heat) in the bulb.', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Energy Forms' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A device converts 300J of energy into 90J of useful output. What is its efficiency?', 'numeric', 'null'::jsonb, '30', 'Efficiency = useful output / total input = 90/300 = 0.30 = 30%.', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Energy Forms' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which planet is closest to the Sun?', 'multiple_choice', '["Venus","Mercury","Earth","Mars"]'::jsonb, 'Mercury', 'Mercury is the closest planet to the Sun, which is why it has the shortest orbital period of 88 days.', 'introductory'
FROM topics t WHERE t.grade = 1 AND t.name = 'Earth and Space' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which type of rock forms from cooled magma?', 'multiple_choice', '["Sedimentary","Metamorphic","Igneous","None"]'::jsonb, 'Igneous', 'Igneous rocks form when molten magma cools and solidifies. Examples include granite and basalt.', 'standard'
FROM topics t WHERE t.grade = 1 AND t.name = 'Earth and Space' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

-- ============================================================
-- SCIENCE GRADE 9
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description, subject_id) VALUES
(2, 'Cells and Reproduction', 'Biology', 'S9-1', 1, 'Cell structure, functions of cell parts, and human reproduction basics.', (SELECT id FROM subjects WHERE code = 'SCI')),
(2, 'Chemical Reactions', 'Chemistry', 'S9-2', 2, 'Types of chemical reactions, word equations, and balancing simple equations.', (SELECT id FROM subjects WHERE code = 'SCI')),
(2, 'Electricity', 'Physics', 'S9-3', 3, 'Current, voltage, resistance, and simple circuits.', (SELECT id FROM subjects WHERE code = 'SCI')),
(2, 'Environment', 'Environmental Science', 'S9-4', 4, 'Ecosystems, food chains, pollution, and conservation.', (SELECT id FROM subjects WHERE code = 'SCI'))
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Cell Structure and Function',
'{"intro": "Cells are the basic building blocks of all living things. Understanding their structure helps us understand how life works.", "steps": [{"title": "Parts of a Cell", "body": "Nucleus: controls the cell. Cytoplasm: where chemical reactions happen. Cell membrane: controls what enters and leaves. Cell wall (plants only): gives support. Chloroplasts (plants only): for photosynthesis.", "board": "Nucleus, Cytoplasm, Membrane, Cell wall (plant), Chloroplasts (plant)"}, {"title": "Specialized Cells", "body": "Cells are adapted to their function. Red blood cells carry oxygen (biconcave shape). Sperm cells swim (have a tail). Root hair cells absorb water (large surface area).", "board": "Red blood cell: biconcave. Sperm cell: has tail. Root hair cell: large surface area."}], "examples": [{"problem": "Why do plant cells have a cell wall but animal cells do not?", "solution": "Plants do not have bones, so the cell wall provides structural support to keep the plant upright. Animals have skeletons for support."}], "summary": "Cells have a nucleus, cytoplasm, and membrane. Plant cells also have a cell wall and chloroplasts. Cells are specialized for their functions."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 2 AND t.name = 'Cells and Reproduction' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Human Reproduction',
'{"intro": "Human reproduction is the process by which new individuals are produced. It involves the male and female reproductive systems.", "steps": [{"title": "The Reproductive Process", "body": "Fertilization occurs when a sperm cell meets an egg cell. The fertilized egg implants in the uterus and develops into a fetus over approximately 9 months.", "board": "Sperm + Egg → Fertilization → Fetus → Birth (9 months)"}, {"title": "Changes in Adolescence", "body": "During adolescence, the body undergoes physical and emotional changes due to hormones. These include growth spurts, development of secondary sexual characteristics, and mood changes.", "board": "Adolescence: hormones, growth, physical changes"}], "examples": [{"problem": "How long does a normal human pregnancy last?", "solution": "Approximately 9 months (about 40 weeks from the last menstrual period)."}], "summary": "Reproduction involves fertilization of egg by sperm. Pregnancy lasts about 9 months. Adolescence brings hormonal changes and physical development."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 2 AND t.name = 'Cells and Reproduction' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Types of Chemical Reactions',
'{"intro": "Chemical reactions happen when substances change into new substances. There are several types we need to know.", "steps": [{"title": "Common Reaction Types", "body": "Combination: A + B → AB. Decomposition: AB → A + B. Displacement: A + BC → AC + B. Combustion: burning in oxygen.", "board": "Combination, Decomposition, Displacement, Combustion"}, {"title": "Word Equations", "body": "We can describe reactions using word equations. For example: magnesium + oxygen → magnesium oxide. Reactants are on the left, products on the right.", "board": "Reactants → Products (e.g. magnesium + oxygen → magnesium oxide)"}], "examples": [{"problem": "When charcoal (carbon) burns in air, what reaction happens? Write the word equation.", "solution": "Combustion reaction. carbon + oxygen → carbon dioxide."}], "summary": "Chemical reactions include combination, decomposition, displacement, and combustion. Word equations show reactants becoming products."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 2 AND t.name = 'Chemical Reactions' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Balancing Equations',
'{"intro": "In chemical reactions, atoms are neither created nor destroyed. The number of atoms on each side of the equation must be equal.", "steps": [{"title": "Conservation of Mass", "body": "Mass is conserved in chemical reactions. The total mass of reactants equals the total mass of products. We balance equations to show this.", "board": "Mass of reactants = Mass of products"}, {"title": "How to Balance", "body": "Count atoms on each side. Add numbers (coefficients) in front of compounds to make both sides equal. Never change the formula itself.", "board": "H2 + O2 → H2O (unbalanced). 2H2 + O2 → 2H2O (balanced)"}], "examples": [{"problem": "Balance this equation: Mg + O2 → MgO", "solution": "2Mg + O2 → 2MgO. Now there are 2 Mg and 2 O on each side."}], "summary": "Mass is conserved in reactions. Balance equations by adding coefficients so atom counts match on both sides."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 2 AND t.name = 'Chemical Reactions' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Current, Voltage and Resistance',
'{"intro": "Electricity flows through circuits. Current is the flow of charge, voltage is the push, and resistance opposes the flow.", "steps": [{"title": "Key Terms", "body": "Current (I): flow of electrons, measured in amps. Voltage (V): electrical pressure, measured in volts. Resistance (R): opposition to current, measured in ohms.", "board": "I = current (amps), V = voltage (volts), R = resistance (ohms)"}, {"title": "Ohms Law", "body": "V = IR. Voltage = Current times Resistance. This relationship lets us calculate any one value if we know the other two.", "board": "V = I x R"}], "examples": [{"problem": "A bulb in a Zambian home has 240V across it and a resistance of 60 ohms. What current flows through it?", "solution": "I = V/R = 240/60 = 4 amps."}], "summary": "Current is the flow (amps), voltage is the push (volts), resistance opposes (ohms). Ohms Law: V = IR."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 2 AND t.name = 'Electricity' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Series and Parallel Circuits',
'{"intro": "Circuits can be connected in two ways: series and parallel. Each has different properties and uses.", "steps": [{"title": "Series Circuits", "body": "In a series circuit, components are connected one after another. The same current flows through each component. If one breaks, all stop working.", "board": "Series: one path. Same current everywhere. One breaks = all stop."}, {"title": "Parallel Circuits", "body": "In a parallel circuit, components are connected across separate branches. Each branch gets the full voltage. If one breaks, others keep working.", "board": "Parallel: multiple paths. Full voltage each branch. One breaks = others work."}], "examples": [{"problem": "Why are the lights in a Zambian home connected in parallel, not series?", "solution": "In parallel, each light gets the full 240V and if one bulb breaks, the others stay on. In series, one broken bulb would turn off all lights."}], "summary": "Series: one path, same current, one break stops all. Parallel: multiple paths, full voltage each, one break does not affect others."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 2 AND t.name = 'Electricity' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Ecosystems and Food Chains',
'{"intro": "An ecosystem is a community of living organisms and their physical environment. Energy flows through ecosystems via food chains.", "steps": [{"title": "Food Chains", "body": "A food chain shows how energy passes from one organism to another. Producer (plant) → Primary consumer (herbivore) → Secondary consumer (carnivore) → Decomposer.", "board": "Producer → Primary consumer → Secondary consumer → Decomposer"}, {"title": "Food Webs", "body": "Food webs show interconnected food chains in an ecosystem. They show that most organisms eat and are eaten by multiple species.", "board": "Food web: interconnected food chains"}], "examples": [{"problem": "In a Zambian game park, grass is eaten by zebras, which are eaten by lions. Write the food chain.", "solution": "Grass (producer) → Zebra (primary consumer) → Lion (secondary consumer)."}], "summary": "Ecosystems include living and non-living parts. Food chains show energy flow: producer → consumer → decomposer. Food webs show interconnected chains."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 2 AND t.name = 'Environment' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Pollution and Conservation',
'{"intro": "Pollution damages ecosystems. Conservation protects them. Understanding both helps us care for our environment.", "steps": [{"title": "Types of Pollution", "body": "Air pollution: smoke, vehicle emissions. Water pollution: industrial waste, plastic. Soil pollution: chemicals, pesticides. Noise pollution: traffic, machinery.", "board": "Air, Water, Soil, Noise pollution"}, {"title": "Conservation", "body": "Conservation means protecting and preserving the environment. This includes recycling, reducing waste, planting trees, and protecting wildlife habitats.", "board": "Conservation: reduce, reuse, recycle, protect habitats"}], "examples": [{"problem": "How can a school in Ndola reduce water pollution in the nearby river?", "solution": "Do not dump waste in the river. Use bins for rubbish. Plant trees along the riverbank to prevent soil erosion. Educate pupils about keeping water clean."}], "summary": "Pollution types: air, water, soil, noise. Conservation: reduce, reuse, recycle, protect habitats. Everyone has a role in protecting the environment."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 2 AND t.name = 'Environment' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

-- Science G9 practice
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which part of the cell controls its activities?', 'multiple_choice', '["Cytoplasm","Nucleus","Cell membrane","Cell wall"]'::jsonb, 'Nucleus', 'The nucleus contains the genetic material and controls all the activities of the cell.', 'introductory'
FROM topics t WHERE t.grade = 2 AND t.name = 'Cells and Reproduction' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the word equation for burning carbon (charcoal) in oxygen?', 'short_answer', 'null'::jsonb, 'carbon + oxygen → carbon dioxide', 'Combustion reaction: carbon combines with oxygen to produce carbon dioxide.', 'standard'
FROM topics t WHERE t.grade = 2 AND t.name = 'Chemical Reactions' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Using Ohms Law, find the current when V = 12V and R = 4 ohms.', 'numeric', 'null'::jsonb, '3', 'I = V/R = 12/4 = 3 amps.', 'standard'
FROM topics t WHERE t.grade = 2 AND t.name = 'Electricity' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'In a food chain, what comes after the producer?', 'multiple_choice', '["Decomposer","Primary consumer","Secondary consumer","Sun"]'::jsonb, 'Primary consumer', 'Food chain: Producer → Primary consumer (herbivore) → Secondary consumer (carnivore) → Decomposer.', 'introductory'
FROM topics t WHERE t.grade = 2 AND t.name = 'Environment' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'SCI') ON CONFLICT DO NOTHING;

-- ============================================================
-- PHYSICS GRADE 10
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description, subject_id) VALUES
(3, 'Motion and Forces', 'Mechanics', 'P10-1', 1, 'Describing motion using distance, speed, velocity, acceleration, and Newtons laws of motion.', (SELECT id FROM subjects WHERE code = 'PHY')),
(3, 'Work, Energy and Power', 'Mechanics', 'P10-2', 2, 'Calculating work done, kinetic and potential energy, and power in physical systems.', (SELECT id FROM subjects WHERE code = 'PHY')),
(3, 'Waves', 'Waves and Optics', 'P10-3', 3, 'Properties of waves, wave equations, sound waves, and the electromagnetic spectrum.', (SELECT id FROM subjects WHERE code = 'PHY')),
(3, 'Electricity and Circuits', 'Electricity', 'P10-4', 4, 'Electric current, voltage, resistance, Ohms law, and circuit analysis.', (SELECT id FROM subjects WHERE code = 'PHY'))
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Describing Motion',
'{"intro": "Motion is the change in position of an object over time. We describe motion using speed, velocity, and acceleration.", "steps": [{"title": "Speed and Velocity", "body": "Speed = distance / time. Velocity is speed in a given direction. The SI unit for both is metres per second (m/s).", "board": "Speed = distance / time (m/s). Velocity = speed + direction."}, {"title": "Acceleration", "body": "Acceleration is the rate of change of velocity. a = (v - u) / t, where v is final velocity, u is initial velocity, and t is time. Unit: m/s squared.", "board": "a = (v - u) / t (m/s^2)"}], "examples": [{"problem": "A minibus travels from Lusaka to Kafue, a distance of 45 km, in 30 minutes. What is its average speed in m/s?", "solution": "Distance = 45000 m, Time = 1800 s. Speed = 45000/1800 = 25 m/s."}], "summary": "Speed = distance/time. Velocity includes direction. Acceleration = change in velocity / time. SI units: m/s for speed, m/s^2 for acceleration."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Motion and Forces' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Newtons Laws of Motion',
'{"intro": "Sir Isaac Newton described three laws that explain how forces affect the motion of objects. These are the foundation of mechanics.", "steps": [{"title": "First Law (Inertia)", "body": "An object at rest stays at rest, and an object in motion stays in motion at constant velocity, unless acted upon by an unbalanced force.", "board": "First Law: No force = no change in motion (inertia)"}, {"title": "Second Law (F=ma)", "body": "Force = mass times acceleration. F = ma. The greater the mass, the more force needed to accelerate it. Unit of force: Newton (N).", "board": "F = m x a (Newtons)"}, {"title": "Third Law", "body": "For every action, there is an equal and opposite reaction. When you push a wall, the wall pushes back with equal force.", "board": "Third Law: Action = Reaction (equal and opposite)"}], "examples": [{"problem": "A 2 kg book is pushed with a force of 10 N. What is its acceleration?", "solution": "F = ma → a = F/m = 10/2 = 5 m/s^2."}], "summary": "First Law: inertia (no force = no change). Second Law: F = ma. Third Law: action = reaction. Force is measured in Newtons."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Motion and Forces' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Work, Energy and Power',
'{"intro": "In physics, work is done when a force moves an object. Energy is the capacity to do work. Power is the rate of doing work.", "steps": [{"title": "Work", "body": "Work = Force x Distance. W = Fd. Work is measured in Joules (J). If no movement occurs, no work is done.", "board": "W = F x d (Joules)"}, {"title": "Kinetic and Potential Energy", "body": "Kinetic energy: KE = 1/2 mv^2 (energy of motion). Potential energy: PE = mgh (stored energy due to height). Both measured in Joules.", "board": "KE = 1/2 mv^2. PE = mgh."}, {"title": "Power", "body": "Power = Work / Time. P = W/t. Measured in Watts (W). 1 Watt = 1 Joule per second.", "board": "P = W / t (Watts)"}], "examples": [{"problem": "A boy in Kitwe lifts a 5 kg bag of mealie meal to a height of 2 m. How much work does he do? (g = 10 m/s^2)", "solution": "Force = mg = 5 x 10 = 50 N. Work = Fd = 50 x 2 = 100 J."}], "summary": "Work = Force x Distance (Joules). KE = 1/2 mv^2. PE = mgh. Power = Work / Time (Watts)."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Work, Energy and Power' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Conservation of Energy in Physics',
'{"intro": "The principle of conservation of energy states that energy cannot be created or destroyed, only converted from one form to another.", "steps": [{"title": "Energy Conversion", "body": "A falling object converts PE to KE. At the top: all PE. At the bottom: all KE. In between: a mix of both. Total energy stays constant.", "board": "PE at top → KE at bottom. Total energy = constant."}, {"title": "Calculating with Conservation", "body": "PE at top = KE at bottom (ignoring friction). mgh = 1/2 mv^2. Mass cancels: gh = 1/2 v^2, so v = sqrt(2gh).", "board": "mgh = 1/2 mv^2 → v = sqrt(2gh)"}], "examples": [{"problem": "A ball is dropped from a height of 5 m. What is its speed just before hitting the ground? (g = 10 m/s^2)", "solution": "v = sqrt(2gh) = sqrt(2 x 10 x 5) = sqrt(100) = 10 m/s."}], "summary": "Energy is conserved: PE converts to KE in falling objects. v = sqrt(2gh). Total energy before = total energy after."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Work, Energy and Power' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Wave Properties',
'{"intro": "Waves transfer energy without transferring matter. Understanding wave properties is essential in physics.", "steps": [{"title": "Key Terms", "body": "Amplitude: maximum displacement from rest. Wavelength: distance between two consecutive peaks. Frequency: number of waves per second (Hz). Period: time for one wave.", "board": "Amplitude, Wavelength, Frequency (Hz), Period (s)"}, {"title": "The Wave Equation", "body": "v = f x lambda. Wave speed = frequency times wavelength. This applies to all types of waves.", "board": "v = f x lambda (wave speed = frequency x wavelength)"}], "examples": [{"problem": "A wave has a frequency of 50 Hz and a wavelength of 4 m. What is its speed?", "solution": "v = f x lambda = 50 x 4 = 200 m/s."}], "summary": "Waves transfer energy. Key properties: amplitude, wavelength, frequency, period. Wave equation: v = f x lambda."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Waves' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Sound and Electromagnetic Spectrum',
'{"intro": "Sound waves are mechanical waves that need a medium. Electromagnetic waves can travel through a vacuum.", "steps": [{"title": "Sound Waves", "body": "Sound is a longitudinal wave. It needs a medium (solid, liquid, or gas). It cannot travel through a vacuum. Speed of sound in air: about 340 m/s.", "board": "Sound: longitudinal, needs medium, 340 m/s in air"}, {"title": "Electromagnetic Spectrum", "body": "EM waves include: radio, microwave, infrared, visible light, ultraviolet, X-rays, gamma rays. They all travel at 3 x 10^8 m/s in a vacuum.", "board": "EM spectrum: radio, microwave, IR, visible, UV, X-ray, gamma. Speed = 3x10^8 m/s"}], "examples": [{"problem": "Why can astronauts on the Moon not hear each other directly, even if shouting?", "solution": "The Moon has no atmosphere (no medium). Sound is a mechanical wave and needs a medium to travel through."}], "summary": "Sound: longitudinal, needs medium. EM waves: transverse, can travel in vacuum. EM spectrum: radio to gamma rays. All EM waves travel at 3x10^8 m/s."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Waves' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Ohms Law and Circuits',
'{"intro": "Ohms Law describes the relationship between current, voltage, and resistance in electrical circuits.", "steps": [{"title": "Ohms Law", "body": "V = IR. Voltage = Current times Resistance. We can rearrange: I = V/R, R = V/I. Measured in volts, amps, and ohms.", "board": "V = I x R, I = V/R, R = V/I"}, {"title": "Circuit Analysis", "body": "In series: R_total = R1 + R2. In parallel: 1/R_total = 1/R1 + 1/R2. Current is the same in series, voltage is the same in parallel.", "board": "Series: R = R1 + R2. Parallel: 1/R = 1/R1 + 1/R2"}], "examples": [{"problem": "Two resistors of 6 ohms and 3 ohms are connected in series. What is the total resistance?", "solution": "Series: R = R1 + R2 = 6 + 3 = 9 ohms."}], "summary": "Ohms Law: V = IR. Series resistance adds directly. Parallel resistance: reciprocals add. Current same in series, voltage same in parallel."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Electricity and Circuits' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Electrical Power and Energy',
'{"intro": "Electrical appliances convert electrical energy into other forms. We can calculate the power and energy used.", "steps": [{"title": "Electrical Power", "body": "P = VI. Power = Voltage times Current. Also P = I^2 R and P = V^2/R. Measured in Watts.", "board": "P = V x I (Watts). Also P = I^2 R, P = V^2/R"}, {"title": "Electrical Energy", "body": "E = Pt. Energy = Power times time. Measured in Joules. For electricity bills: E = Pt in kWh (kilowatt-hours).", "board": "E = P x t (Joules or kWh)"}], "examples": [{"problem": "A Zambian household uses a 100 W bulb for 5 hours. How much energy is used in kWh?", "solution": "E = P x t = 0.1 kW x 5 h = 0.5 kWh."}], "summary": "Electrical power: P = VI (Watts). Energy: E = Pt (Joules or kWh). Zesco bills are based on kWh used."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Electricity and Circuits' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

-- Physics G10 practice
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A car accelerates from 0 to 20 m/s in 5 seconds. What is its acceleration?', 'numeric', 'null'::jsonb, '4', 'a = (v - u) / t = (20 - 0) / 5 = 4 m/s^2.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Motion and Forces' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'According to Newtons second law, if F = 20 N and m = 4 kg, what is a?', 'numeric', 'null'::jsonb, '5', 'F = ma → a = F/m = 20/4 = 5 m/s^2.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Motion and Forces' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'How much work is done when a 50 N force moves an object 3 m?', 'numeric', 'null'::jsonb, '150', 'W = F x d = 50 x 3 = 150 J.', 'introductory'
FROM topics t WHERE t.grade = 3 AND t.name = 'Work, Energy and Power' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A wave has frequency 25 Hz and wavelength 8 m. What is its speed?', 'numeric', 'null'::jsonb, '200', 'v = f x lambda = 25 x 8 = 200 m/s.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Waves' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the total resistance of 6 ohms and 3 ohms in parallel?', 'numeric', 'null'::jsonb, '2', '1/R = 1/6 + 1/3 = 1/6 + 2/6 = 3/6 = 1/2. R = 2 ohms.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Electricity and Circuits' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A 200 W heater runs for 10 hours. How many kWh of energy does it use?', 'numeric', 'null'::jsonb, '2', 'E = P x t = 0.2 kW x 10 h = 2 kWh.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Electricity and Circuits' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

-- ============================================================
-- PHYSICS GRADE 11
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description, subject_id) VALUES
(4, 'Gravitation', 'Mechanics', 'P11-1', 1, 'Newtons law of universal gravitation, gravitational field strength, and satellite motion.', (SELECT id FROM subjects WHERE code = 'PHY')),
(4, 'Thermodynamics', 'Thermal Physics', 'P11-2', 2, 'Heat transfer, specific heat capacity, and gas laws.', (SELECT id FROM subjects WHERE code = 'PHY')),
(4, 'Electromagnetism', 'Electricity and Magnetism', 'P11-3', 3, 'Magnetic fields, electromagnetic induction, and transformers.', (SELECT id FROM subjects WHERE code = 'PHY')),
(4, 'Modern Physics', 'Modern Physics', 'P11-4', 4, 'Photoelectric effect, wave-particle duality, and nuclear physics basics.', (SELECT id FROM subjects WHERE code = 'PHY'))
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Newtons Law of Gravitation',
'{"intro": "Newton realized that the same force that pulls an apple to the ground also keeps the Moon in orbit around the Earth.", "steps": [{"title": "The Law", "body": "Every particle attracts every other particle with a force proportional to the product of their masses and inversely proportional to the square of the distance between them. F = G m1 m2 / r^2.", "board": "F = G m1 m2 / r^2 (G = 6.67 x 10^-11)"}, {"title": "Gravitational Field", "body": "Gravitational field strength g = G M / r^2. On Earth surface, g is about 9.8 N/kg. It decreases with altitude.", "board": "g = G M / r^2. On Earth: g = 9.8 N/kg"}], "examples": [{"problem": "Why do astronauts feel weightless in the International Space Station?", "solution": "The ISS is in free fall around the Earth. The astronauts and the station fall at the same rate, so there is no normal force — they feel weightless."}], "summary": "F = G m1 m2 / r^2. Gravitational field g = G M / r^2. Gravity is universal and decreases with the square of distance."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Gravitation' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Heat Transfer',
'{"intro": "Heat energy can be transferred in three ways: conduction, convection, and radiation. Understanding these helps us design better homes and devices.", "steps": [{"title": "Three Methods", "body": "Conduction: heat through solids (particles vibrate and pass energy). Convection: heat through fluids (hot fluid rises, cold sinks). Radiation: heat through electromagnetic waves (no medium needed).", "board": "Conduction (solids), Convection (fluids), Radiation (no medium needed)"}, {"title": "Specific Heat Capacity", "body": "Different materials need different amounts of energy to heat up. Specific heat capacity c: E = mc(delta T). Energy = mass x specific heat x temperature change.", "board": "E = m x c x delta T (Joules)"}], "examples": [{"problem": "Why do metal cooking pots in Zambian kitchens often have wooden handles?", "solution": "Metal is a good conductor of heat — it would burn your hand. Wood is a poor conductor (insulator), so the handle stays cool enough to hold."}], "summary": "Heat transfers by conduction (solids), convection (fluids), and radiation (no medium). Specific heat: E = mc(delta T)."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 4 AND t.name = 'Thermodynamics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Electromagnetic Induction',
'{"intro": "Electromagnetic induction is the process of generating electricity using magnets and coils. It is how power stations generate electricity.", "steps": [{"title": "Faradays Law", "body": "When a conductor cuts through a magnetic field, a voltage is induced. The faster the movement, the greater the induced voltage.", "board": "Faradays Law: moving conductor in magnetic field → induced voltage"}, {"title": "Transformers", "body": "Transformers change voltage levels. Step-up: more turns on secondary. Step-down: fewer turns on secondary. Ratio: Vp/Vs = Np/Ns.", "board": "Transformer: Vp/Vs = Np/Ns"}], "examples": [{"problem": "Why does Zambia use transformers at Kafue Gorge power station?", "solution": "Generators produce electricity at a lower voltage. Step-up transformers increase voltage for efficient long-distance transmission, reducing energy loss in power lines."}], "summary": "Faradays Law: moving conductor in magnetic field induces voltage. Transformers: Vp/Vs = Np/Ns. Step-up for transmission, step-down for homes."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Electromagnetism' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Photoelectric Effect',
'{"intro": "The photoelectric effect was a breakthrough that changed physics. It showed that light behaves as particles, not just waves.", "steps": [{"title": "The Discovery", "body": "When light shines on a metal surface, electrons are emitted. But only if the light frequency is above a threshold. Brighter light below the threshold emits no electrons.", "board": "Light on metal → electrons emitted (if frequency above threshold)"}, {"title": "Einsteins Explanation", "body": "Light comes in packets called photons. Energy of a photon E = hf. If photon energy exceeds the work function, electrons are emitted. This won Einstein the Nobel Prize.", "board": "E = hf (photon energy). If E > work function, electron emitted."}], "examples": [{"problem": "Why does blue light cause photoelectric emission from a metal but red light does not, even if red is brighter?", "solution": "Blue light has higher frequency (more energy per photon). Each blue photon has enough energy to eject an electron. Red photons have less energy per photon, below the threshold."}], "summary": "Photoelectric effect: light ejects electrons from metal if frequency is high enough. E = hf. Einsteins photon explanation won the Nobel Prize."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 4 AND t.name = 'Modern Physics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

-- Physics G11 practice
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the SI unit of gravitational constant G?', 'multiple_choice', '["N m^2 / kg^2","N m / kg","N kg / m^2","N kg / m"]'::jsonb, 'N m^2 / kg^2', 'G = 6.67 x 10^-11 N m^2 / kg^2. The units come from F = G m1 m2 / r^2.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Gravitation' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'How is heat transferred through a vacuum?', 'multiple_choice', '["Conduction","Convection","Radiation","Insulation"]'::jsonb, 'Radiation', 'Radiation (electromagnetic waves) does not need a medium and can travel through a vacuum. Conduction and convection both need a medium.', 'introductory'
FROM topics t WHERE t.grade = 4 AND t.name = 'Thermodynamics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A transformer has 100 turns on the primary and 500 turns on the secondary. If Vp = 240V, what is Vs?', 'numeric', 'null'::jsonb, '1200', 'Vp/Vs = Np/Ns → 240/Vs = 100/500 → Vs = 240 x 500/100 = 1200V. This is a step-up transformer.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Electromagnetism' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'In the photoelectric effect, what determines whether electrons are emitted?', 'multiple_choice', '["Intensity of light","Frequency of light","Color of metal","Temperature of metal"]'::jsonb, 'Frequency of light', 'Only the frequency of light determines emission — not brightness. Photons must have enough energy (E = hf) to exceed the work function.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Modern Physics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

-- ============================================================
-- PHYSICS GRADE 12
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description, subject_id) VALUES
(5, 'Circular Motion', 'Mechanics', 'P12-1', 1, 'Uniform circular motion, centripetal force, and applications to satellites and vehicles.', (SELECT id FROM subjects WHERE code = 'PHY')),
(5, 'Electronics', 'Electronics', 'P12-2', 2, 'Semiconductors, diodes, transistors, and logic gates.', (SELECT id FROM subjects WHERE code = 'PHY')),
(5, 'Nuclear Physics', 'Modern Physics', 'P12-3', 3, 'Radioactivity, half-life, nuclear fission and fusion, and applications.', (SELECT id FROM subjects WHERE code = 'PHY')),
(5, 'ECZ Physics Past Papers', 'Examination', 'P12-4', 4, 'Practice with ECZ past paper questions covering all Grade 12 Physics topics.', (SELECT id FROM subjects WHERE code = 'PHY'))
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Uniform Circular Motion',
'{"intro": "When an object moves in a circle at constant speed, it is accelerating even though its speed does not change — because its direction is constantly changing.", "steps": [{"title": "Centripetal Force", "body": "The force that keeps an object moving in a circle is called centripetal force. F = mv^2/r, directed toward the center of the circle.", "board": "F = m v^2 / r (centripetal force, toward center)"}, {"title": "Angular Velocity", "body": "Angular velocity omega = v/r = 2pi/T, where T is the period of rotation. Measured in radians per second.", "board": "omega = v / r = 2pi / T (rad/s)"}], "examples": [{"problem": "A car goes around a circular bend of radius 50 m at 20 m/s. What centripetal force is needed if the car mass is 1000 kg?", "solution": "F = mv^2/r = 1000 x 400/50 = 8000 N."}], "summary": "Centripetal force F = mv^2/r keeps objects in circular motion. Angular velocity omega = v/r. The force is always directed toward the center."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'Circular Motion' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Semiconductors and Diodes',
'{"intro": "Semiconductors are materials with electrical properties between conductors and insulators. They are the basis of all modern electronics.", "steps": [{"title": "Doping", "body": "Pure silicon is a poor conductor. By adding impurities (doping), we create n-type (extra electrons) or p-type (missing electrons, or holes) semiconductors.", "board": "n-type: extra electrons. p-type: holes (missing electrons)."}, {"title": "The Diode", "body": "A p-n junction allows current to flow in one direction only. Forward bias: conducts. Reverse bias: blocks. Diodes are used for rectification (AC to DC).", "board": "Diode: forward bias = conducts, reverse bias = blocks"}], "examples": [{"problem": "Why are diodes used in phone chargers?", "solution": "Chargers convert AC from the wall to DC for the battery. Diodes form a bridge rectifier that converts AC to DC, allowing current to flow in one direction only."}], "summary": "Semiconductors are doped to create n-type and p-type. A p-n junction forms a diode that conducts in one direction only. Used for rectification (AC to DC)."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 5 AND t.name = 'Electronics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Radioactivity and Half-Life',
'{"intro": "Radioactive isotopes emit radiation and decay over time. The half-life is the time for half the atoms to decay.", "steps": [{"title": "Types of Radiation", "body": "Alpha: helium nuclei, stopped by paper. Beta: fast electrons, stopped by aluminum. Gamma: electromagnetic waves, stopped by thick lead.", "board": "Alpha (paper), Beta (aluminum), Gamma (lead) — penetrating power increases"}, {"title": "Half-Life", "body": "Half-life is the time for half the radioactive nuclei to decay. After n half-lives, fraction remaining = (1/2)^n.", "board": "After n half-lives: N = N0 x (1/2)^n"}], "examples": [{"problem": "A radioactive isotope has a half-life of 8 days. What fraction remains after 24 days?", "solution": "24 days = 3 half-lives. Fraction = (1/2)^3 = 1/8. So 12.5% remains."}], "summary": "Three radiation types: alpha (least penetrating), beta, gamma (most). Half-life: time for half to decay. After n half-lives: (1/2)^n remains."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'Nuclear Physics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'ECZ Physics Exam Practice',
'{"intro": "This lesson covers ECZ-style Physics exam questions from mechanics, electricity, and modern physics. We focus on exam technique and problem-solving.", "steps": [{"title": "Mechanics Question", "body": "A ball is thrown vertically upward at 15 m/s. How high does it rise? (g = 10 m/s^2)", "board": "v^2 = u^2 - 2as → 0 = 225 - 20s → s = 11.25 m"}, {"title": "Electricity Question", "body": "A 12V battery drives 2A through a circuit. What is the total resistance?", "board": "R = V/I = 12/2 = 6 ohms"}], "examples": [{"problem": "ECZ 2023: A car of mass 1200 kg moves at 20 m/s. What is its kinetic energy?", "solution": "KE = 1/2 mv^2 = 1/2 x 1200 x 400 = 240,000 J = 240 kJ."}], "summary": "ECZ Physics exams test mechanics, electricity, and modern physics. Always show working, use correct units, and label final answers clearly."}'::jsonb,
'advanced', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Physics Past Papers' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'ECZ Physics — Circuits and Waves',
'{"intro": "More ECZ-style questions covering circuits, waves, and electromagnetism — commonly tested in Grade 12 exams.", "steps": [{"title": "Circuits Question", "body": "Two 6 ohm resistors are connected in parallel. What is the total resistance?", "board": "1/R = 1/6 + 1/6 = 2/6 = 1/3 → R = 3 ohms"}, {"title": "Waves Question", "body": "A wave has speed 340 m/s and frequency 170 Hz. What is its wavelength?", "board": "lambda = v/f = 340/170 = 2 m"}], "examples": [{"problem": "ECZ 2022: A transformer has 200 primary turns and 50 secondary turns. If Vp = 240V, find Vs.", "solution": "Vs = Vp x Ns/Np = 240 x 50/200 = 60V. This is a step-down transformer."}], "summary": "Practice ECZ questions on circuits (Ohms Law, parallel/series), waves (v = f lambda), and transformers (Vp/Vs = Np/Ns)."}'::jsonb,
'advanced', 2
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Physics Past Papers' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

-- Physics G12 practice
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the centripetal force on a 2 kg object moving at 6 m/s in a circle of radius 3 m?', 'numeric', 'null'::jsonb, '24', 'F = mv^2/r = 2 x 36/3 = 24 N.', 'standard'
FROM topics t WHERE t.grade = 5 AND t.name = 'Circular Motion' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which type of radiation is the most penetrating?', 'multiple_choice', '["Alpha","Beta","Gamma","Neutron"]'::jsonb, 'Gamma', 'Gamma rays are electromagnetic waves and the most penetrating. Alpha is stopped by paper, beta by aluminum, gamma needs thick lead.', 'introductory'
FROM topics t WHERE t.grade = 5 AND t.name = 'Nuclear Physics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A radioactive isotope has a half-life of 5 days. What fraction remains after 15 days?', 'short_answer', 'null'::jsonb, '1/8', '15 days = 3 half-lives. Fraction remaining = (1/2)^3 = 1/8.', 'standard'
FROM topics t WHERE t.grade = 5 AND t.name = 'Nuclear Physics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'ECZ-style: A diode in forward bias does what?', 'multiple_choice', '["Blocks current","Conducts current","Amplifies current","Stores current"]'::jsonb, 'Conducts current', 'A diode in forward bias allows current to flow through. In reverse bias, it blocks current.', 'standard'
FROM topics t WHERE t.grade = 5 AND t.name = 'Electronics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'ECZ-style: A wave has speed 340 m/s and frequency 170 Hz. What is its wavelength?', 'numeric', 'null'::jsonb, '2', 'lambda = v/f = 340/170 = 2 m.', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Physics Past Papers' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'PHY') ON CONFLICT DO NOTHING;

-- ============================================================
-- CHEMISTRY GRADE 10
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description, subject_id) VALUES
(3, 'Atomic Structure', 'Physical Chemistry', 'C10-1', 1, 'The structure of the atom: protons, neutrons, electrons, electronic configuration, and isotopes.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(3, 'Periodic Table', 'Inorganic Chemistry', 'C10-2', 2, 'Organization of elements, groups and periods, trends in the periodic table.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(3, 'Chemical Bonding', 'Physical Chemistry', 'C10-3', 3, 'Ionic, covalent, and metallic bonding, and properties of bonded substances.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(3, 'Stoichiometry', 'Quantitative Chemistry', 'C10-4', 4, 'The mole concept, molar mass, and calculating quantities in chemical reactions.', (SELECT id FROM subjects WHERE code = 'CHEM'))
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Structure of the Atom',
'{"intro": "The atom is the smallest unit of matter that retains the properties of an element. Understanding atomic structure is the foundation of chemistry.", "steps": [{"title": "Subatomic Particles", "body": "Protons: positive charge, in the nucleus. Neutrons: no charge, in the nucleus. Electrons: negative charge, orbiting the nucleus. Atomic number = number of protons.", "board": "Proton (+), Neutron (0), Electron (-). Atomic number = protons."}, {"title": "Electronic Configuration", "body": "Electrons fill shells: 2, 8, 8, 18... The outermost shell determines chemical properties. For sodium (Na, atomic number 11): 2, 8, 1.", "board": "Shell filling: 2, 8, 8, 18. Example: Na = 2.8.1"}], "examples": [{"problem": "An atom has 11 protons and 12 neutrons. What is its atomic number and mass number?", "solution": "Atomic number = 11 (number of protons). Mass number = 11 + 12 = 23. This is sodium-23."}], "summary": "Atoms have protons (+), neutrons (0), and electrons (-). Atomic number = protons. Electrons fill shells: 2, 8, 8, 18. Mass number = protons + neutrons."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Atomic Structure' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Isotopes and Ions',
'{"intro": "Isotopes are atoms of the same element with different numbers of neutrons. Ions are charged atoms that have gained or lost electrons.", "steps": [{"title": "Isotopes", "body": "Isotopes have the same number of protons but different numbers of neutrons. Example: Carbon-12 (6p, 6n) and Carbon-14 (6p, 8n) are isotopes.", "board": "Isotopes: same protons, different neutrons. C-12 and C-14."}, {"title": "Ions", "body": "Cations: lose electrons, become positive (e.g. Na+). Anions: gain electrons, become negative (e.g. Cl-). The number of protons does not change.", "board": "Cation: loses electrons (+). Anion: gains electrons (-)."}], "examples": [{"problem": "Oxygen has 8 protons. An oxygen atom gains 2 electrons to form an ion. What is the charge of this ion?", "solution": "Gaining 2 electrons gives charge = -2. The ion is O^2- (oxide ion)."}], "summary": "Isotopes: same protons, different neutrons. Ions: atoms with gained/lost electrons. Cations are positive, anions are negative."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Atomic Structure' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Periodic Table',
'{"intro": "The periodic table organizes all known elements by their atomic number and chemical properties. It is one of the most important tools in chemistry.", "steps": [{"title": "Groups and Periods", "body": "Groups are vertical columns — elements in the same group have similar properties. Periods are horizontal rows — elements in the same period have the same number of electron shells.", "board": "Groups (columns) = similar properties. Periods (rows) = same electron shells."}, {"title": "Trends", "body": "Across a period: atomic radius decreases, electronegativity increases. Down a group: atomic radius increases, reactivity changes (increases for metals, decreases for non-metals).", "board": "Across period: radius decreases, EN increases. Down group: radius increases."}], "examples": [{"problem": "Why are Group 1 elements (like sodium and potassium) so reactive?", "solution": "They have 1 electron in their outer shell, which they easily lose to achieve a full outer shell. This makes them very reactive metals."}], "summary": "Periodic table: groups (columns, similar properties), periods (rows, same shells). Trends: radius and electronegativity change predictably across and down."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Periodic Table' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Periodic Trends',
'{"intro": "The periodic table shows clear patterns — trends — that help us predict how elements will behave chemically.", "steps": [{"title": "Atomic Radius", "body": "Atomic radius decreases across a period (more protons pull electrons closer). It increases down a group (more electron shells).", "board": "Radius: decreases across period, increases down group"}, {"title": "Electronegativity", "body": "Electronegativity increases across a period (stronger pull on electrons). It decreases down a group (outer electrons are farther from nucleus).", "board": "EN: increases across period, decreases down group"}], "examples": [{"problem": "Which has a larger atomic radius: Li or Na? Why?", "solution": "Na is larger. Both are in Group 1, but Na is below Li, so it has an extra electron shell, making it larger."}], "summary": "Atomic radius: decreases across periods, increases down groups. Electronegativity: increases across periods, decreases down groups."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Periodic Table' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Ionic and Covalent Bonding',
'{"intro": "Chemical bonds hold atoms together. The two main types are ionic bonds (transfer of electrons) and covalent bonds (sharing of electrons).", "steps": [{"title": "Ionic Bonding", "body": "Ionic bonds form when a metal transfers electrons to a non-metal. The metal becomes a positive ion, the non-metal a negative ion. They attract each other. Example: NaCl (sodium chloride).", "board": "Ionic: metal transfers electrons to non-metal. Na → Na+, Cl → Cl-. Attraction = ionic bond."}, {"title": "Covalent Bonding", "body": "Covalent bonds form when two non-metals share electrons. Each shared pair of electrons is one covalent bond. Example: H2O (water), where oxygen shares electrons with two hydrogen atoms.", "board": "Covalent: non-metals share electrons. H2O: O shares with 2 H atoms."}], "examples": [{"problem": "Common salt (NaCl) is formed from sodium (Na) and chlorine (Cl). What type of bond is this?", "solution": "Ionic bond. Sodium (metal) transfers its outer electron to chlorine (non-metal), forming Na+ and Cl- ions that attract each other."}], "summary": "Ionic: metal transfers electrons to non-metal (e.g. NaCl). Covalent: non-metals share electrons (e.g. H2O). The type depends on whether electrons are transferred or shared."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Chemical Bonding' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Metallic Bonding and Properties',
'{"intro": "Metals have unique properties due to metallic bonding, where electrons flow freely through a lattice of positive metal ions.", "steps": [{"title": "Metallic Bonding", "body": "In metals, outer electrons are delocalized — they flow freely through the structure. The positive metal ions are held together by this sea of electrons.", "board": "Metallic: positive ions in a sea of free electrons"}, {"title": "Properties of Metals", "body": "Metals conduct electricity (free electrons carry charge), conduct heat, are malleable (layers can slide), and have high melting points (strong bonds).", "board": "Metals: conduct electricity, conduct heat, malleable, high melting point"}], "examples": [{"problem": "Why do copper wires conduct electricity but plastic does not?", "solution": "Copper has free (delocalized) electrons that can carry electrical current. Plastic has no free electrons — it is an insulator."}], "summary": "Metallic bonding: positive ions in a sea of free electrons. This explains conductivity, malleability, and high melting points of metals."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Chemical Bonding' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Mole Concept',
'{"intro": "The mole is the chemists counting unit. Just as we count eggs in dozens, chemists count particles in moles.", "steps": [{"title": "Avogadros Number", "body": "1 mole = 6.02 x 10^23 particles (Avogadros number). This could be atoms, molecules, or ions. The mole links atomic scale to measurable quantities.", "board": "1 mole = 6.02 x 10^23 particles (Avogadros number)"}, {"title": "Molar Mass", "body": "The mass of 1 mole of a substance equals its relative atomic/molecular mass in grams. Example: 1 mole of H2O = 18 g (2x1 + 16).", "board": "Molar mass = RAM in grams. H2O = 18 g/mol."}], "examples": [{"problem": "How many molecules are in 2 moles of water (H2O)?", "solution": "2 moles x 6.02 x 10^23 = 1.204 x 10^24 molecules."}], "summary": "1 mole = 6.02 x 10^23 particles. Molar mass = relative mass in grams. Moles = mass / molar mass."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 3 AND t.name = 'Stoichiometry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Mole Calculations in Reactions',
'{"intro": "We can use the mole concept to calculate quantities in chemical reactions. This is called stoichiometry.", "steps": [{"title": "Moles from Mass", "body": "Moles = mass (g) / molar mass (g/mol). Example: 36 g of H2O = 36/18 = 2 moles.", "board": "Moles = mass / molar mass. 36 g H2O = 36/18 = 2 mol."}, {"title": "Reaction Calculations", "body": "Use the balanced equation to find mole ratios. If 2H2 + O2 → 2H2O, then 2 moles of H2 produce 2 moles of H2O. Scale up or down proportionally.", "board": "2H2 + O2 → 2H2O. 2 mol H2 → 2 mol H2O."}], "examples": [{"problem": "How many moles are in 80 g of NaOH (molar mass = 40 g/mol)?", "solution": "Moles = 80/40 = 2 moles of NaOH."}], "summary": "Moles = mass / molar mass. Balanced equations give mole ratios for reaction calculations. Scale proportionally for different masses."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 3 AND t.name = 'Stoichiometry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

-- Chemistry G10 practice
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the atomic number of an atom with 6 protons and 7 neutrons?', 'numeric', 'null'::jsonb, '6', 'Atomic number = number of protons = 6. This is carbon (C). Mass number = 6 + 7 = 13.', 'introductory'
FROM topics t WHERE t.grade = 3 AND t.name = 'Atomic Structure' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the electronic configuration of sodium (atomic number 11)?', 'short_answer', 'null'::jsonb, '2.8.1', 'Electrons fill shells: 2, 8, 8, 18... For 11 electrons: 2 + 8 + 1 = 11. So configuration is 2.8.1.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Atomic Structure' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which type of bond forms when sodium transfers an electron to chlorine?', 'multiple_choice', '["Covalent","Ionic","Metallic","Hydrogen"]'::jsonb, 'Ionic', 'Ionic bonds form when a metal (Na) transfers electrons to a non-metal (Cl), creating oppositely charged ions that attract.', 'introductory'
FROM topics t WHERE t.grade = 3 AND t.name = 'Chemical Bonding' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'How many particles are in 1 mole of any substance?', 'short_answer', 'null'::jsonb, '6.02 x 10^23', 'Avogadros number: 1 mole = 6.02 x 10^23 particles. This is the chemists counting unit.', 'introductory'
FROM topics t WHERE t.grade = 3 AND t.name = 'Stoichiometry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'How many moles are in 36 g of H2O (molar mass = 18 g/mol)?', 'numeric', 'null'::jsonb, '2', 'Moles = mass / molar mass = 36 / 18 = 2 moles.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Stoichiometry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What happens to atomic radius across a period (left to right)?', 'multiple_choice', '["Increases","Decreases","Stays the same","Varies randomly"]'::jsonb, 'Decreases', 'Across a period, more protons are added, pulling electrons closer to the nucleus. So atomic radius decreases.', 'standard'
FROM topics t WHERE t.grade = 3 AND t.name = 'Periodic Table' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

-- ============================================================
-- CHEMISTRY GRADE 11
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description, subject_id) VALUES
(4, 'Acids, Bases and Salts', 'Inorganic Chemistry', 'C11-1', 1, 'Properties of acids and bases, pH scale, neutralization, and salt formation.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(4, 'Organic Chemistry', 'Organic Chemistry', 'C11-2', 2, 'Hydrocarbons, functional groups, alkanes, alkenes, and alcohols.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(4, 'Redox Reactions', 'Physical Chemistry', 'C11-3', 3, 'Oxidation and reduction, oxidation numbers, and balancing redox equations.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(4, 'Energetics', 'Physical Chemistry', 'C11-4', 4, 'Exothermic and endothermic reactions, enthalpy changes, and bond energy calculations.', (SELECT id FROM subjects WHERE code = 'CHEM'))
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Acids and Bases',
'{"intro": "Acids and bases are two important classes of chemicals that we encounter every day — from lemon juice to soap.", "steps": [{"title": "Properties of Acids", "body": "Acids have pH below 7, turn blue litmus red, and react with metals to produce hydrogen gas. Examples: HCl, H2SO4, lemon juice (citric acid).", "board": "Acids: pH < 7, blue litmus → red, react with metals → H2 gas"}, {"title": "Properties of Bases", "body": "Bases have pH above 7, turn red litmus blue, and feel soapy. Soluble bases are called alkalis. Examples: NaOH, soap, ammonia.", "board": "Bases: pH > 7, red litmus → blue, feel soapy. Alkalis = soluble bases."}], "examples": [{"problem": "A pupil in Lusaka tests lemon juice and finds it turns blue litmus red. Is it an acid or a base?", "solution": "It is an acid. Acids turn blue litmus red and have pH below 7."}], "summary": "Acids: pH < 7, blue litmus to red, produce H2 with metals. Bases: pH > 7, red litmus to blue, feel soapy. Alkalis are soluble bases."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Acids, Bases and Salts' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Neutralization and Salts',
'{"intro": "When an acid reacts with a base, they neutralize each other and produce a salt and water. This is called a neutralization reaction.", "steps": [{"title": "Neutralization", "body": "Acid + Base → Salt + Water. Example: HCl + NaOH → NaCl + H2O. The salt formed depends on the acid and base used.", "board": "Acid + Base → Salt + Water. HCl + NaOH → NaCl + H2O"}, {"title": "The pH Scale", "body": "pH measures how acidic or basic a solution is. pH 7 is neutral (pure water). Below 7: acidic. Above 7: basic. pH 1 is strongly acidic, pH 14 is strongly basic.", "board": "pH scale: 0-14. 7 = neutral. < 7 = acid. > 7 = base."}], "examples": [{"problem": "A farmer in Mkushi adds lime (a base) to acidic soil. Why?", "solution": "The base neutralizes the acid in the soil, raising the pH to a level suitable for plant growth. This is a neutralization reaction."}], "summary": "Neutralization: Acid + Base → Salt + Water. pH scale: 0-14, 7 is neutral. Below 7 is acidic, above 7 is basic. Salts are named after the acid and base used."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 4 AND t.name = 'Acids, Bases and Salts' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Alkanes and Alkenes',
'{"intro": "Organic chemistry is the chemistry of carbon compounds. The simplest organic compounds are hydrocarbons — compounds of carbon and hydrogen only.", "steps": [{"title": "Alkanes", "body": "Alkanes are saturated hydrocarbons with only single bonds. General formula: CnH2n+2. Examples: methane (CH4), ethane (C2H6). They are unreactive compared to alkenes.", "board": "Alkanes: CnH2n+2. Single bonds only. CH4 (methane), C2H6 (ethane)."}, {"title": "Alkenes", "body": "Alkenes are unsaturated hydrocarbons with at least one double bond. General formula: CnH2n. Examples: ethene (C2H4). The double bond makes them more reactive than alkanes.", "board": "Alkenes: CnH2n. At least one double bond. C2H4 (ethene). More reactive."}], "examples": [{"problem": "A compound has formula C3H6. Is it an alkane or an alkene?", "solution": "Check the formula. Alkanes: CnH2n+2 → C3H8. Alkenes: CnH2n → C3H6. So C3H6 is an alkene (propene)."}], "summary": "Alkanes: CnH2n+2, single bonds, saturated. Alkenes: CnH2n, double bonds, unsaturated. The double bond makes alkenes more reactive."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Organic Chemistry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Functional Groups and Alcohols',
'{"intro": "Functional groups are specific groups of atoms within molecules that determine the chemical properties of the compound.", "steps": [{"title": "Common Functional Groups", "body": "Hydroxyl (-OH): alcohols. Carboxyl (-COOH): acids. Amino (-NH2): amines. The functional group determines the reactions a compound undergoes.", "board": "-OH (alcohols), -COOH (acids), -NH2 (amines)"}, {"title": "Alcohols", "body": "Alcohols have the -OH functional group. General formula: CnH2n+1OH. Example: ethanol (C2H5OH) — found in beer and spirits. Made by fermentation of sugars.", "board": "Alcohols: CnH2n+1OH. Ethanol = C2H5OH. Made by fermentation."}], "examples": [{"problem": "A traditional brew in Zambia is made by fermenting maize. What organic compound is produced?", "solution": "Fermentation produces ethanol (C2H5OH), an alcohol with the -OH functional group."}], "summary": "Functional groups determine chemical properties. -OH = alcohols (e.g. ethanol, C2H5OH). -COOH = acids. -NH2 = amines. Alcohols are made by fermentation."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 4 AND t.name = 'Organic Chemistry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Oxidation and Reduction',
'{"intro": "Oxidation and reduction (redox) reactions involve the transfer of electrons between substances. They happen all around us — from rusting to combustion.", "steps": [{"title": "Definitions", "body": "Oxidation: loss of electrons (OIL — Oxidation Is Loss). Reduction: gain of electrons (RIG — Reduction Is Gain). Together: OIL RIG.", "board": "Oxidation = loss of electrons. Reduction = gain of electrons. OIL RIG."}, {"title": "Oxidation Numbers", "body": "We assign oxidation numbers to track electron transfer. An increase in oxidation number = oxidation. A decrease = reduction.", "board": "Oxidation number increases = oxidized. Decreases = reduced."}], "examples": [{"problem": "In the reaction Zn + CuSO4 → ZnSO4 + Cu, is zinc oxidized or reduced?", "solution": "Zn goes from 0 to +2 (loses 2 electrons) — it is oxidized. Cu goes from +2 to 0 (gains 2 electrons) — it is reduced."}], "summary": "Oxidation: loss of electrons (OIL). Reduction: gain of electrons (RIG). Oxidation numbers track electron transfer. Increase = oxidation, decrease = reduction."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Redox Reactions' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Exothermic and Endothermic Reactions',
'{"intro": "Chemical reactions can release or absorb energy. This energy change tells us about the bonds being broken and formed.", "steps": [{"title": "Exothermic Reactions", "body": "Exothermic reactions release energy to the surroundings — temperature rises. Example: combustion, neutralization. Bond making releases more energy than bond breaking uses.", "board": "Exothermic: releases heat. Temperature rises. Example: combustion."}, {"title": "Endothermic Reactions", "body": "Endothermic reactions absorb energy from the surroundings — temperature falls. Example: photosynthesis, thermal decomposition. Bond breaking uses more energy than bond making releases.", "board": "Endothermic: absorbs heat. Temperature falls. Example: photosynthesis."}], "examples": [{"problem": "When charcoal burns in a Zambian home, the surroundings get warm. Is this exothermic or endothermic?", "solution": "Exothermic — combustion releases heat energy to the surroundings, causing the temperature to rise."}], "summary": "Exothermic: releases heat (temperature rises, e.g. combustion). Endothermic: absorbs heat (temperature falls, e.g. photosynthesis). Energy changes relate to bond breaking and making."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 4 AND t.name = 'Energetics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Bond Energy Calculations',
'{"intro": "We can calculate the energy change in a reaction by comparing the energy needed to break bonds with the energy released when new bonds form.", "steps": [{"title": "Calculating Energy Change", "body": "Energy change = bonds broken - bonds formed. If positive: endothermic (more energy needed to break). If negative: exothermic (more energy released).", "board": "Energy change = bonds broken - bonds formed. + = endothermic. - = exothermic."}, {"title": "Example Calculation", "body": "Breaking H-H (436 kJ) and Cl-Cl (242 kJ) bonds uses 678 kJ. Forming 2 H-Cl bonds (2 x 431 = 862 kJ) releases 862 kJ. Energy change = 678 - 862 = -184 kJ (exothermic).", "board": "H2 + Cl2 → 2HCl. Broken: 436+242=678. Formed: 2x431=862. Change = 678-862 = -184 kJ (exothermic)."}], "examples": [{"problem": "A reaction breaks bonds totaling 500 kJ and forms bonds totaling 750 kJ. Is it exothermic or endothermic?", "solution": "Energy change = 500 - 750 = -250 kJ. Negative means exothermic — 250 kJ of energy is released."}], "summary": "Energy change = bonds broken - bonds formed. Positive = endothermic. Negative = exothermic. Bond energies are measured in kJ/mol."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 4 AND t.name = 'Energetics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

-- Chemistry G11 practice
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What pH would you expect for lemon juice?', 'multiple_choice', '["pH 2 (acidic)","pH 7 (neutral)","pH 10 (basic)","pH 14 (strongly basic)"]'::jsonb, 'pH 2 (acidic)', 'Lemon juice contains citric acid, so it has a pH below 7. pH 2 is strongly acidic, which is expected for lemon juice.', 'introductory'
FROM topics t WHERE t.grade = 4 AND t.name = 'Acids, Bases and Salts' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What are the products of neutralizing HCl with NaOH?', 'short_answer', 'null'::jsonb, 'NaCl + H2O', 'Neutralization: Acid + Base → Salt + Water. HCl + NaOH → NaCl (sodium chloride) + H2O.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Acids, Bases and Salts' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which has a double bond — ethane (C2H6) or ethene (C2H4)?', 'multiple_choice', '["Ethane","Ethene","Both","Neither"]'::jsonb, 'Ethene', 'Ethene (C2H4) is an alkene with a C=C double bond. Ethane (C2H6) is an alkane with only single bonds.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Organic Chemistry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'In OIL RIG, what does oxidation mean?', 'multiple_choice', '["Gain of electrons","Loss of electrons","No change","Sharing electrons"]'::jsonb, 'Loss of electrons', 'OIL: Oxidation Is Loss. Oxidation means losing electrons. RIG: Reduction Is Gain. Reduction means gaining electrons.', 'introductory'
FROM topics t WHERE t.grade = 4 AND t.name = 'Redox Reactions' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Burning charcoal is what type of reaction?', 'multiple_choice', '["Endothermic","Exothermic","Neither","Neutral"]'::jsonb, 'Exothermic', 'Combustion releases heat to the surroundings, so it is exothermic. The temperature of the surroundings increases.', 'introductory'
FROM topics t WHERE t.grade = 4 AND t.name = 'Energetics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'A reaction breaks bonds of 600 kJ and forms bonds of 900 kJ. What is the energy change?', 'numeric', 'null'::jsonb, '-300', 'Energy change = bonds broken - bonds formed = 600 - 900 = -300 kJ. Negative means exothermic.', 'standard'
FROM topics t WHERE t.grade = 4 AND t.name = 'Energetics' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

-- ============================================================
-- CHEMISTRY GRADE 12
-- ============================================================
INSERT INTO topics (grade, name, category, syllabus_reference, display_order, description, subject_id) VALUES
(5, 'Chemical Equilibrium', 'Physical Chemistry', 'C12-1', 1, 'Reversible reactions, Le Chateliers principle, and the equilibrium constant.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(5, 'Analytical Chemistry', 'Analytical Chemistry', 'C12-2', 2, 'Qualitative analysis, identifying ions, and titration calculations.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(5, 'Industrial Chemistry', 'Applied Chemistry', 'C12-3', 3, 'The Haber process, contact process, and industrial applications in Zambia.', (SELECT id FROM subjects WHERE code = 'CHEM')),
(5, 'ECZ Chemistry Past Papers', 'Examination', 'C12-4', 4, 'Practice with ECZ past paper questions covering all Grade 12 Chemistry topics.', (SELECT id FROM subjects WHERE code = 'CHEM'))
ON CONFLICT (grade, name) DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Reversible Reactions and Equilibrium',
'{"intro": "Some reactions can go in both directions — forwards and backwards. When the rates of the forward and backward reactions are equal, the system is at equilibrium.", "steps": [{"title": "Dynamic Equilibrium", "body": "At equilibrium, the forward and backward reactions are still happening, but at the same rate. The concentrations of reactants and products stay constant — but not necessarily equal.", "board": "Dynamic equilibrium: forward rate = backward rate. Concentrations constant."}, {"title": "Le Chateliers Principle", "body": "If conditions change, the system shifts to oppose the change. Increase temperature: shifts to absorb heat (endothermic direction). Increase pressure: shifts to reduce pressure (fewer gas molecules).", "board": "Le Chatelier: system shifts to oppose the change."}], "examples": [{"problem": "In the Haber process N2 + 3H2 ↔ 2NH3, what happens if we increase pressure?", "solution": "Higher pressure shifts equilibrium toward the side with fewer gas molecules. Left: 4 molecules. Right: 2 molecules. So it shifts right — more ammonia is produced."}], "summary": "Dynamic equilibrium: forward and backward rates are equal. Le Chateliers principle: system shifts to oppose any change in conditions (temperature, pressure, concentration)."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'Chemical Equilibrium' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Equilibrium Constant',
'{"intro": "The equilibrium constant Kc tells us the ratio of products to reactants at equilibrium. It helps us predict how far a reaction goes.", "steps": [{"title": "Writing Kc", "body": "For aA + bB ↔ cC + dD, Kc = [C]^c [D]^d / ([A]^a [B]^b. Products on top, reactants on bottom. Each concentration raised to its coefficient.", "board": "Kc = [products] / [reactants]. Each raised to its coefficient."}, {"title": "Interpreting Kc", "body": "Kc > 1: products favored (reaction goes forward). Kc < 1: reactants favored. Kc = 1: roughly equal amounts of reactants and products.", "board": "Kc > 1: products favored. Kc < 1: reactants favored. Kc = 1: balanced."}], "examples": [{"problem": "For the equilibrium H2 + I2 ↔ 2HI, Kc = 50. Are products or reactants favored?", "solution": "Kc = 50 > 1, so products are favored. At equilibrium, there is more HI than H2 and I2."}], "summary": "Kc = [products]^coefficients / [reactants]^coefficients. Kc > 1: products favored. Kc < 1: reactants favored. Kc = 1: balanced."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 5 AND t.name = 'Chemical Equilibrium' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Qualitative Analysis',
'{"intro": "Qualitative analysis is the process of identifying unknown substances by testing how they react with known reagents.", "steps": [{"title": "Testing for Cations", "body": "Add NaOH: Cu2+ gives blue precipitate, Fe2+ gives green precipitate, Fe3+ gives brown precipitate. Add NH3: Al3+ gives white precipitate.", "board": "NaOH test: Cu2+ → blue, Fe2+ → green, Fe3+ → brown. NH3 test: Al3+ → white."}, {"title": "Testing for Anions", "body": "Add dilute HCl: CO3 2- fizzes (CO2 gas). Add HNO3 + AgNO3: Cl- gives white precipitate. Add HNO3 + BaCl2: SO4 2- gives white precipitate.", "board": "Anion tests: CO3 2- (fizz with HCl), Cl- (white with AgNO3), SO4 2- (white with BaCl2)."}], "examples": [{"problem": "A pupil adds NaOH to an unknown solution and gets a blue precipitate. Which cation is present?", "solution": "Blue precipitate with NaOH indicates Cu2+ (copper II) ions."}], "summary": "Cation tests: NaOH or NH3 produce characteristic colored precipitates. Anion tests: HCl, AgNO3, BaCl2 identify CO3 2-, Cl-, SO4 2-."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'Analytical Chemistry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'Titration Calculations',
'{"intro": "Titration is a technique to find the concentration of an unknown acid or base by reacting it with a known standard solution.", "steps": [{"title": "The Method", "body": "Fill a burette with known solution. Add indicator to the unknown in a flask. Slowly add from burette until color changes (end point). Record the volume used.", "board": "Titration: burette (known) + flask (unknown + indicator). Color change = end point."}, {"title": "Calculating Concentration", "body": "Use: moles acid = moles base (for 1:1 ratio). Ma x Va = Mb x Vb. Rearrange to find the unknown concentration.", "board": "Ma x Va = Mb x Vb. Find unknown from known values."}], "examples": [{"problem": "25.0 cm3 of NaOH solution is neutralized by 20.0 cm3 of 0.1 M HCl. Find the concentration of NaOH.", "solution": "Ma x Va = Mb x Vb → 0.1 x 20 = Mb x 25 → Mb = (0.1 x 20)/25 = 0.08 M. NaOH concentration is 0.08 M."}], "summary": "Titration finds unknown concentration using a known standard. Formula: Ma x Va = Mb x Vb. Indicator shows the end point by color change."}'::jsonb,
'standard', 2
FROM topics t WHERE t.grade = 5 AND t.name = 'Analytical Chemistry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'The Haber and Contact Processes',
'{"intro": "Industrial processes convert raw materials into useful products on a massive scale. Two key processes are the Haber process (ammonia) and the Contact process (sulfuric acid).", "steps": [{"title": "Haber Process", "body": "N2 + 3H2 ↔ 2NH3. Conditions: 450 degrees Celsius, 200 atm pressure, iron catalyst. Ammonia is used for fertilizers — critical for Zambian agriculture.", "board": "Haber: N2 + 3H2 ↔ 2NH3. 450C, 200 atm, Fe catalyst."}, {"title": "Contact Process", "body": "S + O2 → SO2, then 2SO2 + O2 ↔ 2SO3. Conditions: 450 degrees Celsius, vanadium catalyst. SO3 + H2SO4 → oleum, then diluted to H2SO4.", "board": "Contact: S → SO2 → SO3 → H2SO4. 450C, V2O5 catalyst."}], "examples": [{"problem": "Why is the Haber process important for Zambian farmers?", "solution": "It produces ammonia, which is used to make fertilizers. Fertilizers increase crop yields — essential for food security in Zambia."}], "summary": "Haber process: N2 + 3H2 ↔ 2NH3 (ammonia for fertilizers). Contact process: makes sulfuric acid. Both use catalysts and specific temperature/pressure for optimal yield."}'::jsonb,
'introductory', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'Industrial Chemistry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'ECZ Chemistry Exam Practice',
'{"intro": "This lesson covers ECZ-style Chemistry exam questions from equilibrium, analysis, and industrial chemistry — commonly tested in Grade 12 exams.", "steps": [{"title": "Equilibrium Question", "body": "For the equilibrium 2SO2 + O2 ↔ 2SO3, what happens if we increase the pressure?", "board": "Increase pressure → shift to side with fewer gas molecules. Left: 3 molecules. Right: 2. Shifts right → more SO3."}, {"title": "Analysis Question", "body": "A solution gives a white precipitate with AgNO3 and dilute HNO3. Which anion is present?", "board": "White precipitate with AgNO3 + HNO3 → Cl- (chloride ions)."}], "examples": [{"problem": "ECZ 2023: 25 cm3 of 0.1M HCl neutralizes 20 cm3 of NaOH. Find NaOH concentration.", "solution": "Ma x Va = Mb x Vb → 0.1 x 25 = Mb x 20 → Mb = (0.1 x 25)/20 = 0.125 M."}], "summary": "ECZ Chemistry exams test equilibrium (Le Chatelier), analysis (ion tests), titration (MaVa = MbVb), and industrial processes. Show all working and units."}'::jsonb,
'advanced', 1
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Chemistry Past Papers' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO lessons (topic_id, title, content, difficulty, display_order)
SELECT t.id, 'ECZ Chemistry — Organic and Energetics',
'{"intro": "More ECZ-style questions covering organic chemistry, energetics, and stoichiometry — all commonly tested in Grade 12 exams.", "steps": [{"title": "Organic Question", "body": "Name the compound C2H4 and state whether it is saturated or unsaturated.", "board": "C2H4 = ethene. It has a C=C double bond, so it is unsaturated."}, {"title": "Energetics Question", "body": "A reaction breaks bonds of 800 kJ and forms bonds of 1100 kJ. Calculate the energy change and state whether it is exothermic or endothermic.", "board": "Change = 800 - 1100 = -300 kJ. Negative = exothermic."}], "examples": [{"problem": "ECZ 2022: How many moles are in 20 g of NaOH (molar mass = 40 g/mol)?", "solution": "Moles = mass / molar mass = 20 / 40 = 0.5 moles."}], "summary": "ECZ Chemistry also covers organic (alkanes vs alkenes), energetics (bond energy calculations), and stoichiometry (mole calculations). Practice past papers."}'::jsonb,
'advanced', 2
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Chemistry Past Papers' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

-- Chemistry G12 practice
INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'At equilibrium, if Kc = 0.01, which side is favored?', 'multiple_choice', '["Products","Reactants","Neither","Both equally"]'::jsonb, 'Reactants', 'Kc < 1 means reactants are favored. At equilibrium, there are more reactants than products.', 'standard'
FROM topics t WHERE t.grade = 5 AND t.name = 'Chemical Equilibrium' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Le Chateliers principle says the system shifts to what?', 'multiple_choice', '["Oppose the change","Support the change","Ignore the change","Reverse the change"]'::jsonb, 'Oppose the change', 'Le Chateliers principle: when conditions change, the system shifts to oppose (counteract) the change and restore equilibrium.', 'introductory'
FROM topics t WHERE t.grade = 5 AND t.name = 'Chemical Equilibrium' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'Which cation gives a blue precipitate with NaOH?', 'short_answer', 'null'::jsonb, 'Cu2+', 'Cu2+ (copper II) ions give a blue precipitate with NaOH. This is a standard cation test in qualitative analysis.', 'standard'
FROM topics t WHERE t.grade = 5 AND t.name = 'Analytical Chemistry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'What is the main product of the Haber process?', 'multiple_choice', '["Sulfuric acid","Ammonia","Nitric acid","Ethanol"]'::jsonb, 'Ammonia', 'The Haber process: N2 + 3H2 ↔ 2NH3. The product is ammonia (NH3), used mainly for making fertilizers.', 'standard'
FROM topics t WHERE t.grade = 5 AND t.name = 'Industrial Chemistry' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'ECZ-style: 25 cm3 of 0.1M HCl neutralizes 20 cm3 of NaOH. Find NaOH concentration.', 'numeric', 'null'::jsonb, '0.125', 'Ma x Va = Mb x Vb → 0.1 x 25 = Mb x 20 → Mb = 2.5/20 = 0.125 M.', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Chemistry Past Papers' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

INSERT INTO practice_questions (topic_id, question_text, question_type, options, answer_key, explanation, difficulty)
SELECT t.id, 'ECZ-style: Name the compound C2H4 and state if it is saturated or unsaturated.', 'short_answer', 'null'::jsonb, 'ethene, unsaturated', 'C2H4 is ethene. It has a C=C double bond, making it unsaturated (alkene).', 'advanced'
FROM topics t WHERE t.grade = 5 AND t.name = 'ECZ Chemistry Past Papers' AND t.subject_id = (SELECT id FROM subjects WHERE code = 'CHEM') ON CONFLICT DO NOTHING;

-- ============================================================
-- CONTENT MATERIALS
-- ============================================================
INSERT INTO content_materials (subject_id, grade, material_type, title, source, source_reference, content_summary, status)
VALUES
(NULL, NULL, 'syllabus', 'ECZ Mathematics Syllabus Grades 8-12', 'Examinations Council of Zambia', 'ecz.edu.zm/syllabi/maths', 'Official ECZ Mathematics syllabus covering all grades 8-12 topics and learning outcomes.', 'approved'),
(NULL, NULL, 'syllabus', 'ECZ Science Syllabus Grades 8-9', 'Examinations Council of Zambia', 'ecz.edu.zm/syllabi/science', 'Official ECZ Integrated Science syllabus for junior secondary.', 'approved'),
(NULL, NULL, 'syllabus', 'ECZ Physics Syllabus Grades 10-12', 'Examinations Council of Zambia', 'ecz.edu.zm/syllabi/physics', 'Official ECZ Physics syllabus for senior secondary.', 'approved'),
(NULL, NULL, 'syllabus', 'ECZ Chemistry Syllabus Grades 10-12', 'Examinations Council of Zambia', 'ecz.edu.zm/syllabi/chemistry', 'Official ECZ Chemistry syllabus for senior secondary.', 'approved'),
(NULL, 5, 'past_paper', 'ECZ Mathematics Past Papers 2020-2024', 'Examinations Council of Zambia', 'ecz.edu.zm/pastpapers/maths', 'Collection of ECZ Grade 12 Mathematics past papers with marking schemes for exam preparation.', 'approved'),
(NULL, 5, 'past_paper', 'ECZ Physics Past Papers 2020-2024', 'Examinations Council of Zambia', 'ecz.edu.zm/pastpapers/physics', 'Collection of ECZ Grade 12 Physics past papers with marking schemes.', 'approved'),
(NULL, 5, 'past_paper', 'ECZ Chemistry Past Papers 2020-2024', 'Examinations Council of Zambia', 'ecz.edu.zm/pastpapers/chemistry', 'Collection of ECZ Grade 12 Chemistry past papers with marking schemes.', 'approved'),
(NULL, NULL, 'curriculum', 'Zambian Mathematics Curriculum Framework', 'Ministry of Education — Directorate of Curriculum Development', 'moe.gov.zm/curriculum/maths', 'Official curriculum framework from the Ministry of Education defining learning standards and outcomes for Mathematics.', 'approved'),
(NULL, NULL, 'curriculum', 'Zambian Science Curriculum Framework', 'Ministry of Education — Directorate of Curriculum Development', 'moe.gov.zm/curriculum/science', 'Official curriculum framework for Integrated Science from the Ministry of Education.', 'approved'),
(NULL, NULL, 'curriculum', 'Zambian Physics Curriculum Framework', 'Ministry of Education — Directorate of Curriculum Development', 'moe.gov.zm/curriculum/physics', 'Official curriculum framework for Physics from the Ministry of Education.', 'approved'),
(NULL, NULL, 'curriculum', 'Zambian Chemistry Curriculum Framework', 'Ministry of Education — Directorate of Curriculum Development', 'moe.gov.zm/curriculum/chemistry', 'Official curriculum framework for Chemistry from the Ministry of Education.', 'approved'),
(NULL, NULL, 'textbook', 'Approved Mathematics Textbook Grade 8-9', 'Ministry of Education — Approved Publisher', 'moe.gov.zm/textbooks/maths-junior', 'Ministry-approved Mathematics textbook for junior secondary covering all syllabus topics.', 'approved'),
(NULL, NULL, 'textbook', 'Approved Mathematics Textbook Grade 10-12', 'Ministry of Education — Approved Publisher', 'moe.gov.zm/textbooks/maths-senior', 'Ministry-approved Mathematics textbook for senior secondary including ECZ exam preparation.', 'approved'),
(NULL, NULL, 'textbook', 'Approved Science Textbook Grade 8-9', 'Ministry of Education — Approved Publisher', 'moe.gov.zm/textbooks/science-junior', 'Ministry-approved Integrated Science textbook for junior secondary.', 'approved'),
(NULL, NULL, 'textbook', 'Approved Physics Textbook Grade 10-12', 'Ministry of Education — Approved Publisher', 'moe.gov.zm/textbooks/physics-senior', 'Ministry-approved Physics textbook for senior secondary.', 'approved'),
(NULL, NULL, 'textbook', 'Approved Chemistry Textbook Grade 10-12', 'Ministry of Education — Approved Publisher', 'moe.gov.zm/textbooks/chemistry-senior', 'Ministry-approved Chemistry textbook for senior secondary.', 'approved'),
(NULL, NULL, 'supplementary', 'OpenAI Knowledge Augmentation', 'OpenAI', 'openai.com', 'Supplementary information retrieved via OpenAI when curriculum materials do not fully cover a topic. Used as secondary source only.', 'approved')
ON CONFLICT DO NOTHING;

-- ============================================================
-- REBUILD SEARCH INDEX
-- ============================================================
SELECT rebuild_search_index();
