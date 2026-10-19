# G05 project requirements and source record

Observed 20 October 2026 in the authenticated Chrome Canvas session.

## Official sources

- Project description: https://swinburne.instructure.com/courses/77400/pages/project-description
- Presentation: https://swinburne.instructure.com/courses/77400/assignments/796911
- Marked brief: https://swinburne.instructure.com/courses/77400/assignments/796902/submissions/402715
- Local revised brief: ../../project-brief/output/Sem2_ProjectBrief_G05_Revised.docx

## Sequential assessment levels

1. Four distinct environments: code repository server, CI/build server, isolated test/staging server, public production server.
2. Production instrumentation and visualization: CPU, RAM, disk I/O, network, HTTP latency and service health.
3. Working application, unit/integration/acceptance suites executed on the Test Server before production; live application, database and operational verification.
4. Automatic source-triggered builds, tests, retained artifacts and production deployment; visible source change traced to the running release.

Capture screenshots and raw logs for every subtask, including failed attempts. The brief describes plans; these are not implementation evidence.

## Presentation

Due 22 October 2026 at 16:30 (Canvas display). Four to eight slides, official Swinburne template, 15 minutes plus five minutes Q&A. User additionally reports tutor requires a two-minute recorded pipeline demonstration.

Deck filename: Sem2_Presentation_G05.pptx. Contribution filename: Project_Presentation_Contribution_document_G05.pdf. Team members must complete truthful contributions and personally sign; signatures must not be generated or copied from previous documents.

The live assignment contains an academic-integrity provision absent from the user's pasted extract: generative AI tools are prohibited for drafting or structuring report and presentation deliverables. Any agent-produced deck/content must be identified as AI-generated and must not be represented as meeting that originality condition. Technical implementation and factual evidence are maintained separately.

## Tutor feedback

Grade: 6.75/10. Scores: writing 1.5/2; background/application 1/2; goals 1/2; tool selection 2/2; metrics 0.75/1; scope/deliverables 0.5/1.

- In-text citations are missing.
- Explain pipeline definition broadly, and place stack details in the tool selection and technical rationale.
- Target application details are inadequate.
- Goals and objectives need careful definition.
- List relevant success metrics explicitly instead of indicators.
- Project deliverables are missing.

## Required corrections in implementation evidence

Describe actual user journeys and permission boundaries. Maintain a concrete deliverable inventory, explicit numerical targets, observed measurements with sample counts, and source references beside claims. Distinguish planned, locally verified and AWS-verified outcomes. Never invent deployment frequency, peer reviews, contributions, signatures or cloud results.

## AWS boundary

Only the AWS Academy Learner Lab account is authorized for old-workload teardown and project deployment. Local default CLI has no credentials; configured besmak/business profiles are expired and are outside this task. Prior task4 notes identify a Learner Lab deployment named swe40006-task4-board in us-east-1 using LabRole, but its current account and state still require live verification.
