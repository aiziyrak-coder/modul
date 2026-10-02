const parseBool = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  return v === true || v === "true";
};

const isTrue = (v) => v === true || v === "true";

module.exports = { parseBool, isTrue };
