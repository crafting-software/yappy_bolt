const { MessageHeadsup } = require('./view/message_heads_up')

class GroupManager {

  constructor(app, workspace){
    this.workspace = workspace;
    console.log(`workspace data: `, this.workspace)
  }

}

module.exports.GroupManager = GroupManager
