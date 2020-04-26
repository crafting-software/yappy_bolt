module.exports.JoinMessage = (meeting_url) => {
  return [
    {
        "type": "section",
        "text": {
  				"type": "mrkdwn",
  				"text": `Don't hold back. Join others to start yapping.`
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
            }
        ]
    }
  ]
}
