// Copyright 2024 The Bazel Authors. All rights reserved.
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

import { IBazelCommandAdapter } from "../bazel";
import {
  BazelWorkspaceInfo,
  createBazelTask,
  queryQuickPickPackage,
  queryQuickPickTargets,
} from "../bazel";
import { getDefaultBazelExecutablePath } from "./configuration";
import { BazelCQuery } from "../bazel/bazel_cquery";
import path = require("path");

/**
 * Builds a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelBuildTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.* rule', ...)" }),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await bazelBuildTarget(quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const task = createBazelTask("build", commandOptions);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Builds a Bazel target and attaches the Starlark debugger.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelBuildTargetWithDebugging(
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.* rule', ...)" }),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      bazelBuildTargetWithDebugging(quickPick);
    }
    return;
  }
  const bazelConfigCmdLine =
    vscode.workspace.getConfiguration("bazel.commandLine");
  const startupOptions = bazelConfigCmdLine.get<string[]>("startupOptions");
  const commandArgs = bazelConfigCmdLine.get<string[]>("commandArgs");

  const commandOptions = adapter.getBazelCommandOptions();

  const fullArgs = commandArgs
    .concat(commandOptions.targets)
    .concat(commandOptions.options);

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.debug.startDebugging(undefined, {
    args: fullArgs,
    bazelCommand: "build",
    bazelExecutablePath: getDefaultBazelExecutablePath(),
    bazelStartupOptions: startupOptions,
    cwd: commandOptions.workspaceInfo.bazelWorkspacePath,
    name: "On-demand Bazel Build Debug",
    request: "launch",
    type: "bazel-launch-build",
  });
}

/**
 * Builds a Bazel package and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelbuildAll(adapter: IBazelCommandAdapter | undefined) {
  await buildPackage(":all", adapter);
}

/**
 * Builds a Bazel package recursively and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelbuildAllRecursive(
  adapter: IBazelCommandAdapter | undefined,
) {
  await buildPackage("/...", adapter);
}

async function buildPackage(
  suffix: string,
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickPackage({}),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await buildPackage(suffix, quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const allCommandOptions = {
    options: commandOptions.options,
    targets: commandOptions.targets.map((s) => s + suffix),
    workspaceInfo: commandOptions.workspaceInfo,
  };
  const task = createBazelTask("build", allCommandOptions);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Runs a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelRunTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick test targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.* rule', ...)" }),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await bazelRunTarget(quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const task = createBazelTask("run", commandOptions);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Tests a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelTestTarget(
  adapter: IBazelCommandAdapter | undefined,
  mode: "test" | "coverage",
  ...extraArgs: string[]
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick test targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.*_test rule', ...)" }),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await bazelTestTarget(quickPick, mode);
    }
    return;
  }
  let commandOptions = adapter.getBazelCommandOptions();
  commandOptions.options = commandOptions.options.map(
    (opt) => "--test_arg=" + opt,
  );
  commandOptions.options.push(...extraArgs);
  const task = createBazelTask(mode, commandOptions);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

async function bazelDebugTestTarget(
  adapter: IBazelCommandAdapter | undefined,
  ...extraArgs: string[]
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick test targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.*_test rule', ...)" }),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await bazelDebugTestTarget(quickPick);
    }
    return;
  }

  let commandOptions = adapter.getBazelCommandOptions();

  if (commandOptions.targets.length != 1) {
    throw new Error(
      "bug: invalid number of targets passed to bazelDebugTestTarget",
    );
  }
  const target = commandOptions.targets[0];
  const task = createBazelTask("build", {
    options: ["--compilation_mode", "dbg", ...extraArgs], // omit command options here, pass them as debug args instead
    targets: commandOptions.targets,
    workspaceInfo: commandOptions.workspaceInfo,
  });
  const cwd = commandOptions.workspaceInfo.bazelWorkspacePath;
  const query = new BazelCQuery(
    getDefaultBazelExecutablePath(),
    commandOptions.workspaceInfo.bazelWorkspacePath,
  );

  const execution = await vscode.tasks.executeTask(task);
  return new Promise<Thenable<boolean>>((resolve) => {
    const disposable = vscode.tasks.onDidEndTaskProcess(async (event) => {
      if (event.execution === execution) {
        disposable.dispose();
        if (event.exitCode !== 0) {
          return;
        }
        const outputs = await query.queryOutputs(target, [
          "--compilation_mode",
          "dbg",
        ]);
        const config: vscode.DebugConfiguration = {
          name: "Debug Test Target: " + target,
          type: "lldb",
          request: "launch",
          program: outputs[0],
          args: commandOptions.options,
          cwd: cwd,
          breakpointMode: "file",
          sourceMap: {
            "/proc/self/cwd": "${workspaceFolder}",
            ...vscode.workspace
              .getConfiguration("bazel")
              .get<object>("extraDebugSourceMappings"),
          },
          logging: {
            programOutput: true,
          },
          internalConsoleOptions: "neverOpen",
          externalConsole: false,
        };
        resolve(
          vscode.debug.startDebugging(
            commandOptions.workspaceInfo.workspaceFolder,
            config,
          ),
        );
      }
    });
  });
}

/**
 * Tests a Bazel package and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelTestAll(adapter: IBazelCommandAdapter | undefined) {
  await testPackage(":all", adapter, "test");
}

/**
 * Tests a Bazel package recursively and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelTestAllRecursive(
  adapter: IBazelCommandAdapter | undefined,
  mode: "test" | "coverage",
) {
  await testPackage("/...", adapter, mode);
}

async function testPackage(
  suffix: string,
  adapter: IBazelCommandAdapter | undefined,
  mode: "test" | "coverage",
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickPackage({}),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await testPackage(suffix, quickPick, mode);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const allCommandOptions = {
    options: commandOptions.options,
    targets: commandOptions.targets.map((s) => s + suffix),
    workspaceInfo: commandOptions.workspaceInfo,
  };
  const task = createBazelTask(mode, allCommandOptions);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Cleans a Bazel workspace.
 *
 * If there is only a single workspace open, it will be cleaned immediately. If
 * there are multiple workspace folders open, a quick-pick window will be opened
 * asking the user to choose one.
 */
async function bazelClean() {
  const workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
  if (!workspaceInfo) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage(
      "Please open a Bazel workspace folder to use this command.",
    );

    return;
  }
  const task = createBazelTask("clean", {
    options: [],
    targets: [],
    workspaceInfo,
  });
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Activate all user-facing commands which simply wrap Bazel commands
 * such as `build`, `clean`, etc.
 */
export function activateWrapperCommands(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("bazel.buildTarget", bazelBuildTarget),
    vscode.commands.registerCommand(
      "bazel.buildTargetWithDebugging",
      bazelBuildTargetWithDebugging,
    ),
    vscode.commands.registerCommand("bazel.buildAll", bazelbuildAll),
    vscode.commands.registerCommand(
      "bazel.buildAllRecursive",
      bazelbuildAllRecursive,
    ),
    vscode.commands.registerCommand("bazel.runTarget", bazelRunTarget),
    vscode.commands.registerCommand("bazel.testTarget", (adapter) =>
      bazelTestTarget(adapter, "test"),
    ),
    vscode.commands.registerCommand("bazel.testTargetDbg", (adapter) =>
      bazelTestTarget(adapter, "test", "--compilation_mode=dbg"),
    ),
    vscode.commands.registerCommand("bazel.testTargetAsan", (adapter) =>
      bazelTestTarget(adapter, "test", "--config=clang-asan"),
    ),
    vscode.commands.registerCommand("bazel.testTargetDbgAsan", (adapter) =>
      bazelTestTarget(
        adapter,
        "test",
        "--compilation_mode=dbg",
        "--config=clang-asan",
      ),
    ),
    vscode.commands.registerCommand("bazel.testTargetWithCoverage", (adapter) =>
      bazelTestTarget(adapter, "coverage"),
    ),
    vscode.commands.registerCommand("bazel.debugTestTarget", (adapter) =>
      bazelDebugTestTarget(adapter),
    ),
    vscode.commands.registerCommand("bazel.debugTestTargetAsan", (adapter) =>
      bazelDebugTestTarget(adapter, "--config=clang-asan"),
    ),
    vscode.commands.registerCommand("bazel.testAll", bazelTestAll),
    vscode.commands.registerCommand("bazel.testAllRecursive", (adapter) =>
      bazelTestAllRecursive(adapter, "test"),
    ),
    vscode.commands.registerCommand(
      "bazel.testAllRecursiveWithCoverage",
      (adapter) => bazelTestAllRecursive(adapter, "coverage"),
    ),
    vscode.commands.registerCommand("bazel.clean", bazelClean),
  ];
}
