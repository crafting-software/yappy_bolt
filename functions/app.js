const functions = require("firebase-functions");
const admin = require("firebase-admin");

const { App } = require("@slack/bolt");
const { HomeView } = require("./view/app_home");
const { Meeting, RSVP } = require("./yappy/meetings");
const { optIn, optOut } = require("./yappy/register");
const { InstantYap } = require("./yappy/instant_yap");
const { onboarding } = require("./yappy/onboarding");
const { authorizeFn } = require("./yappy/auth");

const { FeedbackModal } = require("./view/feedback_modal");
const { sendFeedback } = require("./yappy/feedback");
const { updateUserData } = require("./yappy/users");
module.exports.Yappy = (expressReceiver) => {
  const app = new App({
    receiver: expressReceiver,
    authorize: authorizeFn,
  });

  app.error(console.log);

  app.view("yappy_feedback_modal", async (resp) => {
    await sendFeedback(app, resp);
    console.log("response", JSON.stringify(resp));
  });

  app.view("yappy_create_instant_yap", async (resp) => {
    await Meeting.instant(app, resp);
  });

  app.view("yappy_submit_meeting", async (resp) => {
    await Meeting.submit(app, resp);
  });

  app.event("team_join", async (resp) => {
    await onboarding.sendPrivateMessage(resp, {
      joinSource: "Onboarding - new team user",
    });
  });

  app.event("member_joined_channel", async (resp) => {
    let channel;
    await admin
      .database()
      .ref(`installations/${resp.body.team_id}/webhook/channel_id`)
      .once("value", async (data) => {
        channel = data.val();
      });
    await admin
      .database()
      .ref(`users/${resp.body.team_id}/${resp.event.user}`)
      .once("value", async (data) => {
        const snapshot = data.val();
        if (channel == resp.event.channel && !snapshot)
          //user joined the channel that integrated Yappy and it's not registered
          await onboarding.sendPrivateMessage(resp, {
            joinSource: "Onboarding - Joined channel with integration",
          });
      });
  });

  app.event("user_change", async (resp) => {
    await updateUserData(app, resp);
  });

  app.event("app_home_opened", async ({ context, body, event }) => {
    const user = await app.client.users
      .info({
        token: context.botToken,
        user: event.user,
      })
      .then((user) => user.user);

    const result = await app.client.views.publish({
      token: context.botToken,
      user_id: event.user,
      view: await HomeView(user),
    });
  });

  app.action("yappy_opt_in", async (resp) => {
    await optIn(app, resp);
  });

  app.action("yappy_opt_out", async (resp) => {
    await optOut(app, resp);
  });

  app.action("yappy_send_feedback", async (resp) => {
    await app.client.views.open({
      token: resp.context.botToken,
      trigger_id: resp.body.trigger_id,
      view: FeedbackModal({ source: "app home" }),
    });
  });

  app.action("yappy_message_opt_in", async (resp) => {
    await resp.ack();
    await app.client.chat.delete({
      token: resp.context.botToken,
      ts: resp.body.message.ts,
      channel: resp.body.channel.id,
    });
    await optIn(app, resp);
  });

  app.action("accept_yappy_session", async (resp) => {
    await RSVP.accept(app, resp);
  });

  app.action("decline_yappy_session", async (resp) => {
    await RSVP.decline(app, resp);
  });

  app.action("join_yappy_meeting", async ({ ack }) => {
    await ack();
  });

  app.action("yappy_admin_schedule_meeting", async (resp) => {
    await Meeting.schedule(app, resp);
  });

  app.action("yappy_new_instant_meeting", async (resp) => {
    await InstantYap.openModal(app, resp);
  });

  app.action("yappy_select_users", async (resp) => {
    await resp.ack();
    InstantYap.select(app, resp);
  });

  app.action("yappy_admin_menu", async ({ ack, context, body }) => {
    await ack();
    const params = body.actions[0].selected_option.value.split("/");

    const [selectedOption, optionArg] = [params[0], params[1]];
    switch (selectedOption) {
      case "delete_meeting": {
        Meeting.deleteScheduled(app, optionArg, { body, context });
        break;
      }
      case "edit_meeting": {
        Meeting.edit(app, optionArg, { body, context });
        break;
      }
    }
  });

  return app;
};
