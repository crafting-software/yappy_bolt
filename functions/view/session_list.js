const { JoinMessage } = require('./join_message')

module.exports.SessionListMessage = (sessionList) => {
    console.log()

    const [blocks] = sessionList.map(session => JoinMessage(session.url, session.users))

    return(
        [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Take a break and join some of your colleagues that are already having their virtual coffees: *"
                }
            },
            ...blocks
        ]
    )
}