# Enable postponed evaluation of annotations (allows forward references in type hints)
from __future__ import annotations

# Import type hints
from typing import Any, Optional
# Import UUID type for primary/foreign key parameters
from uuid import UUID

# Import asyncpg for typed database connection pool
import asyncpg


# ===============================
# Audit Logging
# ===============================

async def log_audit_event(
    db: asyncpg.Pool,
    *,
    actor_id: UUID,          # Who performed the action
    actor_name: str,         # Display name for the audit log
    actor_role: str,         # Role of the user (for filtering)
    action: str,             # Description of what happened (e.g. "uploaded marks")
    assessment_id: Optional[UUID] = None,  # Related assessment (if applicable)
) -> dict[str, Any]:
    """Insert an audit log entry. Every significant action in the system
    is logged here for compliance and traceability (academic regulation requirement)."""
    row = await db.fetchrow(
        """
        INSERT INTO audit_log (actor_id, actor_name, actor_role, action, assessment_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, timestamp, actor_id, actor_name, actor_role, action, assessment_id
        """,
        actor_id,        # $1
        actor_name,      # $2
        actor_role,      # $3
        action,          # $4
        assessment_id,   # $5
    )
    return dict(row)


# ===============================
# Assessment CRUD Operations
# ===============================

async def create_assessment(
    db: asyncpg.Pool,
    *,
    module_code: str,       # e.g. "CS2001"
    module_name: str,       # e.g. "Software Engineering"
    title: str,             # e.g. "Coursework 1"
    cohort: str,            # e.g. "2025/26"
    due_date: str,          # YYYY-MM-DD format
    weighting: int,         # Percentage of module mark (0-100)
    module_run_id: UUID,    # Links to the module_runs table
    credit_size: int,       # Module credits (15, 20, 30+)
    created_by: UUID,       # Lecturer who created this assessment
) -> dict[str, Any]:
    """Create a new assessment record in DRAFT status.
    Converts due_date string to a Python date object for PostgreSQL."""
    from datetime import date
    # Convert due_date string to a proper date object if needed
    if isinstance(due_date, str):
        due_date_obj = date.fromisoformat(due_date)  # Parse "2025-06-15" format
    else:
        due_date_obj = due_date  # Already a date object
        
    # Insert the assessment with initial DRAFT status
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
        module_code,     # $1
        module_name,     # $2
        title,           # $3
        cohort,          # $4
        due_date_obj,    # $5 - converted to date
        weighting,       # $6
        module_run_id,   # $7
        credit_size,     # $8
        created_by,      # $9 - lecturer's user ID
    )
    return dict(row)


async def get_assessment_by_id(db: asyncpg.Pool, assessment_id: UUID) -> Optional[dict[str, Any]]:
    """Fetch a single assessment with its mark count and sample info.
    Uses LEFT JOINs to include marks count and latest sample set data."""
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
    """Fetch all assessments created by a specific lecturer.
    Includes mark counts and latest sample info via LATERAL subquery.
    LATERAL allows us to get just the most recent sample set for each assessment."""
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
    """Fetch all assessments that need moderator attention.
    Includes assessments in SUBMITTED_FOR_MODERATION, IN_MODERATION, or ESCALATED status.
    Joins with users table to get the lecturer's name for display."""
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
    """Fetch all assessments escalated to third marker review.
    Includes both lecturer and moderator names, plus escalation timestamp.
    Only returns assessments in ESCALATED status."""
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


# ===============================
# Mark Upload & Revision Tracking
# ===============================

async def upload_marks(
    db: asyncpg.Pool,
    *,
    assessment_id: UUID,           # Which assessment to upload marks for
    marks: list[dict[str, Any]],   # List of {student_id, mark, marker_id} dicts
    uploaded_by: UUID,             # Who is uploading the marks
    is_revision: bool = False,     # Whether this is a mark revision (after changes requested)
) -> dict[str, Any]:
    """Upload student marks for an assessment. Handles both initial uploads
    and revisions. Uses UPSERT (INSERT ... ON CONFLICT) to handle duplicates.
    Tracks revision history when marks change."""
    processed = 0          # Counter for successfully saved marks
    errors = []            # Collect error messages for failed entries
    revisions_tracked = 0  # Counter for marks that changed during revision

    # Process each mark individually
    for mark_data in marks:
        student_id = mark_data.get("student_id")  # e.g. "w1234567"
        mark = mark_data.get("mark")               # e.g. 72.5
        marker_id = mark_data.get("marker_id")     # Optional: who marked it
        # Only include revision reason if this is a revision upload
        revision_reason = mark_data.get("revision_reason") if is_revision else None

        # Validate required fields
        if not student_id or mark is None:
            errors.append(f"Missing student_id or mark for record")
            continue

        # Validate mark is in valid range (0-100)
        if not (0 <= mark <= 100):
            errors.append(f"Mark out of range for {student_id}")
            continue

        try:
            # If this is a revision, get the old mark first for history tracking
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

            # Insert or update the mark using UPSERT (ON CONFLICT ... DO UPDATE)
            # This handles both new marks and updates to existing marks
            result = await db.fetchrow(
                """
                INSERT INTO marks (assessment_id, student_id, mark, marker_id, uploaded_by, is_revised, revision_reason)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (assessment_id, student_id) 
                DO UPDATE SET mark = $3, marker_id = $4, uploaded_by = $5, 
                              is_revised = $6, revision_reason = $7, updated_at = NOW()
                RETURNING id
                """,
                assessment_id,    # $1
                student_id,       # $2
                mark,             # $3
                marker_id,        # $4
                uploaded_by,      # $5
                is_revision,      # $6
                revision_reason,  # $7
            )
            
            # Track revision history if the mark actually changed
            if is_revision and old_mark is not None and old_mark != mark:
                await db.execute(
                    """
                    INSERT INTO marks_revision_history 
                    (mark_id, assessment_id, student_id, original_mark, revised_mark, revision_reason, revised_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    mark_id or result["id"],  # Use existing mark ID or newly created one
                    assessment_id,
                    student_id,
                    old_mark,                 # The old mark value
                    mark,                     # The new mark value
                    revision_reason,
                    uploaded_by,
                )
                revisions_tracked += 1
            
            processed += 1
        except Exception as e:
            errors.append(f"Error processing {student_id}: {str(e)}")

    # Build the response dict
    result_data = {"processed": processed, "skipped": len(marks) - processed, "errors": errors}
    if is_revision:
        result_data["revisions_tracked"] = revisions_tracked
    
    return result_data


# ===============================
# Sample Size Calculation (Academic Regulations Section 12.18)
# ===============================

def calculate_required_sample_size(cohort_size: int) -> int:
    """
    Calculate minimum sample size based on academic regulations (Section 12.18).
    This is a key business rule derived from the university's marking regulations.
    
    Rules:
    - < 100 students: 20% or 10 students' assessments (whichever is greater)
    - 100 – 300 students: 15%
    - > 300 students: 10%
    """
    if cohort_size < 100:
        # For small cohorts: take 20% but ensure at least 10 (or all if fewer than 10)
        return max(int(cohort_size * 0.20), min(10, cohort_size))
    elif cohort_size <= 300:
        # Medium cohorts: 15%
        return int(cohort_size * 0.15)
    else:
        # Large cohorts: 10%
        return int(cohort_size * 0.10)


# ===============================
# Sample Generation (Academic Regulations Section 12.19-12.20)
# ===============================

async def generate_sample(
    db: asyncpg.Pool,
    *,
    assessment_id: UUID,       # Which assessment to sample from
    method: str,               # RANDOM, STRATIFIED, or RISK_BASED
    percent: float,            # Requested sample percentage
    generated_by: UUID,        # Who triggered the generation
) -> dict[str, Any]:
    """
    Generate moderation sample according to academic regulations (Section 12.19-12.20).
    
    The sample MUST include (as mandated by regulations):
    - Representative coverage of all markers
    - Full range of marks achieved by cohort
    - ALL assessments within two marks below pass mark (38-39%)
    - Highest and lowest marks
    - Boundary cases: 38-42%, 58-62%, 68-72%
    
    Three sampling methods are available:
    - RANDOM: Mandatory inclusions + random fill to meet size requirement
    - STRATIFIED: Mandatory inclusions + proportional sampling across mark bands
    - RISK_BASED: Mandatory inclusions + focus on fail/outlier marks
    """
    import random
    
    # Fetch all marks for this assessment, sorted by mark descending
    marks = await db.fetch(
        """
        SELECT id, student_id, mark, marker_id
        FROM marks
        WHERE assessment_id = $1
        ORDER BY mark DESC
        """,
        assessment_id,
    )

    # Return empty sample if no marks exist
    if not marks:
        return {"sample_size": 0, "method": method, "percent": percent, "sample_items": []}

    total_marks = len(marks)
    
    # Calculate the minimum sample size required by regulations
    regulation_min_size = calculate_required_sample_size(total_marks)
    # Calculate the user's requested sample size based on percentage
    user_requested_size = max(int(total_marks * (percent / 100)), 1)
    # Use whichever is larger - regulations take priority
    required_size = max(regulation_min_size, user_requested_size)

    # Set to track which mark indices are selected (prevents duplicates)
    selected_indices = set()
    
    # MANDATORY: Include ALL marks within two below pass mark (38-39%) - Section 12.20
    # This is a strict regulation requirement - these MUST be in the sample
    within_two_below_pass = [idx for idx, m in enumerate(marks) if 38 <= m["mark"] < 40]
    selected_indices.update(within_two_below_pass)
    
    # MANDATORY: Include highest and lowest marks
    if total_marks > 0:
        selected_indices.add(0)                # Highest mark (list is sorted DESC)
        selected_indices.add(total_marks - 1)  # Lowest mark
    
    # Include boundary cases as required by Section 12.19
    # Pass/fail boundary: 38-42% (critical - determines if student passes)
    pass_fail_boundary = [idx for idx, m in enumerate(marks) if 38 <= m["mark"] <= 42]
    selected_indices.update(pass_fail_boundary)
    
    # 2:2/2:1 boundary: 58-62% (classification boundary)
    lower_boundary = [idx for idx, m in enumerate(marks) if 58 <= m["mark"] <= 62]
    selected_indices.update(lower_boundary)
    
    # 2:1/First boundary: 68-72% (classification boundary)
    upper_boundary = [idx for idx, m in enumerate(marks) if 68 <= m["mark"] <= 72]
    selected_indices.update(upper_boundary)
    
    # Ensure representative coverage of all markers (Section 12.19)
    # Group marks by marker_id
    markers = {}
    for idx, m in enumerate(marks):
        marker = m["marker_id"] or "unknown"
        if marker not in markers:
            markers[marker] = []
        markers[marker].append(idx)
    
    # Include at least one mark from each marker
    for marker, indices in markers.items():
        if not any(i in selected_indices for i in indices):
            selected_indices.add(random.choice(indices))

    # Now fill remaining slots based on the chosen sampling method
    if method == "RANDOM":
        # Simple random selection to fill remaining slots
        remaining = required_size - len(selected_indices)
        if remaining > 0:
            available = [idx for idx in range(total_marks) if idx not in selected_indices]
            if available:
                selected_indices.update(random.sample(available, min(remaining, len(available))))

    elif method == "STRATIFIED":
        # Stratified sampling: proportional representation across mark bands
        # Ensures each grade band is represented in the sample
        bands = [(90, 100), (70, 89), (60, 69), (50, 59), (40, 49), (0, 39)]
        remaining = required_size - len(selected_indices)
        
        for low, high in bands:
            # Get unselected marks in this band
            band_marks = [idx for idx, m in enumerate(marks) if low <= m["mark"] <= high and idx not in selected_indices]
            if band_marks and remaining > 0:
                # Allocate equal slots to each band
                band_size = max(1, remaining // len(bands))
                to_add = random.sample(band_marks, min(band_size, len(band_marks)))
                selected_indices.update(to_add)
                remaining -= len(to_add)

    else:  # RISK_BASED (default - recommended method)
        # Focus on risk areas: failing marks, near-boundaries, and outliers
        # This is the most thorough method for catching marking issues
        
        # Include up to 5 additional failing marks
        fail_marks = [idx for idx, m in enumerate(marks) if m["mark"] < 40 and idx not in selected_indices]
        selected_indices.update(fail_marks[:5])
        
        # Include up to 3 high outliers (marks 90+) which may indicate lenient marking
        high_outliers = [idx for idx, m in enumerate(marks) if m["mark"] >= 90 and idx not in selected_indices]
        selected_indices.update(high_outliers[:3])
        
        # Fill remaining slots randomly
        remaining = required_size - len(selected_indices)
        if remaining > 0:
            available = [idx for idx in range(total_marks) if idx not in selected_indices]
            if available:
                selected_indices.update(random.sample(available, min(remaining, len(available))))

    # Get the actual mark records for selected indices
    sample_marks = [marks[i] for i in selected_indices]

    # Save the sample set and items to the database in a single transaction
    async with db.acquire() as conn:
        # Create the sample_set record (metadata about this sample)
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

        # Insert each sample item with the reason it was included
        sample_items = []
        for mark_data in sample_marks:
            # Determine why this mark was included in the sample
            mark_val = mark_data["mark"]
            reasons = []
            if 38 <= mark_val < 40:
                reasons.append("within_two_below_pass")     # Regulation 12.20
            if 38 <= mark_val <= 42:
                reasons.append("pass_fail_boundary")        # Pass/fail boundary
            if 58 <= mark_val <= 62:
                reasons.append("2:2_2:1_boundary")          # Classification boundary
            if 68 <= mark_val <= 72:
                reasons.append("2:1_first_boundary")        # Classification boundary
            if mark_val >= 90:
                reasons.append("high_outlier")              # Potential outlier
            if mark_val < 40:
                reasons.append("fail")                      # Failing mark
            if not reasons:
                reasons.append("random_sample")             # Random/stratified fill
            
            # Insert the sample item record
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

        # Update the assessment status to SAMPLE_GENERATED
        await conn.execute(
            """
            UPDATE assessments SET status = 'SAMPLE_GENERATED', updated_at = NOW()
            WHERE id = $1
            """,
            assessment_id,
        )

    # Return the complete sample generation results
    return {
        "sample_size": len(sample_marks),
        "method": method,
        "percent": percent,
        "regulation_min_size": regulation_min_size,
        "within_two_below_pass_count": len(within_two_below_pass),
        "sample_items": sample_items,
    }


# ===============================
# Moderation Workflow Operations
# ===============================

async def submit_for_moderation(
    db: asyncpg.Pool,
    *,
    assessment_id: UUID,       # Which assessment to submit
    comment: Optional[str],    # Optional note from lecturer to moderator
    submitted_by: UUID,        # Lecturer's user ID
) -> dict[str, Any]:
    """Submit an assessment for moderation review.
    Handles both first-time submissions and resubmissions (after changes requested).
    Creates or updates the moderation_cases record."""
    async with db.acquire() as conn:
        # Check if a moderation case already exists (this would be a resubmission)
        existing_case = await conn.fetchrow(
            "SELECT id FROM moderation_cases WHERE assessment_id = $1",
            assessment_id,
        )
        
        if existing_case:
            # Resubmission after changes were requested - update existing case
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
            # First submission - create a new moderation case
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

        # Update the assessment's status to IN_MODERATION
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
    moderation_case_id: UUID,     # Which moderation case
    decision: str,                # APPROVED, CHANGES_REQUESTED, or ESCALATED
    comment: Optional[str],       # Moderator's justification
    moderator_id: UUID,           # Who is making the decision
) -> dict[str, Any]:
    """Record a moderator's decision on a moderation case.
    Maps the decision to the corresponding assessment status.
    If ESCALATED, also records the escalation timestamp."""
    # Map moderator decision to the new assessment status
    new_status = {
        "APPROVED": "APPROVED",                    # Marks confirmed as appropriate
        "CHANGES_REQUESTED": "CHANGES_REQUESTED",  # Lecturer needs to revise marks
        "ESCALATED": "ESCALATED",                  # Disagreement - needs third marker
    }.get(decision, "IN_MODERATION")

    async with db.acquire() as conn:
        # Update the moderation case with the decision
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

        # Update the assessment status to match the decision
        await conn.execute(
            """
            UPDATE assessments SET status = $1, updated_at = NOW()
            WHERE id = (SELECT assessment_id FROM moderation_cases WHERE id = $2)
            """,
            new_status,
            moderation_case_id,
        )

        # If escalated, record when the escalation happened
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
    moderation_case_id: UUID,     # Which moderation case
    decision: str,                # CONFIRM_MODERATOR, OVERRIDE_MODERATOR, or REFER_BACK
    comment: Optional[str],       # Third marker's justification
    third_marker_id: UUID,        # Who is making the decision
) -> dict[str, Any]:
    """Record a third marker's binding decision on an escalated case.
    The third marker resolves disputes between lecturer and moderator."""
    # Map third marker decision to the appropriate status
    new_status = {
        "CONFIRM_MODERATOR": "CHANGES_REQUESTED",  # Agrees with moderator → lecturer must revise
        "OVERRIDE_MODERATOR": "APPROVED",           # Disagrees with moderator → original marks are fine
        "REFER_BACK": "IN_MODERATION",              # Needs more discussion → back to moderation
    }.get(decision, "ESCALATED")

    async with db.acquire() as conn:
        # Update the moderation case with the third marker's decision
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

        # Update the assessment status to match
        await conn.execute(
            """
            UPDATE assessments SET status = $1, updated_at = NOW()
            WHERE id = (SELECT assessment_id FROM moderation_cases WHERE id = $2)
            """,
            new_status,
            moderation_case_id,
        )

    return dict(moderation_case)


# ===============================
# Moderation Case & Sample Retrieval
# ===============================

async def get_moderation_case_by_assessment(
    db: asyncpg.Pool, assessment_id: UUID
) -> Optional[dict[str, Any]]:
    """Fetch the moderation case for an assessment, including joined user names
    and sample metadata. Uses multiple LEFT JOINs to get participant names."""
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
    """Fetch all sample items for an assessment, sorted by mark descending.
    These are the individual student marks that the moderator reviews."""
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


# ===============================
# Dashboard Statistics Queries
# ===============================

async def get_lecturer_dashboard_stats(db: asyncpg.Pool, lecturer_id: UUID) -> dict[str, int]:
    """Get assessment counts grouped by status for a specific lecturer's dashboard.
    Uses PostgreSQL FILTER clause for efficient single-pass counting."""
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
    """Get counts of assessments needing moderation attention.
    Only counts assessments in moderation-relevant statuses."""
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
    """Get counts of escalated assessments needing third marker review."""
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
    """Get system-wide statistics for the admin dashboard.
    Aggregates assessment counts by status, user counts by role,
    and recent audit activity in the last 24 hours."""
    # Get assessment totals and counts grouped by status
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

    # Get user counts by role (for admin overview)
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

    # Get audit activity in the last 24 hours (grouped by action type)
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

    # Combine all stats into a single response dict
    return {
        "total_assessments": row["total_assessments"] if row else 0,
        "by_status": row["by_status"] if row else {},
        "users": dict(users_row) if users_row else {},
        "activity_last_24h": dict(activity_row) if activity_row else {},
    }


async def get_audit_events(db: asyncpg.Pool, limit: int = 20) -> list[dict[str, Any]]:
    """Fetch the most recent audit log entries for the admin audit trail page.
    Returns the latest N events ordered by most recent first."""
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


# ===============================
# Module & Module Run Operations
# ===============================

async def create_module_run(
    db: asyncpg.Pool,
    *,
    module_id: UUID,                      # Which module this run belongs to
    academic_year: str,                    # e.g. "2025/26"
    semester: Optional[str] = None,       # Optional semester (e.g. "1", "2")
    cohort_size: int = 0,                 # Number of students enrolled
    created_by: UUID,                     # Who created this run
) -> dict[str, Any]:
    """Create or update a module run (a module offered in a specific academic year).
    Uses UPSERT to handle duplicate academic year/semester combinations."""
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
    code: str,                             # Module code (e.g. "CS2001")
    title: str,                            # Module title
    credits: Optional[int] = None,         # Credit value (15, 20, 30+)
    created_by: UUID,                      # Who is creating/updating the module
) -> dict[str, Any]:
    """Get an existing module by code, or create it if it doesn't exist.
    Uses UPSERT (INSERT ... ON CONFLICT) to handle the create-or-update pattern.
    The unique constraint is on the module code."""
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
# MODULE LISTING QUERIES (Admin Dashboard)
# ========================================

async def list_modules(
    db: asyncpg.Pool,
    *,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List all modules with their assessment count and latest cohort year.
    Uses LEFT JOIN to include modules with zero assessments.
    Used by the admin Modules page."""
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
# MODERATION FORM RESPONSE QUERIES
# (The 6 questions from the official moderation form)
# ========================================

async def save_moderation_form_response(
    db: asyncpg.Pool,
    *,
    assessment_id: UUID,      # Which assessment this form is for
    moderator_id: UUID,       # Who filled in the form
    form_data,                # ModerationFormResponse Pydantic model with 6 questions
) -> dict[str, Any]:
    """
    Save moderation form responses (the 6 mandatory questions from the university
    moderation form). First looks up the moderation case by assessment_id,
    then inserts the form response record.
    """
    # Find the moderation case for this assessment
    moderation_case = await db.fetchrow(
        "SELECT id FROM moderation_cases WHERE assessment_id = $1",
        assessment_id
    )
    if not moderation_case:
        raise ValueError(f"No moderation case found for assessment {assessment_id}")
    
    moderation_case_id = moderation_case["id"]
    
    # Insert all 6 form questions with their answers and optional comments
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
        moderation_case_id,                              # $1 - which case
        moderator_id,                                    # $2 - who responded
        form_data.has_marking_rubric,                    # $3 - Q1 answer (bool)
        form_data.has_marking_rubric_comment,            # $4 - Q1 comment
        form_data.criteria_consistently_applied,         # $5 - Q2 answer
        form_data.criteria_consistently_applied_comment, # $6 - Q2 comment
        form_data.full_range_of_marks_used,              # $7 - Q3 answer
        form_data.full_range_of_marks_used_comment,      # $8 - Q3 comment
        form_data.marks_awarded_fairly,                  # $9 - Q4 answer
        form_data.marks_awarded_fairly_comment,          # $10 - Q4 comment
        form_data.feedback_comments_appropriate,         # $11 - Q5 answer
        form_data.feedback_comments_appropriate_comment,  # $12 - Q5 comment
        form_data.all_marks_appropriate,                 # $13 - Q6 answer
        form_data.all_marks_appropriate_comment,         # $14 - Q6 comment
        form_data.recommendations,                       # $15 - additional recommendations
        form_data.feedback_suggestions,                  # $16 - feedback suggestions
    )
    return dict(row)


async def get_moderation_form_responses(
    db: asyncpg.Pool,
    assessment_id: UUID,
) -> list[dict[str, Any]]:
    """Get all form responses for an assessment's moderation case.
    Joins with users table to get the responder's name and role."""
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
    """Get the most recent form response for an assessment.
    Used to display the current moderation form state on the frontend."""
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
# (Completed by lecturer before submitting for moderation)
# ===============================

async def save_pre_moderation_checklist(
    db: asyncpg.Pool,
    assessment_id: UUID,                        # Which assessment
    user_id: UUID,                              # Who completed the checklist
    marking_in_accordance: bool,                # Marking done per rubric/criteria
    late_work_policy_adhered: bool,             # Late penalties applied correctly
    plagiarism_policy_adhered: bool,            # Plagiarism cases handled per policy
    marks_available_with_percentages: bool,      # All marks as percentages
    totalling_checked: bool,                    # Mark totals verified
    consistency_comments: Optional[str],         # Optional comments
) -> dict[str, Any]:
    """Save or update the pre-moderation checklist for an assessment.
    Uses UPSERT - only one checklist per assessment allowed (unique constraint)."""
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
    """Get the pre-moderation checklist for an assessment.
    Joins with users table to get the name of who completed it."""
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
# (Lecturer's response to moderator feedback)
# ===============================

async def save_module_leader_response(
    db: asyncpg.Pool,
    moderation_case_id: UUID,                   # Which moderation case
    user_id: UUID,                              # Who submitted the response
    moderator_comments_considered: bool,         # Whether comments were reviewed
    response_to_issues: Optional[str],           # Response to issues raised
    outliers_explanation: Optional[str],          # Explanation for outlier marks
    needs_third_marker: bool,                    # Whether third marker is needed
) -> dict[str, Any]:
    """Save or update the module leader's response to moderator feedback.
    Uses UPSERT - only one response per moderation case (unique constraint)."""
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
    """Get the module leader response for a specific moderation case."""
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
    """Get the module leader response for an assessment (via its moderation case).
    Convenience function that looks up the moderation case first."""
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
