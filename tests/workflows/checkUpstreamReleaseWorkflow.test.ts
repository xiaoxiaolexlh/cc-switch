import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/check-upstream-release.yml"),
  "utf8",
);

describe("upstream release notification workflow", () => {
  it("runs every six hours and filters drafts and prereleases", () => {
    expect(workflow).toContain('cron: "17 */6 * * *"');
    expect(workflow).toContain("group: upstream-release-notification");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain(
      "select(.draft == false and .prerelease == false)",
    );
  });

  it("silently establishes the first baseline and ignores a repeated tag", () => {
    expect(workflow).toContain(
      "PREVIOUS_TAG: ${{ vars.LAST_UPSTREAM_RELEASE_TAG }}",
    );
    expect(workflow).toContain(
      "STATE_TOKEN: ${{ secrets.UPSTREAM_RELEASE_STATE_TOKEN }}",
    );
    expect(workflow).toContain('if [[ -z "$previous" ]]');
    expect(workflow).toContain('elif [[ "$previous" == "$RELEASE_TAG" ]]');
    expect(workflow.match(/echo "notify=false"/g)).toHaveLength(2);
  });

  it("records the tag only after the SMTP notification step succeeds", () => {
    const sendIndex = workflow.indexOf("- name: Send release notification");
    const recordIndex = workflow.indexOf("- name: Record notified tag");
    expect(sendIndex).toBeGreaterThan(-1);
    expect(recordIndex).toBeGreaterThan(sendIndex);
    expect(workflow.slice(recordIndex)).toContain(
      "if: steps.baseline.outputs.notify == 'true'",
    );
    expect(workflow).toContain("secrets.UPSTREAM_RELEASE_SMTP_PASSWORD");
    expect(workflow).toContain("secrets.UPSTREAM_RELEASE_SMTP_TO");
    expect(workflow).toContain('"UPSTREAM_RELEASE_STATE_TOKEN"');
    expect(workflow).toContain("Missing GitHub Actions secrets:");
    expect(workflow).toContain(
      "server.starttls(context=ssl.create_default_context())",
    );
  });

  it("does not rely on the limited workflow token to update variables", () => {
    expect(workflow).not.toContain("actions: write");
    expect(workflow).toContain(
      "GH_TOKEN: ${{ secrets.UPSTREAM_RELEASE_STATE_TOKEN }}",
    );
  });
});
