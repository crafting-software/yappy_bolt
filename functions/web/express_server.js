const express = require("express");
const admin = require("firebase-admin");
const { MixpanelInstance } = require("../yappy/analytics");

const { SessionStatus, GROUP_SIZE } = require("../yappy/constants");

const app = express();

app.use("/static", express.static(__dirname + "/static"));
app.get(
  "/api/join_session/:user_id/:workspace/:session/:meeting_id",
  async (req, res) => {
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
      return res.json({
        status: "error",
        message: "User not registered. Opt in, then try again.",
      });
    if (!currentSession)
      return res.json({ status: "error", message: "session not found" });

    if (currentSession.status == SessionStatus.ENDED)
      return res.json({ status: "error", message: "session has ended" });

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
      }
    }

    if (!user || (user[1].group && user[1].group.id != req.params.meeting_id)) {
      //Once the user joins a group, it cannot join another one for that session.
      return res.json({
        status: "error",
        message: `You cannot participate in this meeting.`,
      });
    }
    if (!selectedGroup)
      return res.json({ status: "error", message: "invalid meeting link" });

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

    const mixpanel = MixpanelInstance({ workspace: req.params.workspace });
    if (mixpanel && !user[1].joined) {
      mixpanel.track("Joined meeting", {
        distinct_id: `${req.params.workspace}/${req.params.user_id}`,
        group: req.params.meeting_id,
        session: req.params.session,
        user_response: user[1].response,
      });
    }

    return res.json({ status: "success", link: meetingLink });
  }
);

app.get(
  "/:user_id/join/:workspace_id/:session_id/:meeting_id",
  async (req, res) => {
    return res.sendFile(__dirname + "/static/session.html");
  }
);

module.exports.webserver = app;
