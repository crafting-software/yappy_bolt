const token = require("firebase-functions").config().mixpanel.token;
const mixpanel = require("mixpanel").init(token);

module.exports.MixpanelInstance = mixpanel;
