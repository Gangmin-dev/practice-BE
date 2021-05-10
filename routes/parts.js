const express = require("express");
const router = express.Router();
const query = require("../lib/query_with_tracing");
const initTracer = require(".././lib/tracing").initTracer;
const { Tags } = require("opentracing");
const pool = require("../lib/db");

const tracer = initTracer("parts-api");

const fetchParts = (chapter, rootSpan) => {
  const span = tracer.startSpan("fetch-parts", { childOf: rootSpan.context() });

  return new Promise((resolve, reject) => {
    query(`SELECT id, title FROM part WHERE chapter_id = ?`, [chapter.id], span)
      .then((parts) => {
        span.log({
          event: "get-parts-success",
          // value: parts,
        });
        chapter.parts = parts;
        span.finish();
        return resolve(parts);
      })
      .catch((e) => {
        logDatabaseError(e, span);
        return reject(e);
      });
  });
};

router.get("/", async function (req, res, next) {
  await insertDummyData(req);

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
        event: "get-chapters-success",
        // value: chapters,
      });

      Promise.all(chapters.map((chapter) => fetchParts(chapter, span)))
        .then((v) => {
          span.log({
            event: "fetch-parts-success",
            // value: chapters,
          });
          span.finish();

          deleteDummyData();

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
});

router.get("/twoQuery", async function (req, res, next) {
  await insertDummyData(req);

  const span = tracer.startSpan("use-two-query");

  if (checkQueryString(req, span)) {
    return res.status(400).send("there is no course_id query data");
  }

  query(
    `SELECT id, number, title FROM chapter WHERE course_id = ? ORDER BY id`,
    [req.query.course_id],
    span
  )
    .then((chapters) => {
      span.log({
        event: "get-chapters-success",
        // value: chapters,
      });

      const fetchPartsSpan = tracer.startSpan("fetch-parts", {
        childOf: span.context(),
      });

      query(
        `SELECT id, title, chapter_id FROM part WHERE chapter_id in (SELECT id FROM chapter WHERE course_id = ?) ORDER BY chapter_id`,
        [req.query.course_id],
        fetchPartsSpan
      )
        .then((parts) => {
          fetchPartsSpan.log({
            event: "fetch-parts-success",
            // value: parts,
          });

          let currentChapterIndex = 0;
          chapters[0].part = [];

          for (let i = 0; i < parts.length; i++) {
            if (chapters[currentChapterIndex].id != parts[i].chapter_id) {
              chapters[++currentChapterIndex].part = [];
            }
            chapters[currentChapterIndex].part.push({
              id: parts[i].id,
              title: parts[i].title,
            });
          }

          fetchPartsSpan.log({
            event: "attach-parts-success",
          });
          // chapters.forEach((chapter) => {
          //   chapter.parts = [];
          //   parts.forEach((part) => {
          //     if (part.chapter_id === chapter.id)
          //       chapter.parts.push({ id: part.id, title: part.title });
          //   });

          //   fetchPartsSpan.log({
          //     event: `attach-parts-to-chapter`,
          //     value: chapter,
          //   });
          // });
          fetchPartsSpan.finish();
          span.finish();

          deleteDummyData();

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
});

router.get("/oneQuery", async function (req, res, next) {
  await insertDummyData(req);

  const span = tracer.startSpan("use-one-query");

  if (checkQueryString(req, span)) {
    return res.status(400).send("there is no course_id query data");
  }

  query(
    `SELECT chapter.id, chapter.number, chapter.title, part.id as partId, part.title as partTitle FROM chapter
    LEFT JOIN part ON part.chapter_id = chapter.id
    WHERE chapter.course_id = ?
    ORDER BY chapter.id`,
    [req.query.course_id],
    span
  )
    .then((chaptersWithParts) => {
      span.log({
        event: "get-cahpters-with-parts-success",
        // value: chaptersWithParts,
      });

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
          // span.log({
          //   event: "change-chapter-id",
          //   value: chaptersWithParts[i].id,
          // });
        }
        chapters[currentChapterIndex].parts.push({
          id: chaptersWithParts[i].partId,
          title: chaptersWithParts[i].partTitle,
        });
        lastIndex = i;
      }

      span.log({
        event: "match-chapters-with-parts-success",
        // value: chapters,
      });
      span.finish();
      deleteDummyData();
      res.status(200).json(chapters);
    })
    .catch((e) => {
      logDatabaseError(e, span);
      res.status(500).send(e);
    });
});

function logDatabaseError(e, span) {
  span.setTag(Tags.ERROR, true);
  span.setTag(Tags.HTTP_STATUS_CODE, 500);
  span.log({
    event: "DB-query-error",
    "error.object": e,
  });
  span.finish();
  deleteDummyData();
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
    deleteDummyData();
    return 1;
  }
  return 0;
}

async function insertDummyData(req) {
  nInsertChapter = parseInt(req.query.insert_chapter_num);
  nInsertPart = parseInt(req.query.insert_part_num);
  courseId = req.query.course_id;

  if (nInsertChapter && nInsertPart && courseId) {
    let chapterValues = [];

    for (let i = 0; i < nInsertChapter; i++) {
      chapterValues.push([courseId, "dummyData", i]);
    }

    await pool
      .query(`INSERT INTO chapter (course_id, title, number) VALUES ?`, [
        chapterValues,
      ])
      .then(async (insertInfo) => {
        firstId = insertInfo[0].insertId;
        console.log(insertInfo.insertId);
        let partValues = [];

        for (let i = firstId; i < firstId + nInsertChapter; i++) {
          for (let k = 0; k < nInsertPart; k++) {
            partValues.push(["dummyPart", i]);
          }
        }

        await pool
          .query(`INSERT INTO part (title, chapter_id) VALUES ?`, [partValues])
          .then()
          .catch((e) => console.log);
      });
  }
}

function deleteDummyData() {
  pool.query(`DELETE FROM part WHERE id > 24`).then((v) => {
    console.log(v);
    pool
      .query(`DELETE FROM chapter WHERE id > 9`)
      .then()
      .catch((e) => console.log);
  });
}

module.exports = router;
