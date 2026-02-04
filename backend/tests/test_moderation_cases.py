import asyncio
import asyncpg
from app.lib.config import settings

async def test():
    db = await asyncpg.create_pool(settings.DATABASE_URL)
    
    # Check moderation cases
    result = await db.fetch("""
        SELECT id, assessment_id, lecturer_comment, submitted_at, status, created_by
        FROM moderation_cases 
        ORDER BY created_at DESC 
        LIMIT 5
    """)
    
    print("=== Recent moderation cases ===")
    for r in result:
        print(f"  {dict(r)}")
    
    # Check assessments with IN_MODERATION status
    result2 = await db.fetch("""
        SELECT a.id, a.title, a.module_code, a.status, ss.size as sample_size, ss.method as sample_method
        FROM assessments a
        LEFT JOIN sample_sets ss ON a.id = ss.assessment_id
        WHERE a.status = 'IN_MODERATION'
        ORDER BY a.created_at DESC 
        LIMIT 5
    """)
    
    print("\n=== Assessments IN_MODERATION ===")
    for r in result2:
        print(f"  {dict(r)}")
    
    # Check sample items for these assessments
    if result2:
        assessment_id = result2[0]['id']
        
        # Test the get_moderation_case_by_assessment query
        result_case = await db.fetchrow("""
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
        """, assessment_id)
        
        print(f"\n=== Moderation case details for assessment {assessment_id} ===")
        if result_case:
            print(f"  {dict(result_case)}")
        else:
            print("  No moderation case found")
        
        result3 = await db.fetch("""
            SELECT si.id, si.student_id, si.original_mark, si.marker_id
            FROM sample_items si
            JOIN sample_sets ss ON si.sample_set_id = ss.id
            WHERE ss.assessment_id = $1
            ORDER BY si.original_mark DESC
            LIMIT 5
        """, assessment_id)
        
        print(f"\n=== Sample items for assessment {assessment_id} ===")
        for r in result3:
            print(f"  {dict(r)}")
    
    await db.close()

asyncio.run(test())
