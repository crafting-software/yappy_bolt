exports.HomeView = {
  type: 'home',
  callback_id: 'home_view',

  /* body of the view */
  blocks: [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Welcome to Yappy yappy YAY! :tada:"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "This button won't do much for now but you can set up a listener for it using the `actions()` method and passing its unique `action_id`. See an example in the `examples` folder within your Bolt app."
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Click me!"
          }
        }
      ]
    }
  ]
}
