# `userland-migrations` Team Governance

Meet the current team members of the Node.js userland migrations:

- [@alexbit-codemod](https://github.com/alexbit-codemod) - **Alex Bit**
- [@AugustinMauroy](https://github.com/AugustinMauroy) - **Augustin Mauroy** (he/him)
- [@avivkeller](https://github.com/avivkeller) - **Aviv Keller** (he/him)
- [@bmuenzenmeyer](https://github.com/bmuenzenmeyer) - **Brian Muenzenmeyer** (he/him)
- [@brunocroh](https://github.com/brunocroh) - **Bruno Rodrigues**
- [@mohebifar](https://github.com/mohebifar) - **Mohammad Mohebifar**
- [@JakobJingleheimer](https://github.com/JakobJingleheimer) - **Jacob Smith** (he/him) - Maintainer
- [@ljharb](https://github.com/ljharb) - **Jordan Harband** (he/him)

## Rights

Any team member or Node.js collaborator can block a pull request or decision. A block can be overturned by a team vote, which requires a quorum of two-thirds of active members and passes with a simple majority (>50%). Pursuant to Node.js policy, the [TSC](https://github.com/nodejs/TSC) may override a team’s vote.

### Active vs inactive membership

### Retaining Membership

Members are expected to engage in project discussions regularly, and members inactive for more than six months may be removed from the active members list. Removed members can be reinstated upon returning to active participation.

## Team nomination

This policy extends the parent Node.js policy.

Current Node.js collaborators are free to join at any time and do not require a nomination.

Current Node.js members who are not collaborators are free to request to join without a nomination or meeting contribution criteria. The request must have no objections after 3 days. All active members must be notified of the request.

Non-members of the Node.js org should meet the following criteria:

- ~2 months of consistent (substantive, non-trivial) contribution/participation.
  - _Consistent_ means roughly once a week (we all have lives)
  - _Substantive_ means adds value and does not detract from the issue at hand.

Exceptions may be made for members of the larger ecosystem who are well known to the Node.js organisation.

An active team member may nominate a contributor who meets this criteria. The nomination must pass before requesting the contributor be added to the organisation. All active members must be notified of the nomination.

A nomination should be raised privately with active team members before publicly, out of respect for the nominee.

### Team Maintainers

Team maintainers serve in an administrative capacity and are not considered "more equal" than other active team members. Their primary role is to support smooth project operations.

Maintainership includes responsibilities such as managing the GitHub repository and team, handling membership changes, and performing administrative tasks, especially those that may be destructive or sensitive in nature.

Maintainers ensure team policies are upheld and may exercise discretion when taking necessary actions, such as removing inactive members in accordance with team guidelines.

Additionally, maintainers have the ability to bypass GitHub branch protection rules to merge pull requests, typically in cases of trivial edits, urgent corrections, or hot-fixes.

Maintainers are also responsible for creating tags on the repository's `HEAD` branch to trigger the CI pipeline and initiate a release. Tags must adhere to the format `vX.Y.Z@workspace`, where `X.Y.Z` represents the version number and `workspace` specifies the npm workspace (e.g., `v1.2.3@codemod`).

## Team removal

A team member who violates the Node.js Code of Conduct (CoC) will be reported to the Node.js Moderation Team. The Moderation Team will investigate and take appropriate action. If the Moderation Team removes the individual from the Node.js organization, no further action is required by this team, as the individual will no longer be eligible for membership.

If the Moderation Team does not remove the individual from the organization, this team may decide to take internal action, including expulsion. Such a decision requires a vote of the team, with a quorum of two-thirds of active members and passing with a three-fifths supermajority. If a vote passes with a simple majority but fails to meet the supermajority threshold, the team member will be asked to voluntarily step down. Expulsion votes are confidential and may be verified in confidence by the TSC.

During expulsion proceedings, the team member's participation is frozen until the discussion is getting resolved.
