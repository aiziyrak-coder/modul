const { ErrorHandler } = require("#shared/error");

module.exports = {
  name: "oneid",
  isRedirectBased: true,

  buildAuthorizeUrl: async () => {
    throw new ErrorHandler(501, "OneID sozlanmagan");
  },

  verify: async () => {
    throw new ErrorHandler(501, "OneID sozlanmagan");
  },
};
