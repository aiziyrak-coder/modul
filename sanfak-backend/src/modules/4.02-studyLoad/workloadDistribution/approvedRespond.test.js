const { approvedRespondGate } = require("./approvedRespond");

const B1 = "111111111111111111111111";
const B2 = "222222222222222222222222";

describe("approvedRespondGate", () => {
  it("pending blokni qabul qilish — ruxsat (null)", () => {
    expect(
      approvedRespondGate({
        action: "accepted",
        blocks: [{ _id: B1, acceptanceStatus: "pending" }],
        blockIds: [B1],
      }),
    ).toBeNull();
  });

  it("rad etish — 400 (tasdiqlangan hujjatda faqat qabul)", () => {
    const r = approvedRespondGate({
      action: "rejected",
      blocks: [{ _id: B1, acceptanceStatus: "pending" }],
      blockIds: [B1],
    });
    expect(r.status).toBe(400);
    expect(r.message).toContain("kafedra mudiriga");
  });

  it("so'ralganlardan biri pending emas — 400", () => {
    const r = approvedRespondGate({
      action: "accepted",
      blocks: [
        { _id: B1, acceptanceStatus: "pending" },
        { _id: B2, acceptanceStatus: "accepted" },
      ],
      blockIds: [B1, B2],
    });
    expect(r.status).toBe(400);
  });

  it("blok topilmasa — 400 (ruxsat yo'q)", () => {
    expect(
      approvedRespondGate({ action: "accepted", blocks: [], blockIds: [B1] }).status,
    ).toBe(400);
  });
});
