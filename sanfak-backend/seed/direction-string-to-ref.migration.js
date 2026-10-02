"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const Direction = require("../src/models/_references/direction.model");
const AcademicLevel = require("../src/models/_references/academicLevel.model");
const ReadingForm = require("../src/models/_references/readingForm.model");
const EducationForm = require("../src/models/_references/educationForm.model");
const Specialization = require("../src/models/_references/specialization.model");

const isObjectId = (v) =>
  v && typeof v === "object" && v._bsontype === "ObjectId";

const findIdByTitle = async (Model, title) => {
  if (!title) return null;
  const doc = await Model.findOne({ title }).select("_id");
  return doc?._id || null;
};

const main = async () => {
  try {
    await mongoose.connect(process.env.MONGO_HOST);
    console.log("✓ MongoDB ulandi\n");

    const docs = await Direction.find({});
    console.log(`Tekshirilmoqda: ${docs.length} ta yo'nalish\n`);

    const stats = { updated: 0, skipped: 0, missing: [] };

    for (const d of docs) {
      const $set = {};
      const $unset = {};

      if (
        d.level &&
        typeof d.level === "string" &&
        !/^[0-9a-fA-F]{24}$/.test(d.level)
      ) {
        const id = await findIdByTitle(AcademicLevel, d.level);
        if (id) $set.level = id;
        else {
          $unset.level = "";
          stats.missing.push(`${d.title}: level="${d.level}"`);
        }
      }

      if (
        d.readingFormat &&
        typeof d.readingFormat === "string" &&
        !/^[0-9a-fA-F]{24}$/.test(d.readingFormat)
      ) {
        const id = await findIdByTitle(ReadingForm, d.readingFormat);
        if (id) $set.readingFormat = id;
        else {
          $unset.readingFormat = "";
          stats.missing.push(`${d.title}: readingFormat="${d.readingFormat}"`);
        }
      }

      if (
        d.educationForm &&
        typeof d.educationForm === "string" &&
        !/^[0-9a-fA-F]{24}$/.test(d.educationForm)
      ) {
        const id = await findIdByTitle(EducationForm, d.educationForm);
        if (id) $set.educationForm = id;
        else {
          $unset.educationForm = "";
          stats.missing.push(`${d.title}: educationForm="${d.educationForm}"`);
        }
      }

      if (
        d.specialization &&
        typeof d.specialization === "string" &&
        !/^[0-9a-fA-F]{24}$/.test(d.specialization)
      ) {
        const id = await findIdByTitle(Specialization, d.specialization);
        if (id) $set.specialization = id;
        else {
          $unset.specialization = "";
          stats.missing.push(
            `${d.title}: specialization="${d.specialization}"`,
          );
        }
      }

      if (Object.keys($set).length || Object.keys($unset).length) {
        const update = {};
        if (Object.keys($set).length) update.$set = $set;
        if (Object.keys($unset).length) update.$unset = $unset;
        await Direction.collection.updateOne({ _id: d._id }, update);
        stats.updated++;
        console.log(`  ✓ ${d.title} yangilandi`);
      } else {
        stats.skipped++;
      }
    }

    console.log("\n═══ YAKUN ═══");
    console.log(`  Yangilandi: ${stats.updated}`);
    console.log(`  O'zgarmagan: ${stats.skipped}`);
    if (stats.missing.length) {
      console.log(`  Topilmagan qiymatlar (${stats.missing.length} ta):`);
      stats.missing.forEach((m) => console.log(`    - ${m}`));
    }

    process.exit(0);
  } catch (err) {
    console.error("XATO:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

main();
