"use strict";

const { ROLES } = require("#config/constants");

const UNSUBMITTED_STATUSES = ["draft", "new"];

function restrictUnsubmittedVisibility(filter, req, ownerRoles = []) {
  const roleTitle = req.user?.role?.title;

  if (roleTitle === ROLES.SUPER_ADMIN) return filter;
  if (ownerRoles.includes(roleTitle)) return filter;

  if (!filter.status) {
    filter.status = { $nin: UNSUBMITTED_STATUSES };
    return filter;
  }

  if (
    typeof filter.status === "string" &&
    UNSUBMITTED_STATUSES.includes(filter.status)
  ) {
    filter.status = { $in: [] };
  }

  return filter;
}

module.exports = { restrictUnsubmittedVisibility, UNSUBMITTED_STATUSES };
