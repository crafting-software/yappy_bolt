
const MAX_USERS_PER_GROUP = 4

module.exports.performGrouping = (usersList) => {
    let groups = []

    let index = 0
    if (usersList.length) groups.push([])

    while(usersList.length){
        if (groups[index].length < MAX_USERS_PER_GROUP){
            groups[index].push(usersList.pop())
        }
        else{
            index++
            groups.push([])
        }
    }
    
    groups.forEach(group => {
        console.log("---------")
        group.forEach(user => {
            console.log(user.user.name)
        })
    })
    return groups
}