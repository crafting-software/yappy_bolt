const express = require("express");
const admin = require("firebase-admin");

const { SessionStatus, GROUP_SIZE } = require("../yappy/constants");

const app = express();

app.get("/:user_id/join/:workspace/:session/:meeting_id", async (req, res) => {
  let currentSession;
  let workspace;
  await admin
    .database()
    .ref(`installations/${req.params.workspace}`)
    .once("value", async (data) => {
      workspace = data.val();
    });
  await admin
    .database()
    .ref(`sessions/${req.params.workspace}/${req.params.session}`)
    .once("value", async (data) => {
      currentSession = data.val();
    });

  let userIsRegistered = false;
  await admin
    .database()
    .ref(`users/${req.params.workspace}/${req.params.user_id}`)
    .once("value", async (data) => {
      userIsRegistered = data.val() ? true : false;
    });
  if (!userIsRegistered)
    return res.send("User not registered. Opt in, then try again.");
  if (!currentSession) return res.send("session not found");

  if (currentSession.status == SessionStatus.ENDED)
    return res.send("session has ended");

  //find the session that the user wants to join
  const userGroups = [
    ...new Set(
      Object.entries(currentSession.users)
        .filter((user) => user[1].group || false)
        .map((user) => user[1].group.id)
    ),
  ];

  const result = {};
  for (const id of userGroups) {
    result[id] = Object.entries(currentSession.users).filter(
      (user) => user[1].group && user[1].group.id == id
    );
  }

  let selectedGroup;
  let user;
  for (const group in result) {
    if (group == req.params.meeting_id) {
      selectedGroup = result[group];
      user = Object.entries(currentSession.users).find(
        (user) => user[0] == req.params.user_id
      );

      if (!user || (user.group && user.group.id != req.params.meeting_id))
        //Once the user joins a group, it cannot join another one for that session.
        res.send("You cannot participate in this meeting.");
    }
  }
  if (!selectedGroup) return res.send("invalid meeting link");

  if (
    selectedGroup.length >= GROUP_SIZE &&
    !selectedGroup.find((groupUser) => groupUser[0] == user[0])
  )
    return res.send("Group is full, cannot join.");

  const meetingLink = encodeURI(
    `https://8x8.vc/${req.params.meeting_id}/${workspace.team.name}`
  );
  await admin
    .database()
    .ref(
      `sessions/${req.params.workspace}/${req.params.session}/users/${req.params.user_id}/joined`
    )
    .set(true);

  if (!user[1].group) {
    await admin
      .database()
      .ref(
        `sessions/${req.params.workspace}/${req.params.session}/users/${req.params.user_id}/group`
      )
      .set({ id: req.params.meeting_id, meeting_link: meetingLink });
  }

  return res.redirect(meetingLink);
});

module.exports.webserver = app;
