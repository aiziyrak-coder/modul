const createMockReq = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  user: { _id: "507f1f77bcf86cd799439011", role: { _id: "507f1f77bcf86cd799439099", title: "super_admin", permissions: [] } },
  files: [],
  headers: { authorization: "Bearer test_token" },
  ...overrides,
});

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = () => jest.fn();

module.exports = { createMockReq, createMockRes, createMockNext };
