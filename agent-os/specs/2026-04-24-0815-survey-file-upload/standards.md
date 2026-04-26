# Standards for Survey File Upload

No formal `agent-os/standards/` files exist in this project. The following conventions were observed and followed:

1. **Backend patterns**
   - Static survey field definitions in `backend/app/data/survey_field_defs.py`
   - FastAPI routers with `APIRouter`

2. **Frontend patterns**
   - React + TypeScript with Tailwind CSS
   - shadcn/ui components
   - Survey field definitions in `frontend/src/data/surveyFields.ts` must exactly match `backend/app/data/survey_field_defs.py`
   - `SurveyModal` uses a `Map<string, AnswerValue>` for answers and iterates on submit
   - `QuestionInput` switches on `def.inputType` to render the appropriate control
