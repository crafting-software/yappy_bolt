const { yappyOnboardingMessageText } = require("../strings");

module.exports.YappyOnboardingMessage = [
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: yappyOnboardingMessageText(),
    },
  },
];
