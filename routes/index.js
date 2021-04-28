const express = require("express");
const router = express.Router();
const db = require("./../module/db");

/* GET home page. */
router.get("/", function (req, res, next) {
  db.query(`SELECT * FROM subject`, (err, subjects) => {
    if (err) {
      console.log(err);
      next(err);
    }
    res.status(200).json(subjects);
  });
});

module.exports = router;
