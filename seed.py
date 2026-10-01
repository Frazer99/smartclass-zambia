"""Seeds demo data: subjects, Form-level subject offerings, an admin + demo
student account, sample syllabus-derived topics, sample approved material
(so the RAG-grounded AI teacher has something real to draw on), and a sample
past paper with question-level breakdown -- enough to demo the full
Lesson + Past Paper flows end to end without waiting on real content uploads.

Run with:  python seed.py
"""
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Material,
    PastPaper,
    PastPaperQuestion,
    Subject,
    SubjectFormOffering,
    Topic,
    User,
)

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# --- Users -----------------------------------------------------------------
if not db.query(User).filter(User.email == "admin@smartclass.zm").first():
    db.add(
        User(
            full_name="ZedCode Admin",
            email="admin@smartclass.zm",
            phone="+260970000000",
            password_hash=hash_password("password123"),
            role="admin",
        )
    )

if not db.query(User).filter(User.email == "student@smartclass.zm").first():
    db.add(
        User(
            full_name="Demo Student",
            email="student@smartclass.zm",
            phone="+260971111111",
            password_hash=hash_password("password123"),
            role="student",
            form_level=4,
        )
    )
db.commit()

# --- Subjects & Form offerings ----------------------------------------------
# Form 2: Mathematics + Science. Form 3-6: Mathematics + Physics + Chemistry.
subject_names = ["Mathematics", "Physics", "Chemistry", "Science"]
subjects = {}
for name in subject_names:
    subj = db.query(Subject).filter(Subject.name == name).first()
    if not subj:
        subj = Subject(name=name, description=f"{name} aligned to the ECZ syllabus.")
        db.add(subj)
        db.commit()
        db.refresh(subj)
    subjects[name] = subj

offerings = [
    ("Mathematics", 2), ("Mathematics", 3), ("Mathematics", 4), ("Mathematics", 5), ("Mathematics", 6),
    ("Science", 2),
    ("Physics", 3), ("Physics", 4), ("Physics", 5), ("Physics", 6),
    ("Chemistry", 3), ("Chemistry", 4), ("Chemistry", 5), ("Chemistry", 6),
]
for subj_name, form in offerings:
    exists = (
        db.query(SubjectFormOffering)
        .filter(SubjectFormOffering.subject_id == subjects[subj_name].id, SubjectFormOffering.form_level == form)
        .first()
    )
    if not exists:
        db.add(SubjectFormOffering(subject_id=subjects[subj_name].id, form_level=form))
db.commit()

# --- Sample topics (as if auto-extracted from an uploaded Form 4 Mathematics syllabus) ---
math4_topics = [
    ("Algebraic Fractions", "Simplifying and manipulating algebraic fractions using factorisation."),
    ("Linear Equations", "Solving linear equations in one and two unknowns, including simultaneous equations."),
    ("Quadratic Equations", "Solving quadratic equations by factorisation, completing the square, and the quadratic formula."),
    ("Geometry - Circle Theorems", "Angle properties of circles: angles at the centre, cyclic quadrilaterals, tangents."),
    ("Trigonometry", "Sine, cosine and tangent ratios; solving right-angled and non-right-angled triangles."),
]
existing_titles = {
    t.title for t in db.query(Topic).filter(Topic.subject_id == subjects["Mathematics"].id, Topic.form_level == 4)
}
for i, (title, desc) in enumerate(math4_topics):
    if title not in existing_titles:
        db.add(Topic(subject_id=subjects["Mathematics"].id, form_level=4, title=title, description=desc, order_index=i))
db.commit()

linear_eq_topic = (
    db.query(Topic)
    .filter(Topic.subject_id == subjects["Mathematics"].id, Topic.form_level == 4, Topic.title == "Linear Equations")
    .first()
)

# --- Sample approved material (a "pamphlet") feeding the RAG knowledge base ---
if not db.query(Material).filter(Material.title == "Form 4 Mathematics Pamphlet - Linear Equations").first():
    db.add(
        Material(
            subject_id=subjects["Mathematics"].id,
            form_level=4,
            topic_id=linear_eq_topic.id if linear_eq_topic else None,
            title="Form 4 Mathematics Pamphlet - Linear Equations",
            material_type="pamphlet",
            filename="linear_equations_pamphlet.txt",
            storage_path="seed://linear_equations_pamphlet",
            extracted_text=(
                "A linear equation is an equation in which the highest power of the unknown is one. "
                "To solve a linear equation, collect like terms on each side, then isolate the unknown by "
                "performing the same operation on both sides of the equation. "
                "For example, to solve 2x + 5 = 15, first subtract 5 from both sides to get 2x = 10, "
                "then divide both sides by 2 to get x = 5. "
                "We subtract 5 from both sides because an equation stays balanced only if you do the same "
                "thing to both sides -- this isolates the term containing x. "
                "Simultaneous linear equations in two unknowns can be solved by substitution or elimination: "
                "in elimination, add or subtract the equations to remove one unknown, then solve for the other "
                "and substitute back. Always check your answer by substituting it back into the original equation."
            ),
        )
    )
db.commit()

# --- Sample past paper with question-level breakdown -----------------------
paper = db.query(PastPaper).filter(PastPaper.title == "ECZ Mathematics Form 4 Specimen Paper 1").first()
if not paper:
    paper = PastPaper(
        subject_id=subjects["Mathematics"].id,
        form_level=4,
        year=2025,
        term="Specimen",
        title="ECZ Mathematics Form 4 Specimen Paper 1",
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    questions = [
        (
            "1",
            "Solve the equation 2x + 5 = 15.",
            2,
            "Subtract 5 from both sides to get 2x = 10. Divide both sides by 2 to get x = 5. Check: 2(5)+5=15, correct.",
        ),
        (
            "2",
            "Solve the simultaneous equations: x + y = 10 and x - y = 4.",
            4,
            "Add the two equations to eliminate y: 2x = 14, so x = 7. Substitute x = 7 into x + y = 10 to get y = 3. "
            "Check both original equations: 7+3=10 and 7-3=4, both correct.",
        ),
        (
            "3",
            "Factorise and solve: x^2 - 5x + 6 = 0.",
            3,
            "Find two numbers that multiply to 6 and add to -5: -2 and -3. So x^2 - 5x + 6 = (x-2)(x-3) = 0. "
            "Therefore x = 2 or x = 3.",
        ),
    ]
    for num, text, marks, guide in questions:
        db.add(
            PastPaperQuestion(
                past_paper_id=paper.id,
                question_number=num,
                question_text=text,
                marks=marks,
                topic_id=linear_eq_topic.id if linear_eq_topic and num != "3" else None,
                answer_guide=guide,
            )
        )
    db.commit()

db.close()
print("Seed complete.")
print("Admin login:   admin@smartclass.zm / password123")
print("Student login: student@smartclass.zm / password123")
