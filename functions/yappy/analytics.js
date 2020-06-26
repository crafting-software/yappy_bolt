const tokens = require("firebase-functions").config().mixpanel;
const dev_workspaces = require("../dev_workspaces.json");
const mixpanel = require("mixpanel");

module.exports.MixpanelInstance = ({ workspace }) => {
  if (dev_workspaces[workspace]) {
    if (dev_workspaces[workspace].statistics) {
      return mixpanel.init(tokens.dev_token);
    }
    return null;
  }
  return mixpanel.init(tokens.prod_token);
};
