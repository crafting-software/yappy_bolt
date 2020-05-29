const { TIMEOUT } = require("../yappy/messaging");
const TIMEOUT_MIN = TIMEOUT / 60000;

module.exports.InstantYapModal = async (element = null) => {
  const buttons = {
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },

    submit: {
      type: "plain_text",
      text: "Submit",
      emoji: true,
    },
  };

  return {
    type: "modal",
    callback_id: "yappy_create_instant_yap",
    title: {
      type: "plain_text",
      text: "Instant yap",
      emoji: true,
    },
    ...buttons,
    blocks: element
      ? [element]
      : [
          {
            type: "input",
            block_id: "instant_yap_input_loading",
            label: {
              type: "plain_text",
              text: `Can't wait for the next session? Invite your colleagues to a ${TIMEOUT_MIN}-minute instant break!`,
              emoji: true,
            },
            element: {
              action_id: "yappy_select_users",
              type: "multi_static_select",
              placeholder: {
                type: "plain_text",
                text: "Select users...",
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "Loading users, please wait.",
                  },
                  value: `user/null`,
                },
              ],
            },
          },
        ],
  };
};
