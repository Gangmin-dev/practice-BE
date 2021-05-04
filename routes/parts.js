const express = require("express");
const router = express.Router();
const db = require("../lib/db");
const query = require("../lib/query_with_tracing");
const initTracer = require(".././lib/tracing").initTracer;
const { Tags, FORMAT_HTTP_HEADERS } = require("opentracing");

const tracer = initTracer("parts-api");

const fetchParts = (chapter, rootSpan) => {
  const span = tracer.startSpan("fetch-parts", { childOf: rootSpan.context() });

  return new Promise((resolve, reject) => {
    query(`SELECT id, title FROM part WHERE chapter_id = ?`, [chapter.id], span)
      .then((parts) => {
        span.log({
          event: "get-parts-success",
          value: parts,
        });
        chapter.parts = parts;
        span.finish();
        return resolve(parts);
      })
      .catch((e) => {
        logDatabaseError(e, span);
        return reject(e);
      });
    // db.query(
    //   `SELECT id, title FROM part WHERE chapter_id = ?`,
    //   [chapter.id],
    //   (err, parts) => {
    //     if (err) {
    //       console.log(err);
    //       return reject(err);
    //     }
    //     chapter.parts = parts;

    //     resolve(parts);
    //   }
    // );
  });
};

router.get("/", function (req, res, next) {
  const span = tracer.startSpan("use-promise");

  if (checkQueryString(req, span)) {
    return res.status(400).send("there is no course_id query data");
  }

  query(
    `SELECT id, number, title FROM chapter WHERE course_id = ?`,
    [req.query.course_id],
    span
  )
    .then((chapters) => {
      span.log({
        event: "get-chapters",
        value: chapters,
      });

      Promise.all(chapters.map((chapter) => fetchParts(chapter, span)))
        .then((v) => {
          span.log({
            event: "fetch-parts-success",
            value: chapters,
          });
          span.finish();
          res.status(200).json(chapters);
        })
        .catch((e) => {
          logDatabaseError(e, span);
          res.status(500).send(e);
        });
    })
    .catch((e) => {
      logDatabaseError(e, span);
      res.status(500).send(e);
    });
  // db.query(
  //   `SELECT id, number, title FROM chapter WHERE course_id = ?`,
  //   [req.query.course_id],
  //   (err, chapters) => {
  //     if (err) {
  //       console.log(err);
  //       next(err);
  //     }
  //     Promise.all(chapters.map((chapter) => fetchParts(chapter)))
  //       .then((v) => {
  //         console.log(chapters);
  //         res.status(200).json(chapters);
  //       })
  //       .catch(next);
  //   }
  // );
});

router.get("/twoQuery", function (req, res, next) {
  const span = tracer.startSpan("use-two-query");

  if (checkQueryString(req, span)) {
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

  if (checkQueryString(req, span)) {
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

function logDatabaseError(e, span) {
  span.setTag(Tags.ERROR, true);
  span.setTag(Tags.HTTP_STATUS_CODE, 500);
  span.log({
    event: "DB-query-error",
    "error.object": e,
  });
  span.finish();
}

function checkQueryString(req, span) {
  if (!req.query.course_id) {
    span.setTag(Tags.ERROR, true);
    span.setTag(Tags.HTTP_STATUS_CODE, 400);
    span.log({
      event: "ERROR: no-matching-queryString",
      queryString: req.query,
    });
    span.finish();

    return 1;
  }
  return 0;
}

module.exports = router;
