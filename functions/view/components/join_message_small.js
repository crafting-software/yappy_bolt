module.exports.JoinMessageMaybe = (meeting_url, recipients, args = {}) => {
  const template = [];
  const context = {
    type: "context",
    elements: [],
  };

  for (const user of recipients) {
    const userItem = [
      {
        type: "image",
        image_url: user.avatar,
        alt_text: user.name,
      },
      {
        type: "plain_text",
        text:
          recipients.indexOf(user) < recipients.length - 1
            ? `${user.name},`
            : user.name,
        emoji: true,
      },
    ];
    context.elements.push(...userItem);
  }

  const session = {
    type: "context",
    elements: [
      //Session status
      {
        type: "mrkdwn",
        text: args.expired
          ? "This session has ended. "
          : `happening now (<${meeting_url}|Join>)`,
      },
    ],
  };

  template.push(context);
  template.push(session);

  return template;
};
