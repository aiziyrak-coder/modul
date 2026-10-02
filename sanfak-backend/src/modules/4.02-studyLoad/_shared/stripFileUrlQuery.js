"use strict";

function stripFileUrlQuery(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return fileUrl;
  const qIdx = fileUrl.indexOf("?");
  return qIdx === -1 ? fileUrl : fileUrl.slice(0, qIdx);
}

module.exports = stripFileUrlQuery;
