// auth.js
require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const verifyToken = require('./verifyToken');

const app = express();
const PORT = process.env.PORT || 443;
const HOST = '192.168.10.250';

// Middleware
app.use(cors());
app.use(bodyParser.json());

/* -----------------------------------------------------
   MAIN DB CONFIG (scsvmv_leave)
------------------------------------------------------ */
const dbConfig1 = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: "scsvmv_leave",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

/* -----------------------------------------------------
   SECOND DB CONFIG (scsvmv)
------------------------------------------------------ */
const dbConfig2 = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: "scsvmv",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

/* -----------------------------------------------------
   LOGIN API
------------------------------------------------------ */
app.post('/api/auth', async (req, res) => {
  const { UserID, Password } = req.body;

  if (!UserID || !Password) {
    return res.status(400).json({ error: 'Missing UserID or Password' });
  }

  try {
    await sql.connect(dbConfig1);

    const result = await sql.query`
      SELECT 
        e.EmpID, e.UserID, e.Name, e.FatherName, e.Gender, e.dob, e.doj,
        e.MobileNo, e.emailid, e.Status,
        e.Departmentno, d.DepartmentName, d.Deptaliasname,
        e.DesignationNo, des.Designation AS DesignationName
      FROM dbo.EmployeeDetails e
      LEFT JOIN dbo.Departments d ON e.Departmentno = d.Departmentno
      LEFT JOIN dbo.Designation des ON e.DesignationNo = des.DesignationNo
      WHERE e.UserID = ${UserID} AND e.Password = ${Password}
    `;

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid UserID or Password' });
    }

    const user = result.recordset[0];

    const payload = {
      iat: Date.now(),
      exp: Math.floor(Date.now() / 1000) + 3600,
      data: {
        EmpID: user.EmpID,
        Departmentno: user.Departmentno,
        Name: user.Name,
        UserID: user.UserID
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });

    res.json({
      message: 'Login successful',
      token,
      user
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
});

/* -----------------------------------------------------
   FACULTY WORKLOAD API (Multi-DB JOIN)
------------------------------------------------------ */
app.get('/api/facultyworkload', verifyToken, async (req, res) => {
  try {
    console.log("TOKEN USER:", req.user);

    const EmpId = req.query.EmpId || req.user.EmpID;
    const Dept = req.query.Dept || req.user.Departmentno;
    const Academicyear = req.query.Academicyear;
    const Odd_Even_sem = req.query.Odd_Even_sem;

    if (!EmpId || !Dept) {
      return res.status(400).json({
        error: "EmpId or DepartmentNo missing",
        tokenUser: req.user
      });
    }

    // Connect to DB1 (scsvmv_leave) - Get faculty details
    const pool1 = await sql.connect(dbConfig1);

    // Get faculty information using parameterized query
    const facultyInfoRequest = pool1.request();
    facultyInfoRequest.input('EmpId', sql.Int, EmpId);
    const facultyInfo = await facultyInfoRequest.query(`
      SELECT 
        e.EmpId,
        RTRIM(ISNULL(e.Prefix, '')) + ' ' + e.Name AS Name,
        e.Designation,
        d.Deptaliasname AS Department
      FROM scsvmv_leave.dbo.FeedbackSummarySubjectwiseFinal e
      LEFT JOIN scsvmv_leave.dbo.Departments d ON e.Departmentno = d.Departmentno
      WHERE e.EmpId = @EmpId
    `);

    // Try to use FacultyWorkloadView if it exists (matches original ASPX query)
    const workloadRequest = pool1.request();
    workloadRequest.input('EmpId', sql.Int, EmpId);
    
    let workloadQuery = `
      SELECT 
        EmpID, 
        RTRIM(Prefix) + Name AS Name,
        coursenameforTc, 
        Designation, 
        Mode, 
        Deptaliasname, 
        SUM(CASE WHEN Subject_type = 'Theory' THEN Noof_PeriodAssigned ELSE 0 END) AS Theory, 
        SUM(CASE WHEN Subject_type = 'Lab' THEN Noof_PeriodAssigned ELSE 0 END) AS Lab, 
        SUM(CASE WHEN Subject_type = 'Theory' THEN Noof_PeriodAssigned ELSE 0 END) + SUM(CASE WHEN Subject_type = 'Lab' THEN Noof_PeriodAssigned ELSE 0 END) AS TotalPeriods, 
        Academicyear, 
        Odd_Even_sem, 
        SubjectCode, 
        Subject_Name, 
        Semester, 
        NoofStudentsAssigned,
        AssignedDept 
      FROM scsvmv_leave.dbo.FacultyWorkloadView 
      WHERE EmpId = @EmpId
    `;

    if (Academicyear) {
      workloadQuery += ` AND Academicyear = @Academicyear`;
      workloadRequest.input('Academicyear', sql.VarChar, Academicyear);
    }
    if (Odd_Even_sem) {
      workloadQuery += ` AND Odd_Even_sem = @Odd_Even_sem`;
      workloadRequest.input('Odd_Even_sem', sql.VarChar, Odd_Even_sem);
    }

    workloadQuery += ` GROUP BY EmpID, Name, Deptaliasname, EmpDeptno, DesignationOrderno, Designation, dateofpromotion, Academicyear, Odd_Even_sem, coursenameforTc, Mode, Prefix, SubjectCode, Subject_Name, Semester, NoofStudentsAssigned, AssignedDept ORDER BY Semester, Subject_Name`;

    let workloadResult;
    try {
      workloadResult = await workloadRequest.query(workloadQuery);
    } catch (viewError) {
      // Fallback to original method if view doesn't exist
      console.log("FacultyWorkloadView not found, using fallback method");
      
      const workloadLeaveRequest = pool1.request();
      workloadLeaveRequest.input('EmpId', sql.Int, EmpId);
      workloadLeaveRequest.input('Dept', sql.VarChar, Dept);
      const workloadLeave = await workloadLeaveRequest.query(`
        SELECT 
          fw.SubjectId,
          fw.NoofStudentsAssigned,
          fw.Noof_PeriodAssigned,
          fw.EmpId,
          fw.DepartmentNo
        FROM scsvmv_leave.dbo.FacultyWorload fw
        WHERE fw.EmpId = @EmpId
        AND fw.DepartmentNo = @Dept
      `);

      if (workloadLeave.recordset.length === 0) {
        return res.json({
          facultyInfo: facultyInfo.recordset[0] || null,
          message: "No workload found for this faculty.",
          data: []
        });
      }

      const subjectIds = workloadLeave.recordset.map(r => {
        const id = parseInt(r.SubjectId);
        return isNaN(id) ? null : id;
      }).filter(id => id !== null);

      if (subjectIds.length === 0) {
        return res.json({
          facultyInfo: facultyInfo.recordset[0] || null,
          message: "No valid subject IDs found.",
          data: []
        });
      }

      const pool2 = await sql.connect(dbConfig2);
      const subjectRequest = pool2.request();
      
      // Build parameterized query for IN clause
      const placeholders = subjectIds.map((id, idx) => {
        const paramName = `SubjectId${idx}`;
        subjectRequest.input(paramName, sql.Int, id);
        return `@${paramName}`;
      }).join(',');
      
      let subjectQuery = `
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
        WHERE Id IN (${placeholders})
      `;

      if (Academicyear) {
        subjectQuery += ` AND Academicyear = @Academicyear`;
        subjectRequest.input('Academicyear', sql.VarChar, Academicyear);
      }

      const subjectDetails = await subjectRequest.query(subjectQuery);

      const finalResult = workloadLeave.recordset.map(fw => {
        const sub = subjectDetails.recordset.find(s => s.SubjectId === fw.SubjectId);
        if (!sub) return null;
        
        // Filter by semester if Odd_Even_sem is provided
        if (Odd_Even_sem) {
          const semNum = parseInt(sub.Semester) || 0;
          const isEven = semNum % 2 === 0;
          if ((Odd_Even_sem === 'EVEN' && !isEven) || (Odd_Even_sem === 'ODD' && isEven)) {
            return null;
          }
        }

        return {
          Course: sub.CourseCode || "",
          Dept: Dept,
          Mode: "REGULAR",
          SubjectCode: sub.SubjectCode || "",
          Subject_Name: sub.Subject_Name || "",
          Semester: sub.Semester || "",
          NoofStudents: fw.NoofStudentsAssigned,
          Theory: sub.Noof_PeriodPerWeek || 0,
          Lab: 0,
          Academicyear: sub.Academicyear || "",
          NoofPeriods: fw.Noof_PeriodAssigned
        };
      }).filter(item => item !== null);

      return res.json({
        facultyInfo: facultyInfo.recordset[0] || null,
        EmpId,
        DepartmentNo: Dept,
        count: finalResult.length,
        data: finalResult
      });
    }

    // Process results from FacultyWorkloadView
    const finalResult = workloadResult.recordset.map(row => ({
      Course: row.coursenameforTc || "",
      Dept: row.AssignedDept || "",
      Mode: row.Mode || "REGULAR",
      SubjectCode: row.SubjectCode || "",
      Subject_Name: row.Subject_Name || "",
      Semester: row.Semester || "",
      NoofStudents: row.NoofStudentsAssigned || 0,
      Theory: row.Theory || 0,
      Lab: row.Lab || 0,
      Academicyear: row.Academicyear || "",
      NoofPeriods: row.TotalPeriods || 0
    }));

    res.json({
      facultyInfo: facultyInfo.recordset[0] || null,
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


/* -----------------------------------------------------
   ADMIN LOGIN API
------------------------------------------------------ */
app.post('/api/admin-login', async (req, res) => {
  const { UserId, password, UserType } = req.body;

  if (!UserId || !password || !UserType) {
    return res.status(400).json({ error: 'Missing credentials or role' });
  }

  try {
    await sql.connect(dbConfig1);

    const result = await sql.query`
      SELECT 
        a.UserId,
        a.DeptId,
        a.UserType,
        a.Deptmailid,
        d.DepartmentName,
        d.Deptaliasname
      FROM dbo.adminlogin a
      LEFT JOIN dbo.Departments d ON a.DeptId = d.Departmentno
      WHERE a.UserId = ${UserId}
      AND a.password = ${password}
      AND a.UserType = ${UserType}
    `;

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials or role mismatch' });
    }

    const admin = result.recordset[0];

    const payload = {
      iat: Date.now(),
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: admin.UserType,
      data: admin
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });

    res.json({
      message: 'Login successful',
      token,
      admin
    });

  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* -----------------------------------------------------
   ADMITTED STUDENTS API
   Replicates functionality of DownloadStudentDatastaffmenu.aspx
------------------------------------------------------ */
app.get('/api/admitted-students', verifyToken, async (req, res) => {
    // Extract query parameters from either query string or JSON body
    // In the ASPX page, these come from DropDownLists
    let { academicyearnow, CourseNameforTC, sem_now } = req.query;

    // Fallback to body if not in query (supports sending JSON body in GET/POST)
    if (!academicyearnow || !CourseNameforTC || !sem_now) {
        const body = req.body || {};
        if (!academicyearnow) academicyearnow = body.academicyearnow;
        if (!CourseNameforTC) CourseNameforTC = body.CourseNameforTC;
        if (!sem_now) sem_now = body.sem_now;
    }

    console.log('Received params:', { academicyearnow, CourseNameforTC, sem_now });

    // Validation: Require at least ONE parameter to avoid fetching the whole DB
    if (!academicyearnow && !CourseNameforTC && !sem_now) {
        return res.status(400).json({
            error: 'Please provide at least one parameter: academicyearnow, CourseNameforTC, or sem_now'
        });
    }

    try {
        // Connect to database
        const pool = await sql.connect(dbConfig2);

        // Dynamic Query Construction
        let query = `
            SELECT TOP (1000) -- Limiting results for safety during flexible search
                enrollmentno, section, course, XiithSchoolname, branch, Mode,
                CourseNameforTC, ug_pg, academicyearnow, sem_now,
                registrationno, name, fathername, occupation, annualincome,
                gender, dateofbirth, bloodgroup, nationality, mothertongue,
                religion, community, subcaste, addresspostal, addresspresent,
                state, extraactivities, spealization,
                XthPercentage, XthYearofPassing,
                XIIthPercentage, XIIthYearofPassing,
                DiplomaPercent, DiplomaYearofPassing,
                I_BE_GPA, II_SEM_GPA, III_BE_GPA, IV_BE_GPA,
                V_BE_GPA, VI_BE_GPA, VII_BE_GPA, CGPA_BE_Till,
                Arrears, Gap_in_Year, soft_Skill,
                MobileNo, MobileNo_permanent, emailid,
                xthboard, xiithboard,
                ug_percent, ug_university, ug_year,
                no_arrears_in_allyear,
                mothername, motheroccupation,
                noofstandingarrears, Xiithstream,
                XthSchoolname, admissionno,
                ug_course, ug_college, combin_reg_late
            FROM [scsvmv].[dbo].[admittedStudents]
            WHERE 1=1
        `;

        const request = pool.request();

        if (academicyearnow) {
            query += ` AND academicyearnow = @academicyearnow`;
            request.input('academicyearnow', sql.VarChar, academicyearnow);
        }

        if (CourseNameforTC) {
            query += ` AND CourseNameforTC = @CourseNameforTC`;
            request.input('CourseNameforTC', sql.VarChar, CourseNameforTC);
        }

        if (sem_now) {
            query += ` AND sem_now = @sem_now`;
            request.input('sem_now', sql.VarChar, sem_now);
        }

        query += ` ORDER BY CourseNameforTC, registrationno`;

        // Execute query
        const result = await request.query(query);

        // SUGGESTION LOGIC: If no results, help the user find valid data
        let suggestions = null;
        if (result.recordset.length === 0 && academicyearnow) {
            try {
                const suggestionQuery = `
                    SELECT DISTINCT TOP 100 sem_now, CourseNameforTC 
                    FROM [scsvmv].[dbo].[admittedStudents] 
                    WHERE academicyearnow = @academicyearnow
                    ORDER BY CourseNameforTC
                `;
                // Create a new request for the suggestion query
                // We must use a new request object to avoid parameter conflicts if we reused 'request'
                const suggestReq = pool.request();
                suggestReq.input('academicyearnow', sql.VarChar, academicyearnow);

                const subResult = await suggestReq.query(suggestionQuery);

                if (subResult.recordset.length > 0) {
                    suggestions = {
                        message: `No exact match found for your criteria. But for year '${academicyearnow}', we found these valid records:`,
                        availableRecords: subResult.recordset
                    };
                } else {
                    suggestions = {
                        message: `No records found even for the year '${academicyearnow}'. Try a different year.`
                    };
                }
            } catch (suggestErr) {
                console.error('Suggestion query failed:', suggestErr);
            }
        }

        // Return results
        res.json({
            count: result.recordset.length,
            generatedQuery: query.replace(/\s+/g, ' ').trim(), // Help user see what ran
            params: { academicyearnow, CourseNameforTC, sem_now },
            suggestions: suggestions,
            data: result.recordset
        });

    } catch (err) {
        console.error('ADMITTED STUDENTS API ERROR:', err);

        // Diagnostic query to help user debug
        let currentDB = 'Unknown';
        try {
            const pool = await sql.connect(dbConfig2);
            const dbResult = await pool.request().query('SELECT DB_NAME() AS CurrentDB');
            currentDB = dbResult.recordset[0].CurrentDB;
        } catch (e) { currentDB = 'Connection Failed'; }

        res.status(500).json({
            error: 'Internal server error',
            details: err.message,
            diagnostic: `Connected to database: '${currentDB}'. Expected table '[scsvmv].[dbo].[admittedStudents]' to exist.`
        });
    }
});

/* -----------------------------------------------------
   FORGOT USERNAME/PASSWORD API
   Retrieves the UserID (username), password, and email address for the given UserID.
------------------------------------------------------ */
app.post('/api/forgot-username-password', async (req, res) => {
  const { UserID } = req.body;

  // Validate UserID is provided
  if (!UserID) {
    return res.status(400).json({ error: 'Missing UserID' });
  }

  try {
    await sql.connect(dbConfig1);

    // Query to fetch UserID, Password, and email for the given UserID
    const result = await sql.query`
      SELECT e.UserID, e.Password, e.emailid
      FROM dbo.EmployeeDetails e
      WHERE e.UserID = ${UserID}
    `;

    // Check if a matching record is found
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'UserID not found' });
    }

    const user = result.recordset[0];

    // Return the UserID, Password, and Email address associated with the UserID
    res.json({
      message: 'User information retrieved successfully',
      userID: user.UserID,
      password: user.Password,
      email: user.emailid
    });

  } catch (err) {
    console.error('Error retrieving user information:', err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
});



/* -----------------------------------------------------
   FILTER OPTIONS API (Dropdowns)
   Replicates SqlDataSource2 (Academic Year) and SqlDataSource3 (Course Name)
------------------------------------------------------ */
app.get('/api/filter-options', verifyToken, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig2);

        // 1. Fetch Academic Years
        const academicYearsResult = await pool.request().query(`
            SELECT DISTINCT TOP (100) PERCENT academicyearnow 
            FROM [scsvmv].[dbo].[admissiondetails] 
            ORDER BY academicyearnow DESC
        `);

        // 2. Fetch Course Names
        // User requested to "show all" courses.
        // We will default to showing all, but support optional filtering by 'departmentid' if provided.
        let coursesQuery = `SELECT DISTINCT [CourseNameforTC] FROM [scsvmv].[dbo].[CourseDetails]`;
        const coursesRequest = pool.request();

        if (req.query.departmentid) {
            coursesQuery += ` WHERE [departmentid] = @departmentid`;
            coursesRequest.input('departmentid', sql.Int, req.query.departmentid);
        }

        coursesQuery += ` ORDER BY [CourseNameforTC]`;

        const coursesResult = await coursesRequest.query(coursesQuery);

        // 3. Hardcoded Semesters & Modes (from existing ASPX)
        const semesters = ['VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I', 'PASSEDOUT'];
        const modes = ['REGULAR', 'LATERAL ENTRY', 'PART TIME'];

        res.json({
            academicYears: academicYearsResult.recordset.map(r => r.academicyearnow),
            courses: coursesResult.recordset.map(r => r.CourseNameforTC),
            semesters: semesters,
            modes: modes
        });

    } catch (err) {
        console.error('FILTER OPTIONS API ERROR:', err);
        res.status(500).json({
            error: 'Internal server error',
            details: err.message
        });
    }
});

/* -----------------------------------------------------
   START SERVER
------------------------------------------------------ */
app.listen(PORT, HOST, () => {
  console.log(`API running at http://${HOST}:${PORT}`);
});
