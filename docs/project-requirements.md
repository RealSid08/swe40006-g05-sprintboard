# G05 project requirements and source record

Recorded 20 October 2026 from the SWE40006 Canvas site.

## Official sources

- Project description: https://swinburne.instructure.com/courses/77400/pages/project-description
- Presentation assignment: https://swinburne.instructure.com/courses/77400/assignments/796911
- Marked brief: https://swinburne.instructure.com/courses/77400/assignments/796902/submissions/402715
- Local revised brief: `../../project-brief/output/Sem2_ProjectBrief_G05_Revised.docx`

## Sequential assessment levels

1. Four distinct environments: code repository server, CI/build server, isolated test/staging server, public production server.
2. Production instrumentation and visualisation: CPU, RAM, disk I/O, network, HTTP latency and service health.
3. A working application, with unit, integration and acceptance suites executed on the Test Server before production, and live application, database and operational verification.
4. Automatic source-triggered builds, tests, retained artifacts and production deployment, with a visible source change traced to the running release.

Capture screenshots and raw logs for every subtask, including failed attempts. The brief describes plans; it is not implementation evidence.

## Presentation

Due 22 October 2026 at 16:30. Four to eight slides on the official Swinburne template, a 15-minute talk plus 5 minutes of questions, including a two-minute recorded pipeline demonstration requested by the tutor.

File names: `Sem2_Presentation_G05.pptx` for the deck and `Project_Presentation_Contribution_document_G05.pdf` for the contribution form. Each member records their own contribution and signs the form personally.

## Tutor feedback on the brief

Grade 6.75/10. Scores: writing 1.5/2; background and application 1/2; goals 1/2; tool selection 2/2; metrics 0.75/1; scope and deliverables 0.5/1.

- In-text citations are missing.
- Explain the pipeline definition broadly, and place stack details in the tool selection and technical rationale.
- Target application details are inadequate.
- Goals and objectives need careful definition.
- List relevant success metrics explicitly instead of indicators.
- Project deliverables are missing.

## How the implementation evidence responds

Describe actual user journeys and permission boundaries. Keep a concrete deliverable inventory, explicit numerical targets, observed measurements with sample counts, and source references beside claims. Distinguish planned, locally verified and AWS-verified outcomes. Never invent deployment frequency, peer reviews, contributions, signatures or cloud results.

## AWS boundary

Only the AWS Academy Learner Lab account `877560905830` is used, in `us-east-1`. The earlier Task 4 deployment `swe40006-task4-board` was removed from that account, and the Academy management resources were preserved. Other local AWS profiles are outside this project.
