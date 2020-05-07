exports.HomeView = (user) => {

  const state = user
    ? {
      text : 'If you don\'t want to receive any more notifications from me, you can opt out.',
      color: 'danger',
      button: 'Opt out',
      actionId: 'yappy_opt_out'
    }
    : {
      text : 'You can sign up by pressing the button below',
      color: 'primary',
      button: 'Opt in',
      actionId: 'yappy_opt_in'
    }

  return {
    type: 'home',
    callback_id: 'home_view',
  
    /* body of the view */
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Yappy*"
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": state.text
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": state.button,
            },
            "style": state.color,
            "action_id": state.actionId
          }
        ]
      }
    ]
  }
}
