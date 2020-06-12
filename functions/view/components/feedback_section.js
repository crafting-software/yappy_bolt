module.exports.FeedbackSection = (user) => {
  let template = [
    {
      type: "section",
      text: {
        type: "plain_text",
        text:
          "If you have any suggestion, you can send some feedback by clicking the button below:",
        emoji: true,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            emoji: true,
            text: "Send feedback",
          },
          style: "primary",
          action_id: "yappy_send_feedback",
        },
      ],
    },
  ];

  return [...template, { type: "divider" }];
};
