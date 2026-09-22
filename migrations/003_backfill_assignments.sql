-- migrations/003_backfill_assignments.sql
-- Backfill active assignments for any assets that have a holder (staff or external customer)
-- but do not currently have an active assignment record.

INSERT INTO Assignments (id, assetId, employeeId, departmentId, holderName, dateOut, dateReturn, note)
SELECT 
    'asg_' || lower(hex(randomblob(6))),
    a.id,
    a.holderId,
    a.departmentId,
    CASE WHEN (a.holderId IS NULL OR a.holderId = '') THEN a.holderName ELSE NULL END,
    COALESCE(NULLIF(a.purchaseDate, ''), '2026-09-01'),
    NULL,
    CASE WHEN a.status = 'borrowed' THEN 'ยืมใช้งาน' ELSE 'เบิกใช้งาน' END
FROM Assets a
WHERE ((a.holderId IS NOT NULL AND a.holderId != '') OR (a.holderName IS NOT NULL AND a.holderName != ''))
  AND NOT EXISTS (
    SELECT 1 FROM Assignments asg 
    WHERE asg.assetId = a.id AND (asg.dateReturn IS NULL OR asg.dateReturn = '')
  );
