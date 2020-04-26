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
