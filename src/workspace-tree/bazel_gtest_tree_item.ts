import * as vscode from "vscode";
import { BazelWorkspaceInfo, QueryLocation } from "../bazel";
import { IBazelCommandAdapter, IBazelCommandOptions } from "../bazel";
import { blaze_query } from "../protos";
import { IBazelTreeItem } from "./bazel_tree_item";
import { IconName, Resources } from "../extension/resources";

export class BazelGTestTreeItem
  implements IBazelCommandAdapter, IBazelTreeItem
{
  constructor(
    private readonly resources: Resources,
    private readonly workspaceInfo: BazelWorkspaceInfo,
    private readonly target: blaze_query.ITarget,
    private readonly testName: string,
    private readonly comment?: string,
  ) {}

  public mightHaveChildren(): boolean {
    return false;
  }

  public getChildren(): Thenable<IBazelTreeItem[]> {
    return Promise.resolve([]);
  }

  public getLabel(): string {
    return this.testName;
  }

  public getIcon(): string | vscode.ThemeIcon {
    return this.resources.getIconPath(IconName.TEST);
  }

  public getTooltip(): string {
    return this.comment || this.testName;
  }

  public getCommand(): vscode.Command | undefined {
    return undefined;
  }

  public getContextValue(): string {
    return "testRule";
  }

  public getBazelCommandOptions(): IBazelCommandOptions {
    return {
      options: ["--gtest_filter=" + this.testName],
      targets: [`${this.target.rule.name}`],
      workspaceInfo: this.workspaceInfo,
    };
  }
}
