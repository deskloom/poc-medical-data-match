"use strict";

// `node --test test/` がディレクトリ走査として扱われない実行環境でも
// 同じコマンドでテストが実行されるよう、同階層の *.test.js を読み込む。
const fs = require("node:fs");
const path = require("node:path");

for (const name of fs.readdirSync(__dirname).sort()) {
  if (name !== "index.js" && name.endsWith(".test.js")) {
    require(path.join(__dirname, name));
  }
}
