# Backend API: GET /api/facultyworkload (Corrected)

Apply this on your backend server (14.139.187.54). The main fix: **define `Dept`** – it was missing and caused "Dept is not defined".

## Corrected Server-Side Code

```javascript
app.get('/api/facultyworkload', verifyToken, async (req, res) => {
  try {
    console.log("TOKEN USER:", req.user);

    const EmpId = req.query.EmpId || req.user?.EmpID;
    const Dept = req.query.DepartmentNo || req.query.Dept || req.user?.Departmentno || req.user?.Deptaliasname || "";

    if (!EmpId || !Dept) {
      return res.status(400).json({
        error: "EmpId or DepartmentNo missing",
        tokenUser: req.user
      });
    }

    const pool1 = await sql.connect(dbConfig1);

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

    // Group by SubjectId: separate Theory and Lab (Practical)
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

    const finalResult = Object.entries(workloadBySubject).map(([subjectId, wl]) => {
      const sub = subjectDetails.recordset.find(s => s.SubjectId == subjectId);
      const theoryPeriods = wl.theory;
      const labPeriods = wl.lab;

      return {
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

## Fixes applied
1. **Dept definition added** – `const Dept = req.query.DepartmentNo || req.query.Dept || ...` (was missing).
2. **Theory and Lab** – Uses `Subject_type` to split Theory vs Lab from `FacultyWorload`.
3. **Typo** – `Academicyear :sub` → `Academicyear: sub`.
4. **Subject_type** – Included in SELECT if your table has it. If `FacultyWorload` has no `Subject_type` column, use this simpler merge instead:

```javascript
// Simpler merge (if no Subject_type)
const finalResult = workloadLeave.recordset.map(fw => {
  const sub = subjectDetails.recordset.find(s => s.SubjectId === fw.SubjectId);
  return {
    Course: sub?.CourseCode || "",
    Dept: Dept,
    Mode: "REGULAR",
    SubjectCode: sub?.SubjectCode || "",
    Subject_Name: sub?.Subject_Name || "",
    Semester: sub?.Semester || "",
    NoofStudents: fw.NoofStudentsAssigned,
    Theory: sub?.Noof_PeriodPerWeek || 0,
    Lab: 0,
    Academicyear: sub?.Academicyear || "",
    NoofPeriods: fw.Noof_PeriodAssigned
  };
});
```

And remove `Subject_type` from the SELECT and the grouping logic.
