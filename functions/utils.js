module.exports.splitToChunks = (array, chunk = 3) => {
  var i,j,temparray;
  var groups = []
  for (i = 0,j = array.length; i<j; i += chunk) {
      groups.push(array.slice(i,i + chunk));
  }
  if(groups.length < 2){
    return groups;
  }

  let lastGroup = groups.pop()
  if (lastGroup.length == 1){
    groups[0] = [...groups[0], lastGroup[0]];
  } else {
    groups.push(lastGroup)
  }

  return groups
}

module.exports.parseTime = timeString => {
  const validator = /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9])$/gm
  if (validator.test(timeString))
    return timeString.split(':').map(unit => parseInt(unit))
}
