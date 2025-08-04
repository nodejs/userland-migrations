# Team membership

Current members are:

- `@alexbit-codemod`
- `@AugustinMauroy`
- `@avivkeller`
- `@bmuenzenmeyer`
- `@JakobJingleheimer` (lead)
- `@ljharb`

## Rights

Any team member may block a PR or decision. A block may be overturned by team vote; votes require a quorum of ⅔ of active members and passes by >½ simple majority. In accordance with Node.js policy, a team's vote may be overturned by the [TSC](https://github.com/nodejs/TSC).

Any member can create a tag on main which triggers a CI run, this is used to create a releases. So be careful with this power. Tags should have this structure `vX.Y.Z@workspace`, where `X.Y.Z` is the version number and `workspace` is the name of the npm workspace (e.g. `v1.2.3@codemod`).

### Active vs inactive membership

An active member is one who has substantively participated once in the past 6 weeks.

A member who has been inactive for 4 or more months may be removed. They are welcome to return by simple request.

#### Team lead

The team lead is not more equal than other active members; it is an administrative function. For administrative purposes, the lead owns the repo, the github team, and handles membership changes and repository administration (particularly potentially destructive actions).

The team lead is responsible for ensuring team policies are followed, and takes some discretion when taking administrative action (such as removing an inactive member per team policy).

The team lead can also bypass Github Branch rulesets to merge PRs that are otherwise blocked by the rules. Only for hotfixes.

## Team nomination

This policy extends the parent Node.js policy.

Current Node.js collaborators are free to join at any time and do not require a nomination.

Current Node.js members who are not collaborators are free to request to join without a nomination or meeting contribution criteria. The request must have no objections after 3 days. All active members must be notified of the request.

Non-members of the Node.js org should meet the following criteria:

- ~2 months of consistent (substantive, non-trivial) contribution/participation.
  - _Consistent_ means roughly once a week (we all have lives)
  - _Substantive_ means adds value and does not detract from the issue at hand.

Exceptions may be made to members of the larger ecosystem who are well known to the Node.js organisation.

An active member may nominate a contributor who meets this criteria. The nomination must pass before requesting the contributor be added to the organisation. All active members must be notified of the nomination.

A nomination should be raised privately with active members before publicly, out of respect for the nominee.

## Team Expulsion

A team member who violates Node.js's code of conduct or who is acting against the interests or mandate of the team, or acts in bad faith may be expelled by vote of the team; such a vote requires a quorum of ⅔ of active members passing by ⅗ super majority. If a vote passes a simple majority but fails a super majority, the team member will be asked to voluntarily exit. Expulsion votes are confidential and are not conveyed to the expulee (they may be verified in confidence by the TSC).

When expulsion proceedings are commenced, team membership is frozen until the vote has settled.
