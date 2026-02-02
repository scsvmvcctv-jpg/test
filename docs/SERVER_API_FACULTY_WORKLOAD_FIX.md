# Server-Side API Fix: GET /api/facultyworkload

Apply this fix on your backend server (14.139.187.54) so the workload page correctly shows **Theory** and **Lab Work Hours**.

## Problem
- `Lab` is hardcoded to `0` in the GET response
- `FacultyWorload` has separate rows for Theory and Lab (`Subject_type = 'Theory'` or `'Lab'`)
- Each row has `Noof_PeriodAssigned` – use it for Theory and Lab respectively

## Corrected GET Handler

Replace your existing `app.get('/api/facultyworkload', ...)` with:

```javascript
app.get('/api/facultyworkload', verifyToken, async (req, res) => {
  try {
    console.log("TOKEN USER:", req.user);

    const EmpId = req.query.EmpId || req.user.EmpID;
    const Dept = req.query.DepartmentNo || req.query.Dept || req.user?.Departmentno || req.user?.Deptaliasname || "";

    if (!EmpId || !Dept) {
      return res.status(400).json({
        error: "EmpId or DepartmentNo missing",
        tokenUser: req.user
      });
    }

    const pool1 = await sql.connect(dbConfig1);

    // 1. Get faculty workload from scsvmv_leave (includes both Theory and Lab rows)
    const workloadLeave = await pool1.request().query(`
      SELECT 
        fw.SubjectId,
        fw.Subject_type,
        fw.NoofStudentsAssigned,
        fw.Noof_PeriodAssigned,
        fw.EmpId,
        fw.DepartmentNo
      FROM scsvmv_leave.dbo.FacultyWorload fw
      WHERE fw.EmpId = '${EmpId}'
    `);

    if (workloadLeave.recordset.length === 0) {
      return res.json({
        message: "No workload found for this faculty.",
        data: []
      });
    }

    const subjectIds = [...new Set(workloadLeave.recordset.map(r => r.SubjectId))].join(",");

    const pool2 = await sql.connect(dbConfig2);

    const subjectDetails = await pool2.request().query(`
      SELECT 
        Id AS SubjectId,
        CourseCode,
        SubjectCode,
        Subject_Name,
        Semester,
        Academicyear,
        TotalNoofStudents,
        Noof_PeriodPerWeek
      FROM scsvmv.dbo.SubjectTable
      WHERE Id IN (${subjectIds})
    `);

    // Group workload by SubjectId: separate Theory and Lab periods
    const workloadBySubject = {};
    for (const fw of workloadLeave.recordset) {
      const key = fw.SubjectId;
      if (!workloadBySubject[key]) {
        workloadBySubject[key] = { theory: 0, lab: 0, noofStudents: fw.NoofStudentsAssigned };
      }
      const type = (fw.Subject_type || "").toUpperCase();
      const periods = fw.Noof_PeriodAssigned || 0;
      if (type === "LAB") {
        workloadBySubject[key].lab = periods;
      } else {
        workloadBySubject[key].theory = periods;
      }
      workloadBySubject[key].noofStudents = fw.NoofStudentsAssigned || workloadBySubject[key].noofStudents;
    }

    // 3. Build final result (one row per subject)
    const finalResult = Object.entries(workloadBySubject).map(([subjectId, wl]) => {
      const sub = subjectDetails.recordset.find(s => s.SubjectId == subjectId);
      const theoryPeriods = wl.theory;
      const labPeriods = wl.lab;

      return {
        SubjectId: parseInt(subjectId),
        Course: sub?.CourseCode || "",
        Dept: Dept,
        Mode: "REGULAR",
        SubjectCode: sub?.SubjectCode || "",
        Subject_Name: sub?.Subject_Name || "",
        Semester: sub?.Semester || "",
        NoofStudents: wl.noofStudents,
        Theory: theoryPeriods,
        Lab: labPeriods,
        Academicyear: sub?.Academicyear || "",
        NoofPeriods: theoryPeriods + labPeriods
      };
    });

    res.json({
      EmpId,
      DepartmentNo: Dept,
      count: finalResult.length,
      data: finalResult
    });

  } catch (err) {
    console.error("WORKLOAD ERROR:", err);
    res.status(500).json({
      error: "Internal server error",
      details: err.message
    });
  }
});
```

## Changes Summary

| Item | Before | After |
|------|--------|-------|
| Query param | `DepartmentNo` only | `DepartmentNo` or `Dept` |
| `Subject_type` | Not used | Used to separate Theory vs Lab |
| `Theory` | From SubjectTable.Noof_PeriodPerWeek | From FacultyWorload where Subject_type='Theory' |
| `Lab` | Hardcoded `0` | From FacultyWorload where Subject_type='Lab' |
| `NoofPeriods` | From single row | Theory + Lab |
| Rows per subject | Could duplicate if Theory+Lab exist | One row per subject, merged |

## Frontend (workload page) expects

- `Theory` – number
- `Lab` (or `LabWorkHours`) – number  
- `NoofPeriods` – number
- `NoofStudents`, `SubjectCode`, `Subject_Name`, `Semester`, `Academicyear`, `Course`, `Dept`, `Mode`

Our page already supports these fields and displays them correctly.
