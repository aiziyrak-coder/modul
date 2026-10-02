"use strict";

function buildHeaderSpans(cols) {
  const spansFor = (groupKey) => {
    const spans = [];
    let i = 0;
    while (i < cols.length) {
      const value = cols[i][groupKey];
      if (!value) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < cols.length && cols[j][groupKey] === value) j++;
      spans.push({ value, from: i, to: j });
      i = j;
    }
    return spans;
  };
  return { grp1: spansFor("grp1"), grp2: spansFor("grp2") };
}

module.exports = { buildHeaderSpans };
