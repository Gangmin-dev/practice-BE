const express = require("express");
const router = express.Router();
const db = require("../module/db");

const fetchParts = (chapter) =>
  new Promise((resolve, reject) => {
    db.query(
      `SELECT id, title FROM part WHERE chapter_id = ?`,
      [chapter.id],
      (err, parts) => {
        if (err) {
          console.log(err);
          return reject(err);
        }
        chapter.parts = parts;

        resolve(parts);
      }
    );
  });

router.get("/", function (req, res, next) {
  if (!req.query) {
    res.status(400).send("there is no queryString");
  }
  db.query(
    `SELECT id, number, title FROM chapter WHERE course_id = ?`,
    [req.query.course_id],
    (err, chapters) => {
      if (err) {
        console.log(err);
        next(err);
      }
      Promise.all(chapters.map((chapter) => fetchParts(chapter))).then((v) => {
        console.log(chapters);
        res.status(200).json(chapters);
      });
    }
  );
});

module.exports = router;
