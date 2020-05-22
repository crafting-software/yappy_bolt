module.exports.InstantYapModal = async (element = null) => {
    const buttons = {
        "close": {
            "type": "plain_text",
            "text": "Cancel",
            "emoji": true
        }
    }

    if (element && element.element && element.element.options.length)
        buttons["submit"] = {
            "type": "plain_text",
            "text": "Submit",
            "emoji": true
        }

    return {
        "type": "modal",
        "callback_id": "yappy_create_instant_yap",
        "title": {
            "type": "plain_text",
            "text": "Instant yap",
            "emoji": true
        },
        ...buttons,
        "blocks": element ? [element] : [
            {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Loading data, please wait...*"
                },
            }
        ]
    }
}