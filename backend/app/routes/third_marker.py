from typing import Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.lib.database import get_database
from app.lib.security import require_role
from app.models import (
    AssessmentOut,
    ModerationCaseOut,
    ThirdMarkerDecisionRequest,
    ThirdMarkerDashboardStats,
    SampleItemOut,
)
from app.queries.assessments import (
    get_assessment_by_id,
    get_third_marker_queue,
    get_sample_items,
    get_moderation_case_by_assessment,
    make_third_marker_decision,
    get_third_marker_dashboard_stats,
    log_audit_event,
)

router = APIRouter(prefix="/third-marker", tags=["Third Marker"])


@router.get("/queue", response_model=list[AssessmentOut])
async def get_escalated_assessments(
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get all escalated assessments for third marker review."""
    assessments = await get_third_marker_queue(db)
    return assessments


@router.get("/dashboard", response_model=ThirdMarkerDashboardStats)
async def get_dashboard_stats(
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get third marker dashboard statistics."""
    stats = await get_third_marker_dashboard_stats(db)
    return stats


@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
async def get_third_marker_assessment(
    assessment_id: str,
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get assessment details for third marker review."""
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
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
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
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
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
async def submit_third_marker_decision(
    assessment_id: str,
    data: ThirdMarkerDecisionRequest,
    current_user: dict[str, Any] = Depends(require_role("third_marker")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Submit third marker final decision for an escalated assessment."""
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

    if moderation_case["status"] != "ESCALATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment is not escalated",
        )

    result = await make_third_marker_decision(
        db,
        moderation_case_id=moderation_case["id"],
        decision=data.decision,
        comment=data.comment,
        third_marker_id=current_user["id"],
    )

    await log_audit_event(
        db,
        actor_id=current_user["id"],
        actor_name=current_user["full_name"] or current_user["username"],
        actor_role=current_user["role"],
        action=f"Third marker decision: {data.decision}",
        assessment_id=assessment_uuid,
    )

    return {"message": "Third marker decision recorded", "case": result}
