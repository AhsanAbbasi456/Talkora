const jazzcash = require("./jazzcash");
const safepay = require("./safepay");
const testProvider = require("./testProvider");
const { manualTransfer } = require("./manualTransfer");

// Every payment company plugs in here. Adding Easypaisa later = one more file + one line.
const PROVIDERS = [safepay, jazzcash, manualTransfer, testProvider];

const getProvider = (id) => PROVIDERS.find((p) => p.id === id && p.isEnabled()) || null;

const enabledProviders = () =>
  PROVIDERS.filter((p) => p.isEnabled()).map(({ id, name, description, test }) => ({
    id,
    name,
    description,
    test,
  }));

module.exports = { getProvider, enabledProviders, jazzcash, safepay, testProvider, manualTransfer };
