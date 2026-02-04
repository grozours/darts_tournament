"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchStatus = exports.TargetStatus = exports.BracketStatus = exports.BracketType = exports.AssignmentType = exports.PoolStatus = exports.StageStatus = exports.SkillLevel = exports.TournamentStatus = exports.DurationType = exports.TournamentFormat = void 0;
var TournamentFormat;
(function (TournamentFormat) {
    TournamentFormat["SINGLE"] = "SINGLE";
    TournamentFormat["DOUBLE"] = "DOUBLE";
    TournamentFormat["TEAM_4_PLAYER"] = "TEAM_4_PLAYER";
})(TournamentFormat || (exports.TournamentFormat = TournamentFormat = {}));
var DurationType;
(function (DurationType) {
    DurationType["HALF_DAY_MORNING"] = "HALF_DAY_MORNING";
    DurationType["HALF_DAY_AFTERNOON"] = "HALF_DAY_AFTERNOON";
    DurationType["HALF_DAY_NIGHT"] = "HALF_DAY_NIGHT";
    DurationType["FULL_DAY"] = "FULL_DAY";
    DurationType["TWO_DAY"] = "TWO_DAY";
})(DurationType || (exports.DurationType = DurationType = {}));
var TournamentStatus;
(function (TournamentStatus) {
    TournamentStatus["DRAFT"] = "DRAFT";
    TournamentStatus["OPEN"] = "OPEN";
    TournamentStatus["SIGNATURE"] = "SIGNATURE";
    TournamentStatus["LIVE"] = "LIVE";
    TournamentStatus["FINISHED"] = "FINISHED";
})(TournamentStatus || (exports.TournamentStatus = TournamentStatus = {}));
var SkillLevel;
(function (SkillLevel) {
    SkillLevel["BEGINNER"] = "BEGINNER";
    SkillLevel["INTERMEDIATE"] = "INTERMEDIATE";
    SkillLevel["ADVANCED"] = "ADVANCED";
    SkillLevel["EXPERT"] = "EXPERT";
})(SkillLevel || (exports.SkillLevel = SkillLevel = {}));
var StageStatus;
(function (StageStatus) {
    StageStatus["NOT_STARTED"] = "NOT_STARTED";
    StageStatus["IN_PROGRESS"] = "IN_PROGRESS";
    StageStatus["COMPLETED"] = "COMPLETED";
})(StageStatus || (exports.StageStatus = StageStatus = {}));
var PoolStatus;
(function (PoolStatus) {
    PoolStatus["NOT_STARTED"] = "NOT_STARTED";
    PoolStatus["IN_PROGRESS"] = "IN_PROGRESS";
    PoolStatus["COMPLETED"] = "COMPLETED";
})(PoolStatus || (exports.PoolStatus = PoolStatus = {}));
var AssignmentType;
(function (AssignmentType) {
    AssignmentType["SEEDED"] = "SEEDED";
    AssignmentType["RANDOM"] = "RANDOM";
    AssignmentType["BYE"] = "BYE";
})(AssignmentType || (exports.AssignmentType = AssignmentType = {}));
var BracketType;
(function (BracketType) {
    BracketType["SINGLE_ELIMINATION"] = "SINGLE_ELIMINATION";
    BracketType["DOUBLE_ELIMINATION"] = "DOUBLE_ELIMINATION";
})(BracketType || (exports.BracketType = BracketType = {}));
var BracketStatus;
(function (BracketStatus) {
    BracketStatus["NOT_STARTED"] = "NOT_STARTED";
    BracketStatus["IN_PROGRESS"] = "IN_PROGRESS";
    BracketStatus["COMPLETED"] = "COMPLETED";
})(BracketStatus || (exports.BracketStatus = BracketStatus = {}));
var TargetStatus;
(function (TargetStatus) {
    TargetStatus["AVAILABLE"] = "AVAILABLE";
    TargetStatus["IN_USE"] = "IN_USE";
    TargetStatus["MAINTENANCE"] = "MAINTENANCE";
})(TargetStatus || (exports.TargetStatus = TargetStatus = {}));
var MatchStatus;
(function (MatchStatus) {
    MatchStatus["SCHEDULED"] = "SCHEDULED";
    MatchStatus["IN_PROGRESS"] = "IN_PROGRESS";
    MatchStatus["COMPLETED"] = "COMPLETED";
    MatchStatus["CANCELLED"] = "CANCELLED";
})(MatchStatus || (exports.MatchStatus = MatchStatus = {}));
//# sourceMappingURL=index.js.map