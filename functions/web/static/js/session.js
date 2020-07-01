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
    if (data.status == "error") {
      const loader = document.getElementById("loader");
      loader.remove();
      const message = document.createElement("div");
      message.id = "yappy-message";
      message.innerText = data.message;
      document.body.append(message);
      document.title = `Unable to join - ${document.title}`;
    } else window.location.replace(data.link);
  });
