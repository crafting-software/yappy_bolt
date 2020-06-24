const MINUTE = 60000;
const SECOND = 1000;
const TIMEOUT = MINUTE * 5;
const SESSION_DURATION = MINUTE * 10;

module.exports.Timers = {
  MINUTE,
  SECOND,
  TIMEOUT,
  SESSION_DURATION,
};

module.exports.SessionTypes = {
  INSTANT: "instant yap",
  SCHEDULED: "scheduled session",
};

module.exports.SessionStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in progress",
  ENDED: "ended",
};

module.exports.UserResponses = {
  ACCEPTED: "accepted",
  DECLINED: "declined",
  MAYBE: "none",
};

module.exports.WeeklyReportingTime = {
  day: 5, //friday
  utc_time: "14:00",
};

module.exports.GROUP_SIZE = 3;
