// Copyright 2018 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as vscode from "vscode";
import { BazelWorkspaceInfo, QueryLocation } from "../bazel";
import { IBazelCommandAdapter, IBazelCommandOptions } from "../bazel";
import { blaze_query } from "../protos";
import { IBazelTreeItem } from "./bazel_tree_item";
import { getBazelRuleIcon } from "./icons";
import { Resources } from "../extension/resources";
import { BazelCQuery } from "../bazel/bazel_cquery";
import { getDefaultBazelExecutablePath } from "../extension/configuration";
import * as child_process from "child_process";
import * as util from "util";
import * as fs from "fs/promises";
import { BazelGTestTreeItem } from "./bazel_gtest_tree_item";
const execFile = util.promisify(child_process.execFile);

async function fileExists(filename: string) {
  try {
    await fs.stat(filename);
    return true;
  } catch {
    return false;
  }
}

/** A tree item representing a build target. */
export class BazelTargetTreeItem
  implements IBazelCommandAdapter, IBazelTreeItem
{
  /**
   * Initializes a new tree item with the given query result representing a
   * build target.
   *
   * @param target An object representing a build target that was produced by a
   * query.
   */
  constructor(
    private readonly resources: Resources,
    private readonly workspaceInfo: BazelWorkspaceInfo,
    private readonly target: blaze_query.ITarget,
  ) {}

  public mightHaveChildren(): boolean {
    return this.target.rule.ruleClass === "cc_test";
  }

  public async getChildren(): Promise<IBazelTreeItem[]> {
    const outputs = await new BazelCQuery(
      getDefaultBazelExecutablePath(),
      this.workspaceInfo.bazelWorkspacePath,
    ).queryOutputs(this.target.rule.name);
    if (outputs.length !== 1) {
      return [];
    }
    if (fileExists(outputs[0])) {
      try {
        const { stdout } = await execFile(outputs[0], ["--gtest_list_tests"], {
          cwd: this.workspaceInfo.bazelWorkspacePath,
          maxBuffer: 500 * 1024,
        });
        return this.parseGtestList(stdout);
      } catch {
        return [];
      }
    }
  }

  public getLabel(): string {
    const fullPath = this.target.rule.name;
    const colonIndex = fullPath.lastIndexOf(":");
    const targetName = fullPath.substr(colonIndex);
    return `${targetName}  (${this.target.rule.ruleClass})`;
  }

  public getIcon(): string | vscode.ThemeIcon {
    const bazelRuleIcon = getBazelRuleIcon(this.target);
    if (bazelRuleIcon) {
      return this.resources.getIconPath(bazelRuleIcon);
    }
    return vscode.ThemeIcon.File;
  }

  public getTooltip(): string {
    return `${this.target.rule.name}`;
  }

  public getCommand(): vscode.Command | undefined {
    const location = new QueryLocation(this.target.rule.location);
    return {
      arguments: [
        vscode.Uri.file(location.path),
        { selection: location.range },
      ],
      command: "vscode.open",
      title: "Go to Build Target",
    };
  }

  public getContextValue(): string {
    const ruleClass = this.target.rule.ruleClass;
    if (ruleClass.endsWith("_test") || ruleClass === "test_suite") {
      return "testRule";
    }
    return "rule";
  }

  public getBazelCommandOptions(): IBazelCommandOptions {
    return {
      options: [],
      targets: [`${this.target.rule.name}`],
      workspaceInfo: this.workspaceInfo,
    };
  }

  public parseGtestList(input: string): BazelGTestTreeItem[] {
    let currentTestGroup: string = "";
    let allTests: BazelGTestTreeItem[] = [];
    input.split("\n").forEach((line) => {
      if (line.startsWith("  ")) {
        const split = line.split("#");
        if (split.length == 2) {
          allTests.push(
            new BazelGTestTreeItem(
              this.resources,
              this.workspaceInfo,
              this.target,
              currentTestGroup + split[0].trim(),
              split[1].trim(),
            ),
          );
        } else {
          allTests.push(
            new BazelGTestTreeItem(
              this.resources,
              this.workspaceInfo,
              this.target,
              currentTestGroup + split[0].trim(),
            ),
          );
        }
      } else {
        currentTestGroup = line.trim();
      }
    });
    return allTests;
  }
}
