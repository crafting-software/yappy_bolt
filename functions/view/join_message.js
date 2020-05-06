module.exports.JoinMessage = (meeting_url, message = "") => {
  return [
    {
        "type": "section",
        "text": {
  				"type": "mrkdwn",
  				"text": message.length ? `*${message}*` : ' '
  			}
    },
    {
        "type": "divider"
    },
    {
        "type": "context",
        "elements": [
            {
                "type": "plain_text",
                "emoji": true,
                "text": "happening now"
            }
        ]
    },
    {
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "emoji": true,
                    "text": "Join and start yappin"
                },
                "style": "primary",
                "url": meeting_url,
                "action_id": "join_yappy_meeting"
            }
        ]
    }
  ]
}
