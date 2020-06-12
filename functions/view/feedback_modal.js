module.exports.FeedbackModal = () => {
  return {
    type: "modal",
    callback_id: "yappy_feedback_modal",
    title: {
      type: "plain_text",
      text: "Yappy",
      emoji: true,
    },
    submit: {
      type: "plain_text",
      text: "Send feedback",
      emoji: true,
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },
    blocks: [
      {
        type: "input",
        block_id: "feedback_message",
        element: {
          action_id: "feedback_input",
          type: "plain_text_input",
          multiline: true,
        },
        label: {
          type: "plain_text",
          text: "If you have any suggestions, any feedback is appreciated.",
          emoji: true,
        },
      },
    ],
  };
};
