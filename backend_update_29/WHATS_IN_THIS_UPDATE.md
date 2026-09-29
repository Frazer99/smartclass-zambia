# README update only — documented risk, no code change

You declined the fix (pupil-approval before a parent link is finalized,
instead of automatic email matching), and that's a legitimate call to
make. This update is just making sure that decision is visible to
anyone who reviews this project later — including whoever eventually
does the legal review referenced in the Privacy Policy draft's Section
5 — rather than the tradeoff quietly disappearing.

## Modified file (1)
README.md — added a paragraph directly under the "Parent accounts"
description in the "Parent & Teacher Accounts" section, explaining:
  - The linking mechanism matches purely by email address
  - Whether email confirmation is enforced anywhere in this project
    was never verified
  - Without it, a pupil could enter any email as their parent/guardian
    email, and an automatic link would fire with no confirmation step
  - This was flagged, a safer alternative (pupil-approved pending
    links) was proposed, and keeping the simpler automatic behavior
    was a deliberate choice, not an oversight
  - This connects directly to the Data Protection Act Section 17
    consent question already flagged in the Privacy Policy draft, and
    should be revisited alongside that legal review

## After copying this in
Nothing to deploy — documentation only.
