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

    result = await upload_marks(
        db,
        assessment_id=assessment_id,
        marks=[m.model_dump() for m in data.marks],
        uploaded_by=current_user["id"],
    )

    if result["processed"] > 0:
        await db.execute(
            """
            UPDATE assessments SET status = 'MARKS_UPLOADED', updated_at = NOW()
            WHERE id = $1
            """,
            assessment_id,
        )

        await log_audit_event(
            db,
            actor_id=current_user["id"],
            actor_name=current_user["full_name"] or current_user["username"],
            actor_role=current_user["role"],
            action=f"Uploaded marks ({result['processed']} records)",
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

    if assessment["status"] != "SAMPLE_GENERATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment must have a generated sample before submission",
        )

    await submit_for_moderation(
        db,
        assessment_id=assessment_id,
        comment=data.comment,
        submitted_by=current_user["id"],
    )

    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action="Submitted for moderation",
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
