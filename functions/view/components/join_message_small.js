module.exports.JoinMessageMaybe = (meeting_url, recipients, args = {}) => {
  const template = [];
  const context = {
    type: "context",
    elements: [],
  };

  const userList = args.expired ? recipients.accepted : recipients;

  for (const user of userList) {
    const userItem = [
      {
        type: "image",
        image_url: user.avatar,
        alt_text: user.name,
      },
      {
        type: "plain_text",
        text:
          userList.indexOf(user) < userList.length - 1
            ? `${user.name},`
            : user.name,
        emoji: true,
      },
    ];
    context.elements.push(...userItem);
  }
  const joinedLater = recipients.joinedLater && recipients.joinedLater.length;
  if (args.expired && joinedLater) {
    context.elements.push({
      type: "plain_text",
      text: `+ ${joinedLater} more ${joinedLater == 1 ? "user" : "users"}`,
      emoji: true,
    });
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
