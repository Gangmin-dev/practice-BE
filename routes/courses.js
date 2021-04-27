const express = require("express");
const router = express.Router();
const db = require("./../module/db");

/* GET users listing. */
router.get("/", function (req, res, next) {
  db.query(
    `SELECT * FROM course WHERE subject_id = ?`,
    [req.query.subject_id],
    (err, courses) => {
      if (err) next(err);
      console.log(req.query.subject_id);
      res.status(200).json(courses);
    }
  );
});

module.exports = router;
