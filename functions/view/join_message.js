const userAvatars = (users) =>
  users.map((user) => {
    return {
      type: "image",
      image_url: user.avatar,
      alt_text: user.name,
    };
  });

module.exports.JoinMessage = (meeting_url, recipients, args = {}) => {
  const expired = args.expired || false;
  const message = args.message || " ";

  const actions = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          emoji: true,
          text: "Join and start yappin",
        },
        style: "primary",
        url: meeting_url,
        action_id: "join_yappy_meeting",
      },
    ],
  };
  const template = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${
          message.trim().length ? `*${message}*` : ""
        } \n${recipients.map((recipient) => recipient.name).join("\n")}`,
      },
      accessory: {
        type: "image",
        image_url:
          "https://firebasestorage.googleapis.com/v0/b/yappy-79985.appspot.com/o/assets%2Fcamera_logo.png?alt=media&token=7d3a0221-6132-4235-ba97-6eee4119eda9",
        alt_text: " ",
      },
    },
    {
      type: "divider",
    },
    {
      type: "context",
      elements: [
        ...userAvatars(recipients),
        {
          type: "plain_text",
          emoji: true,
          text: !expired ? "happening now" : "This session has ended.",
        },
      ],
    },
  ];

  if (!expired) template.push(actions);

  return template;
};
