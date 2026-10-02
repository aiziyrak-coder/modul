"use strict";

const { ROLES } = require("#config/constants");
const {
  FAIL_CLOSED,
  VISIBILITY_BYPASS,
  andFilters,
} = require("#modules/4.03-teacher/_shared/workPlanChain");

const REPORT_CHAIN_ROLES = [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI];

const failClosed = () => ({ ...FAIL_CLOSED });

function buildReportVisibilityFilter(user) {
  const role = user?.role?.title;

  if (VISIBILITY_BYPASS.includes(role)) return {};

  if (role === ROLES.OQITUVCHI) {
    if (!user?._id) return failClosed();
    return { teacher: user._id };
  }

  if (REPORT_CHAIN_ROLES.includes(role)) {
    return { status: { $nin: ["draft"] } };
  }

  return failClosed();
}

function withReportVisibility(filter, user) {
  return andFilters(filter, buildReportVisibilityFilter(user));
}

module.exports = {
  REPORT_CHAIN_ROLES,
  buildReportVisibilityFilter,
  withReportVisibility,
};
