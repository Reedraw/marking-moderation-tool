from typing import Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.lib.database import get_database
from app.lib.security import require_role
from app.models import (
    AssessmentOut,
    ModerationCaseOut,
    ModerationDecisionRequest,
    ModerationFormOut,
    ModerationFormSubmit,
    ModeratorDashboardStats,
    SampleItemOut,
)
from app.queries.assessments import (
    get_assessment_by_id,
    get_moderator_queue,
    get_sample_items,
    get_moderation_case_by_assessment,
    make_moderation_decision,
    get_moderator_dashboard_stats,
    log_audit_event,
    save_moderation_form_response,
    get_latest_moderation_form_response,
)

router = APIRouter(prefix="/moderator", tags=["Moderator"])


@router.get("/queue", response_model=list[AssessmentOut])
async def get_moderation_queue(
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get all assessments in moderation queue."""
    assessments = await get_moderator_queue(db)
    return assessments


@router.get("/dashboard", response_model=ModeratorDashboardStats)
async def get_dashboard_stats(
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get moderator dashboard statistics."""
    stats = await get_moderator_dashboard_stats(db)
    return stats


@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
async def get_moderation_assessment(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get assessment details for moderation review."""
    from uuid import UUID

    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    assessment = await get_assessment_by_id(db, assessment_uuid)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    return assessment


@router.get("/assessments/{assessment_id}/sample", response_model=list[SampleItemOut])
async def get_assessment_sample(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get sample items for an assessment."""
    from uuid import UUID

    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    sample_items = await get_sample_items(db, assessment_uuid)
    return sample_items


@router.get("/assessments/{assessment_id}/moderation-case", response_model=ModerationCaseOut)
async def get_moderation_case(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get moderation case details for an assessment."""
    from uuid import UUID

    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    moderation_case = await get_moderation_case_by_assessment(db, assessment_uuid)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderation case not found",
        )

    return moderation_case


@router.post("/assessments/{assessment_id}/decision")
async def submit_moderation_decision(
    assessment_id: str,
    data: ModerationDecisionRequest,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit moderation decision for an assessment."""
    from uuid import UUID

    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    moderation_case = await get_moderation_case_by_assessment(db, assessment_uuid)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderation case not found",
        )

    if moderation_case["status"] not in ("IN_MODERATION", "SUBMITTED_FOR_MODERATION"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment is not in a state that allows moderation decisions",
        )

    result = await make_moderation_decision(
        db,
        moderation_case_id=moderation_case["id"],
        decision=data.decision,
        comment=data.comment,
        moderator_id=current_user["id"],
    )

    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=f"Moderation decision: {data.decision}",
        assessment_id=assessment_uuid,
    )

    return {"message": "Moderation decision recorded", "case": result}


@router.post("/assessments/{assessment_id}/form", response_model=ModerationFormOut)
async def submit_moderation_form(
    assessment_id: str,
    data: ModerationFormSubmit,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit moderation form response for an assessment.
    
    The form captures the 6 key questions from academic regulations:
    1. Was there a marking rubric?
    2. Were marking criteria consistently applied?
    3. Was the full range of marks used?
    4. Were marks awarded fairly?
    5. Were feedback comments appropriate?
    6. Are all marks in sample appropriate?
    """
    from uuid import UUID

    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    assessment = await get_assessment_by_id(db, assessment_uuid)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    if assessment["status"] not in ("IN_MODERATION", "SUBMITTED_FOR_MODERATION"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment is not in a state that allows moderation form submission",
        )

    # Save the form responses
    result = await save_moderation_form_response(
        db,
        assessment_id=assessment_uuid,
        moderator_id=current_user["id"],
        form_data=data.form_responses,
    )

    # Get the moderation case to make the decision
    moderation_case = await get_moderation_case_by_assessment(db, assessment_uuid)
    if not moderation_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderation case not found",
        )

    # Make the moderation decision
    await make_moderation_decision(
        db,
        moderation_case_id=moderation_case["id"],
        decision=data.decision,
        comment=data.summary_comment,
        moderator_id=current_user["id"],
    )

    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=f"Submitted moderation form with decision: {data.decision}",
        assessment_id=assessment_uuid,
    )

    return result


@router.get("/assessments/{assessment_id}/form", response_model=ModerationFormOut | None)
async def get_moderation_form(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("moderator")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get the latest moderation form response for an assessment."""
    from uuid import UUID

    try:
        assessment_uuid = UUID(assessment_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assessment ID",
        )

    form_response = await get_latest_moderation_form_response(db, assessment_uuid)
    return form_response
