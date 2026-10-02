const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { ErrorHandler } = require("#shared/error");
const QualPayment = require("./qualPayment.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const QualContract = require("#modules/4.04-qualification/qualContract/qualContract.model");
const QualCourse = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const {
  getListenerId,
} = require("#modules/4.04-qualification/_shared/listenerContext");
const { paymentStatus } = require("#modules/4.04-qualification/_shared/paymentGate");

module.exports = {
  getMyPayment: async (req, res, next) => {
    try {
      const { course } = req.query;
      const listenerId = await getListenerId(req);
      if (!listenerId) return res.status(200).json({ data: null });

      const contract = await QualContract.findOne({
        course,
        listener: listenerId,
      }).lean();
      if (!contract) return res.status(200).json({ data: null });

      const payments = await QualPayment.find({ contract: contract._id })
        .sort({ date: -1 })
        .lean();
      const paidAmount = payments
        .filter((p) => p.status === 2)
        .reduce((s, p) => s + (p.price || 0), 0);
      const totalAmount = contract.totalPrice || 0;
      const remainingAmount = Math.max(0, totalAmount - paidAmount);

      const courseDoc = await QualCourse.findById(course)
        .select("title form")
        .lean();

      return res.status(200).json({
        data: {
          contractId: String(contract._id),
          courseName: courseDoc ? courseDoc.title : "",
          form: courseDoc ? courseDoc.form : null,
          totalAmount,
          paidAmount,
          remainingAmount,
          transactions: payments.map((p) => ({
            id: String(p._id),
            date: p.date,
            createdAt: p.createdAt,
            amount: p.price,
            method: p.method,
            status: p.status,
            file: (p.bank && p.bank.file) || null,
          })),
        },
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get my payment", err.message),
      );
    }
  },

  submitBankPayment: async (req, res, next) => {
    try {
      const { course, amount } = req.body;
      const listenerId = await getListenerId(req);
      if (!listenerId) {
        return res.status(403).json({ message: "Tinglovchi topilmadi!" });
      }

      const contract = await QualContract.findOne({
        course,
        listener: listenerId,
      }).lean();
      if (!contract) {
        return res.status(400).json({ message: "Shartnoma topilmadi!" });
      }

      const price = Number(amount);
      if (!price || price <= 0) {
        return res.status(400).json({ message: "Summa noto'g'ri!" });
      }

      const confirmed = await QualPayment.find({
        contract: contract._id,
        status: 2,
      })
        .select("price")
        .lean();
      const paid = confirmed.reduce((s, p) => s + (p.price || 0), 0);
      const remaining = (contract.totalPrice || 0) - paid;
      if (price > remaining) {
        return res
          .status(400)
          .json({ message: "Summa qoldiqdan ko'p bo'lishi mumkin emas!" });
      }

      if (!req.body.file) {
        return res
          .status(400)
          .json({ message: "To'lov kvitansiyasi majburiy!" });
      }

      const doc = await QualPayment.create({
        course,
        listener: listenerId,
        contract: contract._id,
        date: new Date(),
        method: 3,
        price,
        status: 1,
        bank: { file: req.body.file, fileDetails: req.fileDetails },
      });

      return res.status(201).json({ data: doc });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to submit bank payment", err.message),
      );
    }
  },

  paymentsMonitoring: async (req, res, next) => {
    try {
      const { page, limit, search, course, status } = req.query;

      const cMatch = {};
      if (course) cMatch.course = new ObjectId(course);

      const contracts = await QualContract.find(cMatch)
        .populate({ path: "listener", model: "QualListener", select: "fullName passport" })
        .populate({ path: "course", select: "title form creditHours" })
        .sort({ createdAt: -1 })
        .lean();

      let rows = [];
      for (const c of contracts) {
        const pays = await QualPayment.find({ contract: c._id })
          .select("price status")
          .lean();
        const paid = pays
          .filter((p) => p.status === 2)
          .reduce((s, p) => s + (p.price || 0), 0);
        const hasPending = pays.some((p) => p.status === 1);
        const total = c.totalPrice || 0;
        const remaining = Math.max(0, total - paid);
        let st = "unpaid";
        if (total > 0 && paid >= total) st = "paid";
        else if (paid > 0) st = "partial";
        if (hasPending && st !== "paid") st = "pending";
        const gate = c.listener
          ? await paymentStatus(c.listener._id, c.course && c.course._id)
          : null;
        rows.push({
          paymentDueAt: gate ? gate.dueAt : null,
          paymentLocked: !!(gate && gate.locked),
          requiredAmount: gate ? gate.requiredAmount : 0,
          contractId: String(c._id),
          listenerId: c.listener ? String(c.listener._id) : null,
          studentName: c.listener ? c.listener.fullName : "—",
          courseName: c.course ? c.course.title : "—",
          form: c.course ? c.course.form : null,
          creditHours: c.course ? c.course.creditHours : 0,
          totalAmount: total,
          paidAmount: paid,
          remainingAmount: remaining,
          status: st,
          hasPending,
        });
      }

      if (search) {
        const rx = new RegExp(search, "i");
        rows = rows.filter((r) => rx.test(r.studentName || ""));
      }
      if (status) rows = rows.filter((r) => r.status === status);

      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 20;
      const docs = rows.slice((p - 1) * l, (p - 1) * l + l);

      return res.status(200).json({
        docs,
        totalDocs: rows.length,
        page: p,
        limit: l,
        totalPages: Math.ceil(rows.length / l) || 1,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to build payments monitoring", err.message),
      );
    }
  },

  paymentHistory: async (req, res, next) => {
    try {
      const contract = await QualContract.findById(req.params.contract)
        .populate({ path: "listener", model: "QualListener", select: "fullName" })
        .populate({ path: "course", select: "title creditHours form" })
        .lean();
      if (!contract) return res.status(404).json({ message: "not found" });

      const pays = await QualPayment.find({ contract: contract._id })
        .select("date price method status bank click payme transactionId createdAt")
        .sort({ date: -1 })
        .lean();

      const items = pays.map((p) => ({
        id: String(p._id),
        date: p.date,
        createdAt: p.createdAt,
        amount: p.price || 0,
        method: p.method,
        status: p.status,
        transactionId:
          p.transactionId ||
          (p.bank && p.bank.transactionId) ||
          (p.click && p.click.transactionId) ||
          (p.payme && p.payme.transactionId) ||
          null,
        file:
          (p.bank && p.bank.file) ||
          (p.click && p.click.file) ||
          (p.payme && p.payme.file) ||
          null,
      }));

      const total = contract.totalPrice || 0;
      const paid = pays
        .filter((p) => p.status === 2)
        .reduce((s, p) => s + (p.price || 0), 0);

      return res.status(200).json({
        studentName: contract.listener ? contract.listener.fullName : "—",
        courseName: contract.course ? contract.course.title : "—",
        creditHours: contract.course ? contract.course.creditHours : 0,
        form: contract.course ? contract.course.form : null,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: Math.max(0, total - paid),
        items,
      });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to get payment history", err.message),
      );
    }
  },

  updatePayment: async (req, res, next) => {
    try {
      const { date, amount, transactionId, status } = req.body;
      const set = {};
      if (date !== undefined) set.date = date;
      if (amount !== undefined) set.price = Number(amount);
      if (transactionId !== undefined) set.transactionId = transactionId;
      if (status !== undefined) set.status = Number(status);

      const doc = await QualPayment.findByIdAndUpdate(
        req.params.id,
        { $set: set },
        { new: true },
      );
      if (!doc) return res.status(404).json({ message: "not found" });
      return res.status(200).json({ id: String(doc._id) });
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to update payment", err.message),
      );
    }
  },

  findAllQualPayments: async (req, res, next) => {
    try {
      const { search, course, startDate, endDate, paymentStatus } = req.query;
      const pipeline = [];
      const match = {};

      if (startDate || endDate) {
        const dateFilter = {};

        if (startDate) {
          dateFilter.$gte = new Date(startDate);
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.$lte = end;
        }

        match.date = dateFilter;
      }

      if (course) {
        match.course = new ObjectId(course);
      }

      if (Object.keys(match).length) {
        pipeline.push({ $match: match });
      }

      match.status = 2;

      pipeline.push({
        $lookup: {
          from: QualContract.collection.name,
          localField: "contract",
          foreignField: "_id",
          as: "contract",
        },
      });
      pipeline.push({ $unwind: "$contract" });

      pipeline.push({
        $lookup: {
          from: QualListener.collection.name,
          localField: "listener",
          foreignField: "_id",
          as: "listener",
        },
      });
      pipeline.push({ $unwind: "$listener" });

      if (search) {
        pipeline.push({
          $match: {
            "listener.fullName": {
              $regex: search,
              $options: "i",
            },
          },
        });
      }

      pipeline.push({ $sort: { date: -1 } });

      pipeline.push({
        $lookup: {
          from: QualCourse.collection.name,
          localField: "course",
          foreignField: "_id",
          as: "course",
        },
      });
      pipeline.push({ $unwind: "$course" });

      pipeline.push({
        $group: {
          _id: "$contract._id",

          totalPrice: { $first: "$contract.totalPrice" },
          paidPrice: { $sum: "$price" },

          courseTitle: { $first: "$course.title" },
          fullName: { $first: "$listener.fullName" },
        },
      });

      pipeline.push({
        $addFields: {
          remainingPrice: {
            $subtract: ["$totalPrice", "$paidPrice"],
          },

          paymentStatus: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$paidPrice", 0] },
                  then: 0,
                },
                {
                  case: { $gte: ["$paidPrice", "$totalPrice"] },
                  then: 2,
                },
              ],
              default: 1,
            },
          },
        },
      });

      if (paymentStatus !== undefined) {
        pipeline.push({ $match: { paymentStatus: Number(paymentStatus) } });
      }

      const docs = await QualPayment.aggregate(pipeline);
      return res.status(200).json(docs);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualPayments", err.message),
      );
    }
  },

  paginateQualPayments: async (req, res, next) => {
    try {
      const { page, limit, search, course, startDate, endDate, paymentStatus } =
        req.query;
      const pipeline = [];
      const match = {};

      if (startDate || endDate) {
        const dateFilter = {};

        if (startDate) {
          dateFilter.$gte = new Date(startDate);
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.$lte = end;
        }

        match.date = dateFilter;
      }

      if (course) {
        match.course = new ObjectId(course);
      }

      if (Object.keys(match).length) {
        pipeline.push({ $match: match });
      }

      match.status = 2;

      pipeline.push({
        $lookup: {
          from: QualContract.collection.name,
          localField: "contract",
          foreignField: "_id",
          as: "contract",
        },
      });
      pipeline.push({ $unwind: "$contract" });

      pipeline.push({
        $lookup: {
          from: QualListener.collection.name,
          localField: "listener",
          foreignField: "_id",
          as: "listener",
        },
      });
      pipeline.push({ $unwind: "$listener" });

      if (search) {
        pipeline.push({
          $match: {
            "listener.fullName": {
              $regex: search,
              $options: "i",
            },
          },
        });
      }

      pipeline.push({ $sort: { date: -1 } });

      pipeline.push({
        $lookup: {
          from: QualCourse.collection.name,
          localField: "course",
          foreignField: "_id",
          as: "course",
        },
      });
      pipeline.push({ $unwind: "$course" });

      pipeline.push({
        $group: {
          _id: "$contract._id",

          totalPrice: { $first: "$contract.totalPrice" },
          paidPrice: { $sum: "$price" },

          courseTitle: { $first: "$course.title" },
          fullName: { $first: "$listener.fullName" },
        },
      });

      pipeline.push({
        $addFields: {
          remainingPrice: {
            $subtract: ["$totalPrice", "$paidPrice"],
          },

          paymentStatus: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$paidPrice", 0] },
                  then: 0,
                },
                {
                  case: { $gte: ["$paidPrice", "$totalPrice"] },
                  then: 2,
                },
              ],
              default: 1,
            },
          },
        },
      });

      if (paymentStatus !== undefined) {
        pipeline.push({ $match: { paymentStatus: Number(paymentStatus) } });
      }

      const aggregate = QualPayment.aggregate(pipeline);

      const options = {
        useFacet: false,
        page: parseInt(page),
        limit: parseInt(limit),
      };

      const doc = await QualPayment.aggregatePaginate(aggregate, options);

      return res.status(200).json(doc);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to paginate qualPayments", err.message),
      );
    }
  },

  findOneQualPayment: async (req, res, next) => {
    try {
      const { contract } = req.query;

      const pipeline = [];

      pipeline.push({
        $match: { contract: new ObjectId(contract) },
      });

      pipeline.push({
        $sort: { date: -1 },
      });

      pipeline.push({
        $lookup: {
          from: QualContract.collection.name,
          localField: "contract",
          foreignField: "_id",
          as: "contract",
        },
      });
      pipeline.push({ $unwind: "$contract" });

      pipeline.push({
        $group: {
          _id: "$contract._id",

          totalPrice: { $first: "$contract.totalPrice" },
          totalPaid: { $sum: "$price" },

          payments: {
            $push: {
              _id: "$_id",
              date: "$date",
              method: "$method",
              price: "$price",
              status: "$status",
              click: "$click",
              payme: "$payme",
              bank: "$bank",
            },
          },
        },
      });

      pipeline.push({
        $addFields: {
          remainingPrice: {
            $subtract: ["$totalPrice", "$totalPaid"],
          },
        },
      });

      const docs = await QualPayment.aggregate(pipeline);

      if (!docs[0]) return res.status(404).json({ message: "not found" });
      return res.status(200).json(docs[0]);
    } catch (err) {
      return next(
        new ErrorHandler(400, "Failed to find qualPayment", err.message),
      );
    }
  },
};
