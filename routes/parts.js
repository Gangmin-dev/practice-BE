const express = require("express");
const router = express.Router();
const db = require("../lib/db");
const initTracer = require("../../lib/tracing").initTracer;
const { Tags, FORMAT_HTTP_HEADERS } = require("opentracing");

const tracer = initTracer("parts-api");

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
  const span = tracer.startSpan("use-promise");
  if (!req.query.course_id) {
    span.setTag(Tags.ERROR, true);
    span.setTag(Tags.HTTP_STATUS_CODE, 400);
    span.finish();
    res.status(400).send("there is no course_id query data");
  }
  db.query(
    `SELECT id, number, title FROM chapter WHERE course_id = ?`,
    [req.query.course_id],
    (err, chapters) => {
      if (err) {
        console.log(err);
        next(err);
      }
      Promise.all(chapters.map((chapter) => fetchParts(chapter)))
        .then((v) => {
          console.log(chapters);
          res.status(200).json(chapters);
        })
        .catch(next);
    }
  );
});

router.get("/twoQuery", function (req, res, next) {
  const span = tracer.startSpan("use-two-query");
  if (!req.query.course_id) {
    span.setTag(Tags.ERROR, true);
    span.setTag(Tags.HTTP_STATUS_CODE, 400);
    span.finish();
    res.status(400).send("there is no course_id query data");
  }
  db.query(
    `SELECT id, number, title FROM chapter WHERE course_id = ?`,
    [req.query.course_id],
    (err, chapters) => {
      if (err) {
        console.log(err);
        next(err);
      }
      db.query(
        `SELECT id, title, chapter_id FROM part WHERE chapter_id in (SELECT id FROM chapter WHERE course_id = ?)`,
        [req.query.course_id],
        (err, parts) => {
          if (err) {
            console.log(err);
            next(err);
          }
          console.log(parts);
          chapters.forEach((chapter) => {
            chapter.parts = [];
            parts.forEach((part) => {
              if (part.chapter_id === chapter.id)
                chapter.parts.push({ id: part.id, title: part.title });
            });
          });
          res.status(200).json(chapters);
        }
      );
    }
  );
});

router.get("/oneQuery", function (req, res, next) {
  const span = tracer.startSpan("use-one-query");
  if (!req.query.course_id) {
    span.setTag(Tags.ERROR, true);
    span.setTag(Tags.HTTP_STATUS_CODE, 400);
    span.finish();
    res.status(400).send("there is no course_id query data");
  }
  db.query(
    `SELECT chapter.id, chapter.number, chapter.title, part.id as partId, part.title as partTitle FROM chapter
    LEFT JOIN part ON part.chapter_id = chapter.id
    WHERE chapter.course_id = ?
    ORDER BY chapter.number`,
    [req.query.course_id],
    (err, chaptersWithParts) => {
      if (err) {
        console.log(err);
        next(err);
      }
      let chapters = [];
      let lastIndex = -1;
      let currentChapterIndex;
      for (let i = 0; i < chaptersWithParts.length; i++) {
        if (
          i === 0 ||
          chaptersWithParts[lastIndex].id != chaptersWithParts[i].id
        ) {
          currentChapterIndex =
            chapters.push({
              id: chaptersWithParts[i].id,
              number: chaptersWithParts[i].number,
              title: chaptersWithParts[i].title,
              parts: [],
            }) - 1;
        }
        chapters[currentChapterIndex].parts.push({
          id: chaptersWithParts[i].partId,
          title: chaptersWithParts[i].partTitle,
        });
        lastIndex = i;
      }
      res.status(200).json(chapters);
    }
  );
});

module.exports = router;
