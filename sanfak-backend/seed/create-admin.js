"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB ulandi:", process.env.MONGO_HOST);

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const UserModel = require("../src/modules/4.01-auth/user/user.model");

  let role = await RoleModel.findOne({ title: "super_admin" }).lean();
  if (!role) {
    role = await RoleModel.create({
      title: "super_admin",
      desc: "Super administrator — barcha ruxsatlar",
      scopeLevel: "global",
      isSystem: true,
      active: true,
    });
    console.log("✓ Role yaratildi: super_admin");
  } else {
    console.log("✓ Role topildi: super_admin");
  }

  const admins = [
    {
      oneIdPin: "00000000000001",
      firstName: "Super",
      lastName: "Admin",
      email: "admin@platform.uz",
      phone: "+998901234567",
      role: role._id,
      active: true,
    },
    {
      oneIdPin: "00000000000002",
      firstName: "Admin",
      lastName: "User",
      email: "admin2@platform.uz",
      phone: "+998901234568",
      role: role._id,
      active: true,
    },
  ];

  for (const data of admins) {
    const existing = await UserModel.findOne({ oneIdPin: data.oneIdPin });
    if (!existing) {
      await UserModel.create(data);
      console.log(`✓ User yaratildi: PIN="${data.oneIdPin}"`);
    } else {
      Object.assign(existing, data);
      await existing.save();
      console.log(`~ User yangilandi: PIN="${data.oneIdPin}"`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Brauzerda:  Login tab → 00000000000001");
  console.log("  Skriptda:   POST /api/auth { oneIdPin: \"00000000000001\" }");
  console.log("═══════════════════════════════════════════");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
