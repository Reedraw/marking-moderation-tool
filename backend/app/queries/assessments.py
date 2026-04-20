from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

import asyncpg


async def log_audit_event(
    db: asyncpg.Pool,
    *,
    actor_id: UUID,
    actor_name: str,
    actor_role: str,
    action: str,
    assessment_id: Optional[UUID] = None,
) -> dict[str, Any]:
    row = await db.fetchrow(
        """
        INSERT INTO audit_log (actor_id, actor_name, actor_role, action, assessment_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, timestamp, actor_id, actor_name, actor_role, action, assessment_id
        """,
        actor_id,
        actor_name,
        actor_role,
        action,
        assessment_id,
    )
    return dict(row)


async def create_assessment(
    db: asyncpg.Pool,
    *,
    module_code: str,
    module_name: str,
    title: str,
    cohort: str,
    due_date: str,
    weighting: int,
    module_run_id: UUID,
    credit_size: int,
    created_by: UUID,
) -> dict[str, Any]:
    from datetime import date
    # Convert due_date string to date object if it's a string
    if isinstance(due_date, str):
        due_date_obj = date.fromisoformat(due_date)
    else:
        due_date_obj = due_date
        
    row = await db.fetchrow(
        """
        INSERT INTO assessments (
            module_code, module_name, title, cohort, due_date, weighting,
            module_run_id, credit_size, created_by, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT')
        RETURNING id, module_code, module_name, title, cohort, due_date, weighting,
                 module_run_id, credit_size, created_by, status, created_at, updated_at
        """,
        module_code,
        module_name,
        title,
        cohort,
        due_date_obj,
        weighting,
        module_run_id,
        credit_size,
        created_by,
    )
    return dict(row)


async def get_assessment_by_id(db: asyncpg.Pool, assessment_id: UUID) -> Optional[dict[str, Any]]:
    row = await db.fetchrow(
        """
        SELECT a.id, a.module_code, a.module_name, a.title, a.cohort,
               a.due_date, a.weighting, a.module_run_id, a.credit_size,
               a.created_by, a.status, a.created_at, a.updated_at,
               COALESCE(COUNT(DISTINCT m.id), 0) as marks_uploaded_count,
               s.size as sample_size,
               s.method as sample_method
        FROM assessments a
        LEFT JOIN marks m ON a.id = m.assessment_id
        LEFT JOIN sample_sets s ON a.id = s.assessment_id
        WHERE a.id = $1
        GROUP BY a.id, s.size, s.method
        """,
        assessment_id,
    )
    return dict(row) if row else None


async def get_lecturer_assessments(db: asyncpg.Pool, lecturer_id: UUID) -> list[dict[str, Any]]:
    rows = await db.fetch(
        """
        SELECT a.id, a.module_code, a.module_name, a.title, a.cohort,
               a.due_date, a.weighting, a.status, a.created_by, a.created_at, a.updated_at,
               COALESCE(COUNT(DISTINCT m.id), 0) as marks_uploaded_count,
               latest_sample.size as sample_size,
               latest_sample.method as sample_method,
               latest_sample.percent as sample_percent
        FROM assessments a
        LEFT JOIN marks m ON a.id = m.assessment_id
        LEFT JOIN LATERAL (
            SELECT size, method, percent
            FROM sample_sets
            WHERE assessment_id = a.id
            ORDER BY created_at DESC
            LIMIT 1
        ) latest_sample ON true
        WHERE a.created_by = $1
        GROUP BY a.id, latest_sample.size, latest_sample.method, latest_sample.percent
        ORDER BY a.created_at DESC
        """,
        lecturer_id,
    )
    return [dict(r) for r in rows]


async def get_moderator_queue(db: asyncpg.Pool) -> list[dict[str, Any]]:
    rows = await db.fetch(
        """
        SELECT a.id, a.module_code, a.module_name, a.title, a.cohort,
               a.due_date, a.weighting, a.status, a.created_by, a.created_at, a.updated_at,
               u.full_name as lecturer_name,
               COALESCE(COUNT(DISTINCT m.id), 0) as marks_uploaded_count,
               latest_sample.size as sample_size,
               latest_sample.method as sample_method,
               latest_sample.percent as sample_percent,
               mc.submitted_at
        FROM assessments a
        JOIN users u ON a.created_by = u.id
        LEFT JOIN marks m ON a.id = m.assessment_id
        LEFT JOIN LATERAL (
            SELECT size, method, percent
            FROM sample_sets
            WHERE assessment_id = a.id
            ORDER BY created_at DESC
            LIMIT 1
        ) latest_sample ON true
        LEFT JOIN moderation_cases mc ON a.id = mc.assessment_id
        WHERE a.status IN ('SUBMITTED_FOR_MODERATION', 'IN_MODERATION', 'ESCALATED')
        GROUP BY a.id, u.full_name, latest_sample.size, latest_sample.method, latest_sample.percent, mc.submitted_at
        ORDER BY mc.submitted_at DESC NULLS LAST, a.created_at DESC
        """,
    )
    return [dict(r) for r in rows]


async def get_third_marker_queue(db: asyncpg.Pool) -> list[dict[str, Any]]:
    rows = await db.fetch(
        """
        SELECT a.id, a.module_code, a.module_name, a.title, a.cohort,
               a.due_date, a.weighting, a.status, a.created_by, a.created_at, a.updated_at,
               u1.full_name as lecturer_name,
               u2.full_name as moderator_name,
               COALESCE(COUNT(DISTINCT m.id), 0) as marks_uploaded_count,
               latest_sample.size as sample_size,
               latest_sample.method as sample_method,
               latest_sample.percent as sample_percent,
               mc.escalated_at
        FROM assessments a
        JOIN moderation_cases mc ON a.id = mc.assessment_id
        JOIN users u1 ON a.created_by = u1.id
        LEFT JOIN users u2 ON mc.moderator_id = u2.id
        LEFT JOIN marks m ON a.id = m.assessment_id
        LEFT JOIN LATERAL (
            SELECT size, method, percent
            FROM sample_sets
            WHERE assessment_id = a.id
            ORDER BY created_at DESC
            LIMIT 1
        ) latest_sample ON true
        WHERE a.status = 'ESCALATED'
        GROUP BY a.id, u1.full_name, u2.full_name, latest_sample.size, latest_sample.method, latest_sample.percent, mc.escalated_at
        ORDER BY mc.escalated_at DESC
        """,
    )
    return [dict(r) for r in rows]


async def upload_marks(
    db: asyncpg.Pool,
    *,
    assessment_id: UUID,
    marks: list[dict[str, Any]],
    uploaded_by: UUID,
    is_revision: bool = False,
) -> dict[str, Any]:
    processed = 0
    errors = []
    revisions_tracked = 0

    for mark_data in marks:
        student_id = mark_data.get("student_id")
        mark = mark_data.get("mark")
        marker_id = mark_data.get("marker_id")
        revision_reason = mark_data.get("revision_reason") if is_revision else None

        if not student_id or mark is None:
            errors.append(f"Missing student_id or mark for record")
            continue

        if not (0 <= mark <= 100):
            errors.append(f"Mark out of range for {student_id}")
            continue

        try:
            # If this is a revision, get the old mark first
            old_mark = None
            mark_id = None
            if is_revision:
                existing_mark = await db.fetchrow(
                    "SELECT id, mark FROM marks WHERE assessment_id = $1 AND student_id = $2",
                    assessment_id,
                    student_id,
                )
                if existing_mark:
                    old_mark = existing_mark["mark"]
                    mark_id = existing_mark["id"]

            # Insert or update the mark
            result = await db.fetchrow(
                """
                INSERT INTO marks (assessment_id, student_id, mark, marker_id, uploaded_by, is_revised, revision_reason)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (assessment_id, student_id) 
                DO UPDATE SET mark = $3, marker_id = $4, uploaded_by = $5, 
                              is_revised = $6, revision_reason = $7, updated_at = NOW()
                RETURNING id
                """,
                assessment_id,
                student_id,
                mark,
                marker_id,
                uploaded_by,
                is_revision,
                revision_reason,
            )
            
            # Track revision history if this was a revision and mark changed
            if is_revision and old_mark is not None and old_mark != mark:
                await db.execute(
                    """
                    INSERT INTO marks_revision_history 
                    (mark_id, assessment_id, student_id, original_mark, revised_mark, revision_reason, revised_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    mark_id or result["id"],
                    assessment_id,
                    student_id,
                    old_mark,
                    mark,
                    revision_reason,
                    uploaded_by,
                )
                revisions_tracked += 1
            
            processed += 1
        except Exception as e:
            errors.append(f"Error processing {student_id}: {str(e)}")

    result_data = {"processed": processed, "skipped": len(marks) - processed, "errors": errors}
    if is_revision:
        result_data["revisions_tracked"] = revisions_tracked
    
    return result_data


def calculate_required_sample_size(cohort_size: int) -> int:
    """
    Calculate minimum sample size based on academic regulations (Section 12.18).
    
    - < 100 students: 20% or 10 students' assessments (whichever is greater)
    - 100 – 300 students: 15%
    - > 300 students: 10%
    """
    if cohort_size < 100:
        return max(int(cohort_size * 0.20), min(10, cohort_size))
    elif cohort_size <= 300:
        return int(cohort_size * 0.15)
    else:
        return int(cohort_size * 0.10)


async def generate_sample(
    db: asyncpg.Pool,
    *,
    assessment_id: UUID,
    method: str,
    percent: float,
    generated_by: UUID,
) -> dict[str, Any]:
    """
    Generate moderation sample according to academic regulations (Section 12.19-12.20).
    
    Sample must include:
    - Representative coverage of all markers
    - Full range of marks achieved by cohort
    - ALL assessments within two marks below pass mark (38-39%)
    - Highest and lowest marks
    - Boundary cases: 38-42%, 58-62%, 68-72%
    """
    import random
    
    marks = await db.fetch(
        """
        SELECT id, student_id, mark, marker_id
        FROM marks
        WHERE assessment_id = $1
        ORDER BY mark DESC
        """,
        assessment_id,
    )

    if not marks:
        return {"sample_size": 0, "method": method, "percent": percent, "sample_items": []}

    total_marks = len(marks)
    
    # Calculate minimum required sample size per regulations
    regulation_min_size = calculate_required_sample_size(total_marks)
    user_requested_size = max(int(total_marks * (percent / 100)), 1)
    required_size = max(regulation_min_size, user_requested_size)

    selected_indices = set()
    
    # MANDATORY: Include ALL marks within two below pass mark (38-39%) - Section 12.20
    within_two_below_pass = [idx for idx, m in enumerate(marks) if 38 <= m["mark"] < 40]
    selected_indices.update(within_two_below_pass)
    
    # MANDATORY: Include highest and lowest marks
    if total_marks > 0:
        selected_indices.add(0)  # Highest (already sorted DESC)
        selected_indices.add(total_marks - 1)  # Lowest
    
    # Include boundary cases (Section 12.19)
    # Pass/fail boundary: 38-42%
    pass_fail_boundary = [idx for idx, m in enumerate(marks) if 38 <= m["mark"] <= 42]
    selected_indices.update(pass_fail_boundary)
    
    # 2:2/2:1 boundary: 58-62%
    lower_boundary = [idx for idx, m in enumerate(marks) if 58 <= m["mark"] <= 62]
    selected_indices.update(lower_boundary)
    
    # 2:1/First boundary: 68-72%
    upper_boundary = [idx for idx, m in enumerate(marks) if 68 <= m["mark"] <= 72]
    selected_indices.update(upper_boundary)
    
    # Ensure representative coverage of all markers (Section 12.19)
    markers = {}
    for idx, m in enumerate(marks):
        marker = m["marker_id"] or "unknown"
        if marker not in markers:
            markers[marker] = []
        markers[marker].append(idx)
    
    # Include at least one from each marker
    for marker, indices in markers.items():
        if not any(i in selected_indices for i in indices):
            selected_indices.add(random.choice(indices))

    if method == "RANDOM":
        # Fill remaining with random selection
        remaining = required_size - len(selected_indices)
        if remaining > 0:
            available = [idx for idx in range(total_marks) if idx not in selected_indices]
            if available:
                selected_indices.update(random.sample(available, min(remaining, len(available))))

    elif method == "STRATIFIED":
        # Stratified sampling across mark bands
        bands = [(90, 100), (70, 89), (60, 69), (50, 59), (40, 49), (0, 39)]
        remaining = required_size - len(selected_indices)
        
        for low, high in bands:
            band_marks = [idx for idx, m in enumerate(marks) if low <= m["mark"] <= high and idx not in selected_indices]
            if band_marks and remaining > 0:
                band_size = max(1, remaining // len(bands))
                to_add = random.sample(band_marks, min(band_size, len(band_marks)))
                selected_indices.update(to_add)
                remaining -= len(to_add)

    else:  # RISK_BASED (default)
        # Focus on risk areas: fails, near-boundaries, and outliers
        fail_marks = [idx for idx, m in enumerate(marks) if m["mark"] < 40 and idx not in selected_indices]
        selected_indices.update(fail_marks[:5])  # Include up to 5 fails
        
        # High marks that might be outliers (90+)
        high_outliers = [idx for idx, m in enumerate(marks) if m["mark"] >= 90 and idx not in selected_indices]
        selected_indices.update(high_outliers[:3])
        
        # Fill remaining
        remaining = required_size - len(selected_indices)
        if remaining > 0:
            available = [idx for idx in range(total_marks) if idx not in selected_indices]
            if available:
                selected_indices.update(random.sample(available, min(remaining, len(available))))

    sample_marks = [marks[i] for i in selected_indices]

    async with db.acquire() as conn:
        sample_set = await conn.fetchrow(
            """
            INSERT INTO sample_sets (assessment_id, method, percent, size, cohort_size, generated_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, assessment_id, method, percent, size, cohort_size, generated_by, created_at
            """,
            assessment_id,
            method,
            percent,
            len(sample_marks),
            total_marks,
            generated_by,
        )

        sample_set_id = sample_set["id"]

        sample_items = []
        for mark_data in sample_marks:
            # Determine reason for inclusion
            mark_val = mark_data["mark"]
            reasons = []
            if 38 <= mark_val < 40:
                reasons.append("within_two_below_pass")
            if 38 <= mark_val <= 42:
                reasons.append("pass_fail_boundary")
            if 58 <= mark_val <= 62:
                reasons.append("2:2_2:1_boundary")
            if 68 <= mark_val <= 72:
                reasons.append("2:1_first_boundary")
            if mark_val >= 90:
                reasons.append("high_outlier")
            if mark_val < 40:
                reasons.append("fail")
            if not reasons:
                reasons.append("random_sample")
            
            item = await conn.fetchrow(
                """
                INSERT INTO sample_items (sample_set_id, mark_id, student_id, original_mark, marker_id, reason)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, sample_set_id, student_id, original_mark as mark, marker_id, reason
                """,
                sample_set_id,
                mark_data["id"],
                mark_data["student_id"],
                mark_data["mark"],
                mark_data["marker_id"],
                ", ".join(reasons),
            )
            sample_items.append(dict(item))

        await conn.execute(
            """
            UPDATE assessments SET status = 'SAMPLE_GENERATED', updated_at = NOW()
            WHERE id = $1
            """,
            assessment_id,
        )

    return {
        "sample_size": len(sample_marks),
        "method": method,
        "percent": percent,
        "regulation_min_size": regulation_min_size,
        "within_two_below_pass_count": len(within_two_below_pass),
        "sample_items": sample_items,
    }



async def submit_for_moderation(
    db: asyncpg.Pool,
    *,
    assessment_id: UUID,
    comment: Optional[str],
    submitted_by: UUID,
) -> dict[str, Any]:
    async with db.acquire() as conn:
        # Check if moderation case already exists (resubmission after changes)
        existing_case = await conn.fetchrow(
            "SELECT id FROM moderation_cases WHERE assessment_id = $1",
            assessment_id,
        )
        
        if existing_case:
            # Resubmission - update existing case
            moderation_case = await conn.fetchrow(
                """
                UPDATE moderation_cases 
                SET status = 'IN_MODERATION', 
                    lecturer_comment = COALESCE($2, lecturer_comment),
                    submitted_at = NOW(),
                    updated_at = NOW()
                WHERE assessment_id = $1
                RETURNING id, assessment_id, status, lecturer_comment, created_by, submitted_at
                """,
                assessment_id,
                comment,
            )
        else:
            # First submission - create new case
            moderation_case = await conn.fetchrow(
                """
                INSERT INTO moderation_cases (
                    assessment_id, status, lecturer_comment, created_by, submitted_at
                )
                VALUES ($1, 'IN_MODERATION', $2, $3, NOW())
                RETURNING id, assessment_id, status, lecturer_comment, created_by, submitted_at
                """,
                assessment_id,
                comment,
                submitted_by,
            )

        await conn.execute(
            """
            UPDATE assessments SET status = 'IN_MODERATION', updated_at = NOW()
            WHERE id = $1
            """,
            assessment_id,
        )

    return dict(moderation_case)


async def make_moderation_decision(
    db: asyncpg.Pool,
    *,
    moderation_case_id: UUID,
    decision: str,
    comment: Optional[str],
    moderator_id: UUID,
) -> dict[str, Any]:
    new_status = {
        "APPROVED": "APPROVED",
        "CHANGES_REQUESTED": "CHANGES_REQUESTED",
        "ESCALATED": "ESCALATED",
    }.get(decision, "IN_MODERATION")

    async with db.acquire() as conn:
        moderation_case = await conn.fetchrow(
            """
            UPDATE moderation_cases
            SET status = $1, moderator_comment = $2, moderator_id = $3, decided_at = NOW(), updated_at = NOW()
            WHERE id = $4
            RETURNING id, assessment_id, status, moderator_comment, moderator_id, decided_at
            """,
            new_status,
            comment,
            moderator_id,
            moderation_case_id,
        )

        await conn.execute(
            """
            UPDATE assessments SET status = $1, updated_at = NOW()
            WHERE id = (SELECT assessment_id FROM moderation_cases WHERE id = $2)
            """,
            new_status,
            moderation_case_id,
        )

        if decision == "ESCALATED":
            await conn.execute(
                """
                UPDATE moderation_cases SET escalated_at = NOW(), updated_at = NOW()
                WHERE id = $1
                """,
                moderation_case_id,
            )

    return dict(moderation_case)


async def make_third_marker_decision(
    db: asyncpg.Pool,
    *,
    moderation_case_id: UUID,
    decision: str,
    comment: Optional[str],
    third_marker_id: UUID,
) -> dict[str, Any]:
    # CONFIRM_MODERATOR = Third marker agrees with moderator's concerns → lecturer must revise
    # OVERRIDE_MODERATOR = Third marker disagrees, marks are fine → approved
    # REFER_BACK = Needs more review → back to moderation
    new_status = {
        "CONFIRM_MODERATOR": "CHANGES_REQUESTED",  # Lecturer must revise marks
        "OVERRIDE_MODERATOR": "APPROVED",           # Third marker says marks are OK
        "REFER_BACK": "IN_MODERATION",              # Back to moderator for more review
    }.get(decision, "ESCALATED")

    async with db.acquire() as conn:
        moderation_case = await conn.fetchrow(
            """
            UPDATE moderation_cases
            SET status = $1, third_marker_comment = $2, third_marker_id = $3,
                decided_at = NOW(), updated_at = NOW()
            WHERE id = $4
            RETURNING id, assessment_id, status, third_marker_comment, third_marker_id, decided_at
            """,
            new_status,
            comment,
            third_marker_id,
            moderation_case_id,
        )

        await conn.execute(
            """
            UPDATE assessments SET status = $1, updated_at = NOW()
            WHERE id = (SELECT assessment_id FROM moderation_cases WHERE id = $2)
            """,
            new_status,
            moderation_case_id,
        )

    return dict(moderation_case)


async def get_moderation_case_by_assessment(
    db: asyncpg.Pool, assessment_id: UUID
) -> Optional[dict[str, Any]]:
    row = await db.fetchrow(
        """
        SELECT mc.id, mc.assessment_id, mc.moderator_id, mc.third_marker_id,
               mc.status, mc.lecturer_comment, mc.moderator_comment, mc.third_marker_comment,
               mc.submitted_at, mc.escalated_at, mc.decided_at, mc.created_at, mc.updated_at,
               u1.full_name as lecturer_name,
               u2.full_name as moderator_name,
               u3.full_name as third_marker_name,
               s.size as sample_size,
               s.method as sample_method,
               s.percent as sample_percent
        FROM moderation_cases mc
        JOIN assessments a ON mc.assessment_id = a.id
        LEFT JOIN users u1 ON a.created_by = u1.id
        LEFT JOIN users u2 ON mc.moderator_id = u2.id
        LEFT JOIN users u3 ON mc.third_marker_id = u3.id
        LEFT JOIN sample_sets s ON a.id = s.assessment_id
        WHERE mc.assessment_id = $1
        ORDER BY mc.created_at DESC
        LIMIT 1
        """,
        assessment_id,
    )
    return dict(row) if row else None


async def get_sample_items(db: asyncpg.Pool, assessment_id: UUID) -> list[dict[str, Any]]:
    rows = await db.fetch(
        """
        SELECT si.id, si.sample_set_id, si.student_id, si.original_mark as mark, si.marker_id, si.moderator_note
        FROM sample_items si
        JOIN sample_sets ss ON si.sample_set_id = ss.id
        WHERE ss.assessment_id = $1
        ORDER BY si.original_mark DESC
        """,
        assessment_id,
    )
    return [dict(r) for r in rows]


async def get_lecturer_dashboard_stats(db: asyncpg.Pool, lecturer_id: UUID) -> dict[str, int]:
    row = await db.fetchrow(
        """
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'DRAFT') as draft,
            COUNT(*) FILTER (WHERE status = 'MARKS_UPLOADED') as marks_uploaded,
            COUNT(*) FILTER (WHERE status = 'SAMPLE_GENERATED') as sample_generated,
            COUNT(*) FILTER (WHERE status = 'SUBMITTED_FOR_MODERATION') as pending_moderation,
            COUNT(*) FILTER (WHERE status = 'IN_MODERATION') as in_moderation,
            COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
            COUNT(*) FILTER (WHERE status = 'CHANGES_REQUESTED') as changes_requested
        FROM assessments
        WHERE created_by = $1
        """,
        lecturer_id,
    )
    return dict(row) if row else {}


async def get_moderator_dashboard_stats(db: asyncpg.Pool) -> dict[str, int]:
    row = await db.fetchrow(
        """
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'SUBMITTED_FOR_MODERATION') as pending,
            COUNT(*) FILTER (WHERE status = 'IN_MODERATION') as in_moderation,
            COUNT(*) FILTER (WHERE status = 'ESCALATED') as escalated
        FROM assessments
        WHERE status IN ('SUBMITTED_FOR_MODERATION', 'IN_MODERATION', 'ESCALATED')
        """,
    )
    return dict(row) if row else {}


async def get_third_marker_dashboard_stats(db: asyncpg.Pool) -> dict[str, int]:
    row = await db.fetchrow(
        """
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'ESCALATED') as escalated,
            COUNT(*) FILTER (WHERE status = 'ESCALATED') as in_review
        FROM assessments
        WHERE status = 'ESCALATED'
        """,
    )
    return dict(row) if row else {}


async def get_admin_stats(db: asyncpg.Pool) -> dict[str, Any]:
    row = await db.fetchrow(
        """
        SELECT
            COUNT(*) as total_assessments,
            COALESCE(json_object_agg(status, count) FILTER (WHERE status IS NOT NULL), '{}'::json) as by_status
        FROM (
            SELECT status, COUNT(*) as count
            FROM assessments
            GROUP BY status
        ) sub
        """,
    )

    users_row = await db.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
            COUNT(*) FILTER (WHERE role = 'lecturer') as lecturers,
            COUNT(*) FILTER (WHERE role = 'moderator') as moderators,
            COUNT(*) FILTER (WHERE role = 'third_marker') as third_markers
        FROM users
        """,
    )

    activity_row = await db.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE action LIKE '%upload%') as uploads,
            COUNT(*) FILTER (WHERE action LIKE '%submit%') as submissions,
            COUNT(*) FILTER (WHERE action LIKE '%decision%') as decisions
        FROM audit_log
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
        """,
    )

    return {
        "total_assessments": row["total_assessments"] if row else 0,
        "by_status": row["by_status"] if row else {},
        "users": dict(users_row) if users_row else {},
        "activity_last_24h": dict(activity_row) if activity_row else {},
    }


async def get_audit_events(db: asyncpg.Pool, limit: int = 20) -> list[dict[str, Any]]:
    rows = await db.fetch(
        """
        SELECT id, timestamp, actor_id, actor_name, actor_role, action, assessment_id
        FROM audit_log
        ORDER BY timestamp DESC
        LIMIT $1
        """,
        limit,
    )
    return [dict(r) for r in rows]


async def create_module_run(
    db: asyncpg.Pool,
    *,
    module_id: UUID,
    academic_year: str,
    semester: Optional[str] = None,
    cohort_size: int = 0,
    created_by: UUID,
) -> dict[str, Any]:
    row = await db.fetchrow(
        """
        INSERT INTO module_runs (module_id, academic_year, semester, cohort_size, created_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (module_id, academic_year, COALESCE(semester, '__NO_SEMESTER__'))
        DO UPDATE SET cohort_size = $4, updated_at = NOW()
        RETURNING id, module_id, academic_year, semester, cohort_size, created_by, created_at, updated_at
        """,
        module_id,
        academic_year,
        semester,
        cohort_size,
        created_by,
    )
    return dict(row)


async def get_or_create_module(
    db: asyncpg.Pool,
    *,
    code: str,
    title: str,
    credits: Optional[int] = None,
    created_by: UUID,
) -> dict[str, Any]:
    row = await db.fetchrow(
        """
        INSERT INTO modules (code, title, credits, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO UPDATE SET title = $2, credits = $3
        RETURNING id, code, title, credits, created_by, created_at, updated_at
        """,
        code,
        title,
        credits,
        created_by,
    )
    return dict(row)


# ========================================
# MODULE QUERIES
# ========================================

async def list_modules(
    db: asyncpg.Pool,
    *,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List all modules with assessment count and latest cohort."""
    rows = await db.fetch(
        """
        SELECT
            m.id,
            m.code,
            m.title,
            m.credits,
            m.created_at,
            m.updated_at,
            COUNT(a.id)::int AS assessment_count,
            MAX(a.cohort) AS latest_cohort
        FROM modules m
        LEFT JOIN assessments a ON a.module_code = m.code
        GROUP BY m.id, m.code, m.title, m.credits, m.created_at, m.updated_at
        ORDER BY m.code ASC
        LIMIT $1
        """,
        limit,
    )
    return [dict(r) for r in rows]


# ========================================
# MODERATION FORM RESPONSES
# ========================================

async def save_moderation_form_response(
    db: asyncpg.Pool,
    *,
    assessment_id: UUID,
    moderator_id: UUID,
    form_data,  # ModerationFormSubmit pydantic model
) -> dict[str, Any]:
    """
    Save moderation form responses (the 6 questions from the moderation form).
    First looks up the moderation case by assessment_id.
    """
    # Get the moderation case for this assessment
    moderation_case = await db.fetchrow(
        "SELECT id FROM moderation_cases WHERE assessment_id = $1",
        assessment_id
    )
    if not moderation_case:
        raise ValueError(f"No moderation case found for assessment {assessment_id}")
    
    moderation_case_id = moderation_case["id"]
    
    row = await db.fetchrow(
        """
        INSERT INTO moderation_form_responses (
            moderation_case_id, responder_id,
            has_marking_rubric, has_marking_rubric_comment,
            criteria_consistently_applied, criteria_consistently_applied_comment,
            full_range_of_marks_used, full_range_of_marks_used_comment,
            marks_awarded_fairly, marks_awarded_fairly_comment,
            feedback_comments_appropriate, feedback_comments_appropriate_comment,
            all_marks_appropriate, all_marks_appropriate_comment,
            recommendations, feedback_suggestions
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
        """,
        moderation_case_id,
        moderator_id,
        form_data.has_marking_rubric,
        form_data.has_marking_rubric_comment,
        form_data.criteria_consistently_applied,
        form_data.criteria_consistently_applied_comment,
        form_data.full_range_of_marks_used,
        form_data.full_range_of_marks_used_comment,
        form_data.marks_awarded_fairly,
        form_data.marks_awarded_fairly_comment,
        form_data.feedback_comments_appropriate,
        form_data.feedback_comments_appropriate_comment,
        form_data.all_marks_appropriate,
        form_data.all_marks_appropriate_comment,
        form_data.recommendations,
        form_data.feedback_suggestions,
    )
    return dict(row)


async def get_moderation_form_responses(
    db: asyncpg.Pool,
    assessment_id: UUID,
) -> list[dict[str, Any]]:
    """Get all form responses for an assessment's moderation case."""
    rows = await db.fetch(
        """
        SELECT mfr.*, u.full_name as responder_name, u.role as responder_role
        FROM moderation_form_responses mfr
        JOIN moderation_cases mc ON mfr.moderation_case_id = mc.id
        LEFT JOIN users u ON mfr.responder_id = u.id
        WHERE mc.assessment_id = $1
        ORDER BY mfr.created_at DESC
        """,
        assessment_id,
    )
    return [dict(r) for r in rows]


async def get_latest_moderation_form_response(
    db: asyncpg.Pool,
    assessment_id: UUID,
) -> Optional[dict[str, Any]]:
    """Get the most recent form response for an assessment's moderation case."""
    row = await db.fetchrow(
        """
        SELECT mfr.*, u.full_name as responder_name, u.role as responder_role
        FROM moderation_form_responses mfr
        JOIN moderation_cases mc ON mfr.moderation_case_id = mc.id
        LEFT JOIN users u ON mfr.responder_id = u.id
        WHERE mc.assessment_id = $1
        ORDER BY mfr.created_at DESC
        LIMIT 1
        """,
        assessment_id,
    )
    return dict(row) if row else None


# ===============================
# Pre-Moderation Checklist Queries
# ===============================

async def save_pre_moderation_checklist(
    db: asyncpg.Pool,
    assessment_id: UUID,
    user_id: UUID,
    marking_in_accordance: bool,
    late_work_policy_adhered: bool,
    plagiarism_policy_adhered: bool,
    marks_available_with_percentages: bool,
    totalling_checked: bool,
    consistency_comments: Optional[str],
) -> dict[str, Any]:
    """Save or update pre-moderation checklist for an assessment."""
    row = await db.fetchrow(
        """
        INSERT INTO pre_moderation_checklists (
            assessment_id, completed_by, marking_in_accordance, late_work_policy_adhered,
            plagiarism_policy_adhered, marks_available_with_percentages, totalling_checked,
            consistency_comments
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (assessment_id) DO UPDATE SET
            completed_by = EXCLUDED.completed_by,
            marking_in_accordance = EXCLUDED.marking_in_accordance,
            late_work_policy_adhered = EXCLUDED.late_work_policy_adhered,
            plagiarism_policy_adhered = EXCLUDED.plagiarism_policy_adhered,
            marks_available_with_percentages = EXCLUDED.marks_available_with_percentages,
            totalling_checked = EXCLUDED.totalling_checked,
            consistency_comments = EXCLUDED.consistency_comments,
            updated_at = NOW()
        RETURNING *
        """,
        assessment_id,
        user_id,
        marking_in_accordance,
        late_work_policy_adhered,
        plagiarism_policy_adhered,
        marks_available_with_percentages,
        totalling_checked,
        consistency_comments,
    )
    return dict(row)


async def get_pre_moderation_checklist(
    db: asyncpg.Pool,
    assessment_id: UUID,
) -> Optional[dict[str, Any]]:
    """Get pre-moderation checklist for an assessment."""
    row = await db.fetchrow(
        """
        SELECT pmc.*, u.full_name as completed_by_name
        FROM pre_moderation_checklists pmc
        LEFT JOIN users u ON pmc.completed_by = u.id
        WHERE pmc.assessment_id = $1
        """,
        assessment_id,
    )
    return dict(row) if row else None


# ===============================
# Module Leader Response Queries
# ===============================

async def save_module_leader_response(
    db: asyncpg.Pool,
    moderation_case_id: UUID,
    user_id: UUID,
    moderator_comments_considered: bool,
    response_to_issues: Optional[str],
    outliers_explanation: Optional[str],
    needs_third_marker: bool,
) -> dict[str, Any]:
    """Save or update module leader response for a moderation case."""
    row = await db.fetchrow(
        """
        INSERT INTO module_leader_responses (
            moderation_case_id, completed_by, moderator_comments_considered,
            response_to_issues, outliers_explanation, needs_third_marker
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (moderation_case_id) DO UPDATE SET
            completed_by = EXCLUDED.completed_by,
            moderator_comments_considered = EXCLUDED.moderator_comments_considered,
            response_to_issues = EXCLUDED.response_to_issues,
            outliers_explanation = EXCLUDED.outliers_explanation,
            needs_third_marker = EXCLUDED.needs_third_marker,
            updated_at = NOW()
        RETURNING *
        """,
        moderation_case_id,
        user_id,
        moderator_comments_considered,
        response_to_issues,
        outliers_explanation,
        needs_third_marker,
    )
    return dict(row)


async def get_module_leader_response(
    db: asyncpg.Pool,
    moderation_case_id: UUID,
) -> Optional[dict[str, Any]]:
    """Get module leader response for a moderation case."""
    row = await db.fetchrow(
        """
        SELECT mlr.*, u.full_name as completed_by_name
        FROM module_leader_responses mlr
        LEFT JOIN users u ON mlr.completed_by = u.id
        WHERE mlr.moderation_case_id = $1
        """,
        moderation_case_id,
    )
    return dict(row) if row else None


async def get_module_leader_response_by_assessment(
    db: asyncpg.Pool,
    assessment_id: UUID,
) -> Optional[dict[str, Any]]:
    """Get module leader response for an assessment's moderation case."""
    row = await db.fetchrow(
        """
        SELECT mlr.*, u.full_name as completed_by_name
        FROM module_leader_responses mlr
        JOIN moderation_cases mc ON mlr.moderation_case_id = mc.id
        LEFT JOIN users u ON mlr.completed_by = u.id
        WHERE mc.assessment_id = $1
        """,
        assessment_id,
    )
    return dict(row) if row else None
