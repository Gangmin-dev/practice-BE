"use strict";

const pool = require("./db");
const initTracer = require("./tracing").initTracer;
const { Tags } = require("opentracing");

const tracer = initTracer("DB-query");

const query = async function (sql, args, rootSpan) {
  const span = tracer.startSpan("", { childOf: rootSpan.context() });
  span.setTag("sql", sql);
  span.setTag("args", args);

  return new Promise((resolve, reject) =>
    pool
      .query(sql, args)
      .then((v) => {
        span.log({
          event: "DB-query-success",
          // returnValue: v[0],
        });
        span.finish();
        resolve(v[0]);
      })
      .catch((e) => {
        console.log(e);
        span.setTag(Tags.ERROR, true);
        span.log({
          event: "DB-query-error",
          "error.object": e,
        });
        span.finish();
        reject(e);
      })
  );
};

module.exports = query;
