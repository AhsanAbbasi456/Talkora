const { FRONTEND_URL } = require("./urls");

// A pretend payment company for development: no real money, no keys needed.
// Turned off in production, or with PAYMENTS_TEST_MODE=false.
const testProvider = {
  id: "TEST",
  name: "Test payment",
  description: "Pretend payment for development. No real money.",
  test: true,

  isEnabled: () =>
    process.env.NODE_ENV !== "production" && process.env.PAYMENTS_TEST_MODE !== "false",

  // sends the browser to our fake checkout page
  createCheckout: (order) => ({
    type: "redirect",
    url: `${FRONTEND_URL()}/checkout/test/${order.id}`,
  }),
};

module.exports = testProvider;
