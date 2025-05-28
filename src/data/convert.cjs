// @ts-check

// const raw = require("./sample-credit-usage.json");
const crypto = require("node:crypto");
//
// const ids = new Set();
// const u = raw.map((r) => {
//   const h = crypto.createHash("sha256").update(r.workspaceId["$oid"]).digest();
//
//   const newId = h.toString("hex").slice(0, 12);
//
//   ids.add(newId);
//
//   return {
//     id: r._id["$oid"],
//     organizationId: "sample-id-one",
//     workspaceId: newId,
//     compute: r.compute,
//     runCount: r.runCount,
//     executionCredits: r.executionCredits,
//     date: r.date["$date"],
//   };
// });

// const raw = require("./sample-org-contrib.json");
// const u = raw.map((r) => {
//
//     return {
//         id: r._id["$oid"],
//         organizationId: "sample-id-one",
//         periodEnd: r.periodEnd["$date"],
//         periodStart: r.periodStart["$date"],
//         contributors: Object.values(r.contributors).reduce((contribs, cur, idx) => {
//             const name = cur.name || "unknown";
//             contribs[name] = contribs[name] || [];
//             contribs[name] = cur.triggeredCIPipelineExecutions.map((c) => {
//                 return {
//                     ciPipelineExecutionId: c.ciPipelineExecutionId["$oid"],
//                     triggeredAt: c.triggeredAt["$date"],
//                     title: `${name}: mock title ${idx}`
//                 }
//             });
//
//             return contribs;
//         }, {})
//     };
// });
//
// console.log(JSON.stringify(u, null, 2));

// const raw = require("./sample-task-stats.json");
//
// const ids = new Set();
//
// const u = raw.map((r) => {
//     // TODO: sample query of pulling a specific task, this would be in some kind of way
//
//
//   const h = crypto.createHash("sha256").update(r.workspaceId["$oid"]).digest();
//
//   const newId = h.toString("hex").slice(0, 12);
//
//   ids.add(newId);
//     return {
//         id: r._id["$oid"],
//         workspaceId: newId,
//         isCI: r.isCI,
//         date: r.date["$date"],
//         projectName: r.projectName,
//         target: r.target,
//         targetGroupName: r.targetGroupName,
//         totalCount: r.totalCount,
//         statusCodeRatio: r.statusCodeRatio,
//         averageDuration: r.averageDuration,
//         cacheStatusRatio: r.cacheStatusRatio
//     };
// });
//
// console.log(JSON.stringify(u, null, 2));

const raw = require("./nx-sample-daily-time-savings.json");

const u = raw.map((r) => {

    const h = crypto.createHash("sha256").update(r.workspaceId["$oid"]).digest();

    const newId = h.toString("hex").slice(0, 12);

    return {
        workspaceId: newId,
        timeSaved: r.timeSaved,
        date: r.date["$date"],
        timeSavedLocal: r.timeSavedLocal,
        timeSavedRemote: r.timeSavedRemote
}});

console.log(JSON.stringify(u, null, 2));