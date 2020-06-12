module.exports.OptOutMessage = () => [
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        "Sorry to see you go! Your colleagues are gonna miss you!\nIf you change your mind, you can opt in again anytime.",
    },
  },
  {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Opt in again",
          emoji: true,
        },
        value: "yappy_message_opt_in",
        style: "primary",
        action_id: "yappy_message_opt_in",
      },
    ],
  },
];
