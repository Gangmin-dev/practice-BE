const express = require("express");
const cors = require("cors");

const indexRouter = require("./routes/index");
const coursesRouter = require("./routes/courses");
const classesRouter = require("./routes/classes");
const partsRouter = require("./routes/parts");

const port = 8080;
const app = express();

app.use(cors());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/", indexRouter);
app.use("/courses", coursesRouter);
app.use("/classes", classesRouter);
app.use("/parts", partsRouter);

app.use(function (req, res, next) {
  res.status(404).send("Not Found");
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send("error");
});

app.listen(port, () => {
  console.log(`Run Server complete`);
});

module.exports = app;
