import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Remove specified dependencies from package.json and run appropriate package manager install
 */
export default function removeDependencies(
	dependenciesToRemove?: string | string[],
): string | null {
	const packageJsonPath = "package.json";

	if (!dependenciesToRemove) {
		console.log("No dependencies specified for removal");
		return null;
	}

	if (!existsSync(packageJsonPath)) {
		console.log("No package.json found, skipping dependency removal");
		return null;
	}

	try {
		const depsToRemove = Array.isArray(dependenciesToRemove)
			? dependenciesToRemove
			: [dependenciesToRemove];

		const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
		const packageJson = JSON.parse(packageJsonContent);

		let modified = false;

		if (packageJson.dependencies) {
			for (const dep of depsToRemove) {
				if (packageJson.dependencies[dep]) {
					delete packageJson.dependencies[dep];
					modified = true;
					console.log(`Removed ${dep} from dependencies`);
				}
			}
		}

		if (packageJson.devDependencies) {
			for (const dep of depsToRemove) {
				if (packageJson.devDependencies[dep]) {
					delete packageJson.devDependencies[dep];
					modified = true;
					console.log(`Removed ${dep} from devDependencies`);
				}
			}
		}

		if (!modified) {
			console.log(`No specified dependencies (${depsToRemove.join(", ")}) found in package.json`);
			return null;
		}

		const updatedContent = JSON.stringify(packageJson, null, 2);
		writeFileSync(packageJsonPath, updatedContent, "utf-8");
		console.log("Updated package.json");

		const packageManager = detectPackageManager();
		runPackageManagerInstall(packageManager);

		return updatedContent;
	} catch (error) {
		console.error("Error removing dependencies:", error);
		return null;
	}
}

/**
 * Detect which package manager is being used based on lock files. Defaults to npm.
 */
function detectPackageManager(): "npm" | "yarn" | "pnpm" {
	if (existsSync("pnpm-lock.yaml")) {
		return "pnpm";
	}

	if (existsSync("yarn.lock")) {
		return "yarn";
	}

	return "npm";
}

/**
 * Run the appropriate package manager install command
 */
function runPackageManagerInstall(packageManager: "npm" | "yarn" | "pnpm"): void {
	try {
		console.log(`Running ${packageManager} install to update dependencies...`);

		switch (packageManager) {
			case "npm":
				execSync("npm install", { stdio: "inherit" });
				break;
			case "yarn":
				execSync("yarn install", { stdio: "inherit" });
				break;
			case "pnpm":
				execSync("pnpm install", { stdio: "inherit" });
				break;
		}

		console.log(`Successfully updated dependencies with ${packageManager}`);
	} catch (error) {
		console.error(`Error running ${packageManager} install:`, error);
		// Don't throw - dependency removal was successful, install failure shouldn't break the codemod
	}
}
