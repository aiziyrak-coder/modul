"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../../.env") });
const mongoose = require("mongoose");

const run = async () => {
  const dry = process.argv.includes("--dry");
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);

  require("#modules/4.01-auth/user/user.model");
  const Grant = require("#modules/4.07-task/taskAssigneeGrant/taskAssigneeGrant.model");

  const orphans = await Grant.aggregate([
    { $lookup: { from: "users", localField: "assigner", foreignField: "_id", as: "a" } },
    { $lookup: { from: "users", localField: "assignee", foreignField: "_id", as: "b" } },
    { $match: { $or: [{ a: { $size: 0 } }, { b: { $size: 0 } }] } },
    { $project: { _id: 1, assigner: 1, assignee: 1 } },
  ]);

  if (!orphans.length) {
    console.log("Orphan grant topilmadi — jadval toza.");
  } else {
    orphans.forEach((o) =>
      console.log(`  orphan: assigner=${o.assigner} assignee=${o.assignee}`),
    );
    if (dry) {
      console.log(`\n[DRY] ${orphans.length} ta qator o'chirilardi (o'chirilmadi).`);
    } else {
      const res = await Grant.deleteMany({ _id: { $in: orphans.map((o) => o._id) } });
      console.log(`\n${res.deletedCount} ta orphan qator o'chirildi.`);
    }
  }

  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((err) => {
    console.error("Tozalash XATO:", err.message);
    process.exit(1);
  });
}

module.exports = { run };
