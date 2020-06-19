const path = window.location.pathname;
const data = path.split("/").filter((item) => item.length);
const params = {
  userId: data[0],
  workspaceId: data[2],
  sessionId: data[3],
  meetingId: data[4],
};

const url = `https://yappy-79985.web.app/api/join_session/${params.userId}/${params.workspaceId}/${params.sessionId}/${params.meetingId}`;
fetch(url)
  .then((response) => response.json())
  .then((data) => {
    if (data.status == "error") document.body.innerText = data.message;
    else window.location.replace(data.link);
  });
