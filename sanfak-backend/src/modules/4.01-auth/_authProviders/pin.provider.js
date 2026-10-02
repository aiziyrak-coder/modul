const { ErrorHandler } = require("#shared/error");

module.exports = {
  name: "pin",
  isRedirectBased: false,

  buildAuthorizeUrl: async () => {
    throw new ErrorHandler(501, "PIN provayderda redirect oqimi yo'q");
  },

  verify: async (credentials) => {
    const oneIdPin = credentials?.oneIdPin;
    if (!oneIdPin) {
      throw new ErrorHandler(400, "oneIdPin majburiy maydon");
    }

    return {
      externalId: oneIdPin,
      verified: false,
      provider: "pin",
      firstName: null,
      lastName: null,
      middleName: null,
      birthDate: null,
      email: null,
      phone: null,
      passport: null,
    };
  },
};
