"use strict";

const mysql = require("mysql");

const db = mysql.createConnection({
  host: "mytestdatabase.c1t0iaypjlcw.ap-northeast-2.rds.amazonaws.com",
  port: 3306,
  user: "admin",
  password: "12345678",
  database: "practice0427",
});

db.connect();

module.exports = db;
