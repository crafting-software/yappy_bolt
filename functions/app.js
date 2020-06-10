const functions = require("firebase-functions");

const { App } = require("@slack/bolt");
const { HomeView } = require("./view/app_home");
const { report } = require("./view/report");
const { Meeting, RSVP } = require("./yappy/meetings");
const { optIn, optOut } = require("./yappy/register");
const { requestUserFeedback } = require("./yappy/messaging");
const { InstantYap } = require("./yappy/instant_yap");
const { onboarding } = require("./yappy/onboarding");
const { authorizeFn } = require("./yappy/auth");

module.exports.Yappy = (expressReceiver) => {
  const app = new App({
    receiver: expressReceiver,
    authorize: authorizeFn,
  });

  app.error(console.log);

  app.view("yappy_create_instant_yap", async (resp) => {
    await Meeting.instant(app, resp);
  });

  app.view("yappy_submit_meeting", async (resp) => {
    await Meeting.submit(app, resp);
  });

  app.message("", async (resp) => {
    await requestUserFeedback(app, resp);
  });

  app.event("team_join", async (resp) => {
    await onboarding.sendPrivateMessage(resp);
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

  app.action("yappy_message_opt_out", async (resp) => {
    await resp.ack();
    await app.client.chat.delete({
      token: resp.context.botToken,
      ts: resp.body.message.ts,
      channel: resp.body.channel.id,
    });
    await optOut(app, resp);
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
