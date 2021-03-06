const { Timers } = require("./yappy/constants");

const messages = [
  "Get ready to yap. Sit up, stretch your legs, arms and your jaw.",
  "Your colleagues need you for a yap task.",
  "Grab a coffee and see ya in 5 minutes.",
  "5 minutes till your next yappin session. This is plenty of time to get out of those stained pyjamas. C’mon, show some respect!",
  "Maybe put on a nice shirt today? I know you can do it.",
  "Taking a break can lead to breakthroughs",
  "Almost everything will work again if you unplug it for a few minutes...including you.",
  "When in doubt, chill out.",
  "Relax. Refresh. Recharge.",
  "Take a break. Have a KitKat.",
  "Have a break from taking breaks.",
  "Take a break, you have earned it.",
];

module.exports.getRandomMessage = () =>
  messages[Math.floor(Math.random() * messages.length)];

module.exports.description =
  ":wave: I'm Yappy and my job is to make sure you stay socially connected with your team while working from home. \
  I'll be the one telling you to take a break and join your team mates in a short video call to yap about anything.";

module.exports.instantYapMessage = (initiatorId) =>
  `<@${initiatorId}> invited you to an instant yap!\nThe session \
will start ${
    Timers.TIMEOUT / Timers.MINUTE
  } minutes from now. What do you say?`;
module.exports.yappyOnboardingMessageText = (params = {}) =>
  (params.notify ? "#here " : "") +
  "Hello! Let me introduce myself.\
I'm Yappy and my job is to make sure you stay socially connected with your team while working from home. I'll be the one telling \
you to take a break and join your team mates in a short video call to yap about anything.\n\nYou can opt out of this activity by \
navigating to the *Home* tab and pressing *Opt out*. You can manually join later if you change your mind.";

module.exports.adminOnboardingMessage = (params = {}) =>
  `Hi <@${params.accountId}> ! I've scheduled a session for your team at ${params.time}.\nAs a workspace admin, you can \
schedule recurring sessions at specific hours.\nFor more details, click on the *Home* tab.`;
