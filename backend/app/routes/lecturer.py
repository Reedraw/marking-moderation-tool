from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.lib.database import get_database
from app.lib.security import require_role
from app.models import (
    AssessmentOut,
    AssessmentCreate,
    MarksUploadRequest,
    MarksUploadResponse,
    SampleGenerateRequest,
    SampleGenerateResponse,
    ModerationSubmitRequest,
    LecturerDashboardStats,
    SampleItemOut,
    PreModerationChecklistSubmit,
    PreModerationChecklistOut,
    ModuleLeaderResponseSubmit,
    ModuleLeaderResponseOut,
)
from app.queries.assessments import (
    create_assessment,
    get_assessment_by_id,
    get_lecturer_assessments,
    upload_marks,
    generate_sample,
    submit_for_moderation,
    get_sample_items,
    get_lecturer_dashboard_stats,
    log_audit_event,
    create_module_run,
    get_or_create_module,
    save_pre_moderation_checklist,
    get_pre_moderation_checklist,
    save_module_leader_response,
    get_module_leader_response_by_assessment,
    get_moderation_case_by_assessment,
)

router = APIRouter(prefix="/lecturer", tags=["Lecturer"])


@router.get("/assessments", response_model=list[AssessmentOut])
async def get_my_assessments(
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get all assessments created by the current lecturer."""
    assessments = await get_lecturer_assessments(db, lecturer_id=current_user["id"])
    return assessments


@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
async def get_assessment(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get details of a specific assessment."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )
    return assessment


@router.post("/assessments", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED)
async def create_new_assessment(
    data: AssessmentCreate,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Create a new assessment."""
    try:
        module = await get_or_create_module(
            db,
            code=data.module_code,
            title=data.module_name,
            credits=data.credit_size,
            created_by=current_user["id"],
        )

        module_run = await create_module_run(
            db,
            module_id=module["id"],
            academic_year=data.cohort,
            created_by=current_user["id"],
        )

        assessment = await create_assessment(
            db,
            module_code=data.module_code,
            module_name=data.module_name,
            title=data.title,
            cohort=data.cohort,
            due_date=data.due_date,
            weighting=data.weighting,
            module_run_id=module_run["id"],
            credit_size=data.credit_size,
            created_by=current_user["id"],
        )

        await log_audit_event(
            db,
            actor_id=current_user["id"],
            actor_name=current_user["full_name"] or current_user["username"],
            actor_role=current_user["role"],
            action="Created assessment",
            assessment_id=assessment["id"],
        )

        return assessment
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create assessment: {str(e)}",
        )


@router.post("/assessments/{assessment_id}/marks/upload", response_model=MarksUploadResponse)
async def upload_assessment_marks(
    assessment_id: UUID,
    data: MarksUploadRequest,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Upload marks for an assessment (CSV parsing should be done on frontend)."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this assessment",
        )

    # Determine if this is a revision (when status = CHANGES_REQUESTED)
    is_revision = assessment["status"] == "CHANGES_REQUESTED"
    
    result = await upload_marks(
        db,
        assessment_id=assessment_id,
        marks=[m.model_dump() for m in data.marks],
        uploaded_by=current_user["id"],
        is_revision=is_revision,
    )

    if result["processed"] > 0:
        # If it was a revision, keep status as CHANGES_REQUESTED
        # Otherwise set to MARKS_UPLOADED
        if not is_revision:
            await db.execute(
                """
                UPDATE assessments SET status = 'MARKS_UPLOADED', updated_at = NOW()
                WHERE id = $1
                """,
                assessment_id,
            )

        action_text = f"Revised marks ({result['processed']} records)" if is_revision else f"Uploaded marks ({result['processed']} records)"
        if is_revision and result.get("revisions_tracked", 0) > 0:
            action_text += f" - {result['revisions_tracked']} changed"
            
        await log_audit_event(
            db,
            actor_id=current_user["id"],
            actor_name=current_user["full_name"] or current_user["username"],
            actor_role=current_user["role"],
            action=action_text,
            assessment_id=assessment_id,
        )

    return result


@router.post("/assessments/{assessment_id}/generate-sample", response_model=SampleGenerateResponse)
async def generate_moderation_sample(
    assessment_id: UUID,
    data: SampleGenerateRequest,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Generate moderation sample based on the specified method."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this assessment",
        )

    result = await generate_sample(
        db,
        assessment_id=assessment_id,
        method=data.method,
        percent=data.percent,
        generated_by=current_user["id"],
    )

    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=f"Generated moderation sample ({data.method}, {data.percent}%)",
        assessment_id=assessment_id,
    )

    return result


@router.post("/assessments/{assessment_id}/submit-for-moderation")
async def submit_assessment_for_moderation(
    assessment_id: UUID,
    data: ModerationSubmitRequest,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit assessment for moderation."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this assessment",
        )

    if assessment["status"] not in ("SAMPLE_GENERATED", "CHANGES_REQUESTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment must have a generated sample before submission",
        )

    # Determine if this is a resubmission after changes
    is_resubmission = assessment["status"] == "CHANGES_REQUESTED"

    await submit_for_moderation(
        db,
        assessment_id=assessment_id,
        comment=data.comment,
        submitted_by=current_user["id"],
    )

    action_text = "Resubmitted for moderation after revisions" if is_resubmission else "Submitted for moderation"
    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=action_text,
        assessment_id=assessment_id,
    )

    return {"message": "Assessment submitted for moderation"}


@router.get("/assessments/{assessment_id}/sample", response_model=list[SampleItemOut])
async def get_assessment_sample(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the sample items for an assessment."""
    sample_items = await get_sample_items(db, assessment_id)
    return sample_items


@router.get("/dashboard", response_model=LecturerDashboardStats)
async def get_dashboard_stats(
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get lecturer dashboard statistics."""
    stats = await get_lecturer_dashboard_stats(db, lecturer_id=current_user["id"])
    return stats


# ===============================
# Pre-Moderation Checklist Routes
# ===============================

@router.post("/assessments/{assessment_id}/checklist", response_model=PreModerationChecklistOut)
async def submit_pre_moderation_checklist(
    assessment_id: UUID,
    data: PreModerationChecklistSubmit,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit the pre-moderation checklist before submitting for moderation."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this assessment's checklist",
        )

    checklist = await save_pre_moderation_checklist(
        db,
        assessment_id=assessment_id,
        user_id=current_user["id"],
        marking_in_accordance=data.marking_in_accordance,
        late_work_policy_adhered=data.late_work_policy_adhered,
        plagiarism_policy_adhered=data.plagiarism_policy_adhered,
        marks_available_with_percentages=data.marks_available_with_percentages,
        totalling_checked=data.totalling_checked,
        consistency_comments=data.consistency_comments,
    )

    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action="Submitted pre-moderation checklist",
        assessment_id=assessment_id,
    )

    return checklist


@router.get("/assessments/{assessment_id}/checklist", response_model=PreModerationChecklistOut)
async def get_assessment_checklist(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the pre-moderation checklist for an assessment."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this assessment's checklist",
        )

    checklist = await get_pre_moderation_checklist(db, assessment_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    return checklist


# ===============================
# Module Leader Response Routes
# ===============================

@router.post("/assessments/{assessment_id}/response", response_model=ModuleLeaderResponseOut)
async def submit_module_leader_response(
    assessment_id: UUID,
    data: ModuleLeaderResponseSubmit,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit the module leader response after receiving moderator feedback."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to respond to this assessment's moderation",
        )

    # Get the moderation case
    moderation_case = await get_moderation_case_by_assessment(db, assessment_id)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No moderation case found for this assessment",
        )

    response = await save_module_leader_response(
        db,
        moderation_case_id=moderation_case["id"],
        user_id=current_user["id"],
        moderator_comments_considered=data.moderator_comments_considered,
        response_to_issues=data.response_to_issues,
        outliers_explanation=data.outliers_explanation,
        needs_third_marker=data.needs_third_marker,
    )

    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action="Submitted module leader response",
        assessment_id=assessment_id,
    )

    # If third marker is needed, escalate the assessment
    if data.needs_third_marker:
        await db.execute(
            """
            UPDATE moderation_cases
            SET status = 'ESCALATED', escalated_at = NOW()
            WHERE id = $1
            """,
            moderation_case["id"],
        )
        await db.execute(
            """
            UPDATE assessments
            SET status = 'ESCALATED'
            WHERE id = $1
            """,
            assessment_id,
        )
        await log_audit_event(
            db,
            actor_id=current_user["id"],
            actor_name=current_user["full_name"] or current_user["username"],
            actor_role=current_user["role"],
            action="Escalated to third marker",
            assessment_id=assessment_id,
        )

    return response

@router.get("/assessments/{assessment_id}/moderation-case")
async def get_my_moderation_case(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get moderation case for lecturer's own assessment."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this moderation case",
        )

    moderation_case = await get_moderation_case_by_assessment(db, assessment_id)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No moderation case found for this assessment",
        )

    return moderation_case

@router.get("/assessments/{assessment_id}/response", response_model=ModuleLeaderResponseOut)
async def get_assessment_response(
    assessment_id: UUID,
    current_user: dict[str, Any] = Depends(require_role("lecturer")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the module leader response for an assessment."""
    assessment = await get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment["created_by"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this assessment's response",
        )

    response = await get_module_leader_response_by_assessment(db, assessment_id)
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")

    return response
