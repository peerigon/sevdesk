import { config } from "@peerigon/configs/semantic-release/cross-publish";

// The @peerigon/sevdesk package on GitHub Packages is still linked to the archived
// peerigon/sevdesk-legacy repo, so GITHUB_TOKEN from this repo gets
// permission_denied: write_package. npm + JSR still publish.
//
// Re-link at https://github.com/orgs/peerigon/packages/npm/sevdesk/settings
// (unlink sevdesk-legacy, connect peerigon/sevdesk), then set github: true again.
export default config({ github: false, jsr: true });
