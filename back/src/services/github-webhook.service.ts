import prisma from "../database/prisma";
import { SubmissionModeEnum, StatusSubmissionEnum } from "../generated/prisma/enums";
import githubService from "./github.service";
import submissionWorker from "../workers/submission.worker";
import statusSubmissionService from "./status-submission.service";

interface PullRequestPayload {
  action: string;
  number: number;
  pull_request: {
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
    };
    title: string;
    body: string | null;
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  installation: {
    id: number;
  };
}

interface InstallationPayload {
  action: string;
  installation: {
    id: number;
    account: {
      login: string;
      type: string;
    };
  };
}

class GitHubWebhookService {
  private static instance: GitHubWebhookService;

  static getInstance(): GitHubWebhookService {
    if (!GitHubWebhookService.instance) {
      GitHubWebhookService.instance = new GitHubWebhookService();
    }
    return GitHubWebhookService.instance;
  }

  /**
   * Handle pull_request webhook events
   */
  async handlePullRequestEvent(payload: PullRequestPayload): Promise<void> {
    const { action, number: prNumber, pull_request: pr, repository, installation } = payload;

    // Only process opened and synchronize (new commits) events
    if (action !== "opened" && action !== "synchronize") {
      console.log(`[GitHubWebhook] Ignoring pull_request.${action} event`);
      return;
    }

    const installationId = String(installation.id);
    const owner = repository.owner.login;
    const repo = repository.name;

    console.log(`[GitHubWebhook] Processing PR #${prNumber} (${action}) for ${owner}/${repo}`);

    // Check if installation exists
    let installationRecord = await prisma.gitHubInstallation.findUnique({
      where: { installationId },
    });

    if (!installationRecord) {
      console.log(`[GitHubWebhook] Installation ${installationId} not found, creating...`);
      installationRecord = await prisma.gitHubInstallation.create({
        data: {
          installationId,
          accountLogin: owner,
          accountType: "Unknown",
        },
      });
    }

    // Get or create PR record
    let prRecord = await prisma.gitHubPullRequest.findUnique({
      where: {
        owner_repo_prNumber: { owner, repo, prNumber },
      },
    });

    if (prRecord) {
      // Update existing PR with new commit
      prRecord = await prisma.gitHubPullRequest.update({
        where: { id: prRecord.id },
        data: {
          commitSha: pr.head.sha,
          headRef: pr.head.ref,
          baseRef: pr.base.ref,
          status: "pending",
        },
      });
    } else {
      // Create new PR record
      prRecord = await prisma.gitHubPullRequest.create({
        data: {
          prNumber,
          installationId,
          owner,
          repo,
          headRef: pr.head.ref,
          baseRef: pr.base.ref,
          commitSha: pr.head.sha,
          status: "pending",
        },
      });
    }

    // Get PR diff
    const diff = await githubService.getPullRequestDiff(installationId, owner, repo, prNumber);

    if (!diff) {
      console.error(`[GitHubWebhook] Failed to get diff for PR #${prNumber}`);
      await this.updatePRStatus(prRecord.id, "failed");
      return;
    }

    // Find or create a system user for GitHub submissions
    let systemUser = await prisma.user.findFirst({
      where: { email: "github-bot@bugless.app" },
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          name: "GitHub Bot",
          email: "github-bot@bugless.app",
          password: "not-used",
        },
      });
    }

    // Find or create project for this repository
    const repoUrl = `https://github.com/${owner}/${repo}`;
    let project = await prisma.project.findFirst({
      where: { repositoryUrl: repoUrl },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: repo,
          description: `GitHub repository: ${owner}/${repo}`,
          repositoryUrl: repoUrl,
          userId: systemUser.id,
        },
      });
    }

    // Create submission
    const pendingStatus = await statusSubmissionService.getOrCreateStatusByName(
      StatusSubmissionEnum.PENDING
    );

    const submission = await prisma.submission.create({
      data: {
        codeContent: diff,
        submissionMode: SubmissionModeEnum.PR_DIFF,
        userId: systemUser.id,
        projectId: project.id,
        statusSubmissionId: pendingStatus.id,
        metadata: {
          source: "github",
          prNumber,
          owner,
          repo,
          commitSha: pr.head.sha,
          prTitle: pr.title,
        },
      },
    });

    // Create Check Run to show "in_progress" status on GitHub
    const checkRunId = await githubService.createCheckRun(
      installationId,
      owner,
      repo,
      pr.head.sha
    );

    // Link submission to PR record (with checkRunId if created)
    await prisma.gitHubPullRequest.update({
      where: { id: prRecord.id },
      data: {
        submissionId: submission.id,
        checkRunId: checkRunId ? String(checkRunId) : null,
        status: "reviewing",
      },
    });

    // Queue for processing
    submissionWorker.processJob(submission);

    console.log(`[GitHubWebhook] Created submission ${submission.id} for PR #${prNumber} (check_run: ${checkRunId})`);
  }

  /**
   * Handle installation webhook events
   */
  async handleInstallationEvent(payload: InstallationPayload): Promise<void> {
    const { action, installation } = payload;
    const installationId = String(installation.id);

    if (action === "created") {
      console.log(`[GitHubWebhook] New installation: ${installationId} for ${installation.account.login}`);

      await prisma.gitHubInstallation.upsert({
        where: { installationId },
        create: {
          installationId,
          accountLogin: installation.account.login,
          accountType: installation.account.type,
        },
        update: {
          accountLogin: installation.account.login,
          accountType: installation.account.type,
        },
      });
    } else if (action === "deleted") {
      console.log(`[GitHubWebhook] Installation deleted: ${installationId}`);

      await prisma.gitHubInstallation.delete({
        where: { installationId },
      }).catch(() => {
        // Ignore if not found
      });
    }
  }

  /**
   * Update PR status
   */
  async updatePRStatus(prId: string, status: string): Promise<void> {
    await prisma.gitHubPullRequest.update({
      where: { id: prId },
      data: { status },
    });
  }

  /**
   * Post review comment to GitHub PR after review is complete
   */
  async postReviewComment(submissionId: string, review: {
    summary: string | null;
    detectedIssues: string | null;
    suggestedChanges: string | null;
  }): Promise<void> {
    // Find the PR associated with this submission
    const prRecord = await prisma.gitHubPullRequest.findUnique({
      where: { submissionId },
      include: { installation: true },
    });

    if (!prRecord) {
      console.log(`[GitHubWebhook] No PR found for submission ${submissionId}`);
      return;
    }

    // Build the comment body
    const commentBody = this.buildReviewComment(review);

    // Post comment to GitHub
    const success = await githubService.postComment(
      prRecord.installationId,
      prRecord.owner,
      prRecord.repo,
      prRecord.prNumber,
      commentBody
    );

    // Update Check Run to "completed" if it exists
    if (prRecord.checkRunId) {
      const hasIssues = review.detectedIssues && review.detectedIssues.trim().length > 0;
      const conclusion = hasIssues ? "neutral" : "success";

      await githubService.updateCheckRun(
        prRecord.installationId,
        prRecord.owner,
        prRecord.repo,
        Number(prRecord.checkRunId),
        conclusion,
        {
          title: hasIssues ? "Issues found" : "No issues found",
          summary: review.summary || "Code review completed.",
          text: commentBody,
        }
      );
    }

    if (success) {
      await this.updatePRStatus(prRecord.id, "completed");
      console.log(`[GitHubWebhook] Posted review to ${prRecord.owner}/${prRecord.repo}#${prRecord.prNumber}`);
    } else {
      await this.updatePRStatus(prRecord.id, "failed");
    }
  }

  /**
   * Mark review as failed on GitHub
   */
  async markReviewFailed(submissionId: string, error: string): Promise<void> {
    const prRecord = await prisma.gitHubPullRequest.findUnique({
      where: { submissionId },
    });

    if (!prRecord) {
      return;
    }

    // Update Check Run to "failure" if it exists
    if (prRecord.checkRunId) {
      await githubService.updateCheckRun(
        prRecord.installationId,
        prRecord.owner,
        prRecord.repo,
        Number(prRecord.checkRunId),
        "failure",
        {
          title: "Review failed",
          summary: error,
        }
      );
    }

    await this.updatePRStatus(prRecord.id, "failed");
  }

  /**
   * Build the review comment markdown
   */
  private buildReviewComment(review: {
    summary: string | null;
    detectedIssues: string | null;
    suggestedChanges: string | null;
  }): string {
    const lines: string[] = [
      "## BugLess Code Review",
      "",
    ];

    if (review.summary) {
      lines.push("### Summary", "", review.summary, "");
    }

    if (review.detectedIssues) {
      lines.push("### Detected Issues", "", review.detectedIssues, "");
    }

    if (review.suggestedChanges) {
      lines.push("### Suggested Changes", "", review.suggestedChanges, "");
    }

    lines.push("---", "*Automated review by [BugLess](https://bugless.app)*");

    return lines.join("\n");
  }
}

export default GitHubWebhookService.getInstance();
