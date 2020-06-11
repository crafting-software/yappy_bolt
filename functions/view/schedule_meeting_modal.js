module.exports.ScheduleMeetingModal = (state = { value: "" }) => {
  return {
    type: "modal",
    callback_id: "yappy_submit_meeting",
    title: {
      type: "plain_text",
      text: "Schedule meeting",
      emoji: true,
    },
    submit: {
      type: "plain_text",
      text: "Submit",
      emoji: true,
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },
    blocks: [
      {
        block_id: "yappy_time_input_block",
        type: "input",
        element: {
          action_id: "yappy_time_input",
          type: "plain_text_input",
          initial_value: state.value,
          placeholder: {
            type: "plain_text",
            text: "hh:mm",
          },
        },
        label: {
          type: "plain_text",
          text: "Time of meeting",
          emoji: true,
        },
      },
    ],
  };
};
