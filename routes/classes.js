const express = require("express");
const router = express.Router();
const db = require("./../module/db");

router.get("/", function (req, res, next) {
  if (!req.query) {
    res.status(400).send("there is no queryString");
  }
  if (!req.query.student_id) {
    res.status(400).send("there is no student_id query data");
  }
  db.query(
    `SELECT class.id, teacher.name, subject.title FROM class
    LEFT JOIN teacher ON class.teacher_id = teacher.id
    LEFT JOIN subject ON class.subject_id = subject.id
    WHERE class.id in (SELECT class_id FROM class_has_student WHERE student_id = ?)
    `,
    [req.query.student_id],
    (err, classes) => {
      if (err) {
        console.log(err);
        next(err);
      }
      console.log(req.query.student_id);
      res.status(200).json(classes);
    }
  );
});

module.exports = router;
